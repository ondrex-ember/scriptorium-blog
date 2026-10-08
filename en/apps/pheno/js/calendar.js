// Calendar engine (spec 4, MRD RCv0.191). Pure functions: learning projector, harvest batches, task list. No DOM, no storage.
import { BATCH_ENDED, CATEGORIES, FRESH_CATEGORIES, PROCESSING_PHASES, STAGE_FLAGS } from './config-categories.js';
import {
  ENV_MULTIPLIER, FOLLOWUP_DAYS, LEARN, PEST_BOOST_DAYS, RULE, STAGE_FACTOR
} from './config-engine.js';
import { rv } from './config-rules.js';
import { customTasks } from './customtasks.js';
import { registerProjector } from './model.js';
import { applyStockEvent, stockTasks } from './stock.js';
import { addDays, clamp, coefVariation, dayDiff, daysBetween, isNum, seasonOf, weightedMean } from './utils.js';

// ---------- base values ----------

export const stageFactor = (stage) => STAGE_FACTOR[stage] ?? 1;
export const isTerminal = (stage) => !!STAGE_FLAGS[stage]?.terminal;
export const isDormant = (stage) => !!STAGE_FLAGS[stage]?.dormant;
export const isPostHarvest = (stage) => !!STAGE_FLAGS[stage]?.postHarvest;
/** Stages in which the plant itself is still looked after (watering, feeding, pest checks). */
export const isCaredFor = (stage) => !isTerminal(stage) && !isPostHarvest(stage);

/** Accept the old (iso, env, hemisphere-string) call style as well as an options object. */
const asOpts = (o) => (typeof o === 'string' ? { hemisphere: o } : (o || {}));

/** Pot size and substrate factor (R14): (V/Vref)^β × substrate coefficient, clamped; 1 when nothing is known. */
export function potFactor(pot, rules) {
  if (!pot || (!isNum(pot.volumeL) && !pot.substrate)) return 1;
  const sub = rv(rules, `pot.substrate.${pot.substrate || 'soil'}`) ?? 1;
  const vol = isNum(pot.volumeL) ? (pot.volumeL / rv(rules, 'pot.refVolumeL')) ** rv(rules, 'pot.volumeExponent') : 1;
  return clamp(vol * sub, rv(rules, 'pot.minFactor'), rv(rules, 'pot.maxFactor'));
}

/** categoryBase (or user override) × environment × stage × pot, all in days. */
export function baseDrying(plant, env, stage, rules, pot) {
  const cat = plant.baseOverride ?? rv(rules, `cat.${plant.category}.soilDays`) ?? 3;
  const p = pot ?? plant.cache?.pot ?? { volumeL: plant.potVolumeL, substrate: plant.substrate };
  return cat * (ENV_MULTIPLIER[env] ?? 1) * stageFactor(stage) * potFactor(p, rules);
}

/** Season modifier for a date; 1 where the environment has no seasonality (configurable per environment). */
export function seasonModifier(iso, env, hemisphere = 'north', rules) {
  const o = asOpts(hemisphere);
  const r = o.rules ?? rules;
  return rv(r, `season.on.${env}`) ? rv(r, `season.${seasonOf(iso, o.hemisphere || 'north')}`) : 1;
}

/** Soil drying time for the plant's current stage: base, learned (or null), effective d, confidence. */
export function dryingInfo(plant, rules) {
  const c = plant.cache || {};
  const stage = c.stage;
  const base = baseDrying(plant, c.environment ?? plant.environment, stage, rules, c.pot);
  const learnedMap = c.soilDryDays ?? c.dryingDays;
  const learned = learnedMap?.[stage] ?? null;
  return { base, learned, d: learned ?? base, confidence: c.confidence?.[stage] ?? 0 };
}

const round2 = (v) => Math.round(v * 100) / 100;

// ---------- batches (harvest → processing → ready → used) ----------

/** Fresh weight of a harvest in grams, or null. totalWeight is entered in kg. */
export function harvestWeightG(p) {
  if (isNum(p.freshWeight)) return p.freshWeight;
  if (isNum(p.totalWeight)) return p.totalWeight * 1000;
  return null;
}

/** Estimated drying time of a batch in days (R4): reference × size^α × environment × learned ratio; a manual estimate wins. */
export function estimateDryingDays(batch, rules, learnedRatio = 1) {
  const ref = rv(rules, 'drying.refDays');
  if (isNum(batch.estDays)) return batch.estDays;
  let w = batch.weightG;
  if (!isNum(w) && isNum(batch.heightCm)) w = rv(rules, 'drying.refWeightG') * (batch.heightCm / rv(rules, 'drying.refHeightCm')) ** 3;
  const size = isNum(w) && w > 0 ? (w / rv(rules, 'drying.refWeightG')) ** rv(rules, 'drying.sizeExponent') : 1;
  const env = rv(rules, `drying.env.${batch.env}`) ?? 1;
  return clamp(ref * size * env * learnedRatio, ref * rv(rules, 'drying.minFactor'), ref * rv(rules, 'drying.maxFactor'));
}

/** Drying phase of a batch: elapsed days since it started drying (null outside the phase). */
export const dryingElapsed = (batch, at) => (batch.phase === 'drying' ? Math.max(0, daysBetween(batch.phaseSince, at)) : null);

/**
 * Estimate used for planning: the model estimate, nudged towards what the latest dryness check implies
 * (level ≥ 3 only, never past a manual estimate or a measured end).
 */
export function effectiveDryingDays(batch, rules, ratio = 1) {
  const est = estimateDryingDays(batch, rules, ratio);
  const d = batch.dryLearn;
  if (isNum(batch.estDays) || batch.phase !== 'drying' || !d || d.actual || !(d.level >= 3)) return est;
  const w = 0.5 * (d.level / 5);
  return est * (1 - w) + d.days * w;
}

/** Ratio applied to a batch: its own plant's learning, else the variety, else the category, else 1. */
export function batchRatio(plant, batch, priors) {
  if (isNum(batch.ratio)) return batch.ratio;
  const v = (plant.variety || '').trim().toLowerCase();
  return priors?.variety?.[`${plant.category}|${v}`]?.ratio ?? priors?.category?.[plant.category]?.ratio ?? 1;
}

/** Cross-plant priors from measured drying times: mean ratio per category and (from 2 batches) per variety. */
export function buildDryingPriors(plants) {
  const cat = {}, variety = {};
  const add = (map, key, r) => { const m = map[key] || (map[key] = { sum: 0, n: 0 }); m.sum += r; m.n += 1; };
  for (const p of plants) {
    const v = (p.variety || '').trim().toLowerCase();
    for (const b of p.cache?.batches || []) {
      if (!isNum(b.learnedR)) continue;
      add(cat, p.category, b.learnedR);
      if (v) add(variety, `${p.category}|${v}`, b.learnedR);
    }
  }
  const fin = (map, min) => Object.fromEntries(Object.entries(map).filter(([, m]) => m.n >= min).map(([k, m]) => [k, { ratio: round2(m.sum / m.n), n: m.n }]));
  return { category: fin(cat, 1), variety: fin(variety, 2) };
}

const newBatch = (e, p, k, c) => {
  const method = p.processingMethod ?? null;
  const instantlyReady = method === 'none';
  return {
    id: p.batchId || e.id, harvestedAt: e.occurredAt, final: !!p.final,
    fresh: FRESH_CATEGORIES.includes(k.category), weightG: harvestWeightG(p), processedG: isNum(p.processedWeight) ? p.processedWeight : null, estDays: isNum(p.estDays) ? p.estDays : null,
    heightCm: c.lastHeightCm ?? null, env: k.env, method,
    phase: method == null ? 'pending' : instantlyReady ? 'ready' : method, phaseSince: e.occurredAt,
    readyAt: instantlyReady ? e.occurredAt : null, endedAt: null, legacy: false,
    checks: [], lastCheckAt: null, evals: [], steps: [], stock: null,
    dryLearn: null, dryDays: null, learnedR: null, ratio: null
  };
};
const findBatch = (c, id) => c.batches.find((b) => b.id === id) ?? null;

/** One dryness check on a drying batch: level 5 is the measured time, lower levels extrapolate linearly (0 tells nothing). */
function learnDrying(b, dryness, at) {
  const t = dryingElapsed(b, at);
  if (t == null || t < 0.5 || !isNum(dryness) || dryness < 1 || b.dryLearn?.actual) return;
  b.dryLearn = dryness >= 5 ? { days: t, actual: true, level: 5, at } : { days: (t * 5) / dryness, actual: false, level: dryness, at };
  if (dryness >= 5) b.dryDays = round2(t);
}

// ---------- learning projector ----------

const cal = (ctx) => ctx.cal;

export const calendarProjector = {
  init(ctx) {
    const c = ctx.cache;
    c.soilDryDays = { ...(ctx.plant.learnedBase || {}) };
    c.confidence = {};
    c.learn = {};              // per stage: { n: informative checks, implied: last 5 implied values }
    c.recheckAt = null;        // pending "still moist" recheck
    c.lastHarvestAt = null; c.harvestDates = []; c.finalHarvestAt = null;
    c.evaluations = [];        // every evaluation: { at, season, kind, batchId }
    c.batches = [];
    c.dryLearn = { ratio: null, n: 0 };
    c.lastHeightCm = null;
    c.pot = { volumeL: isNum(ctx.plant.potVolumeL) ? ctx.plant.potVolumeL : null, substrate: ctx.plant.substrate ?? null };
    ctx.cal = { stage: null, env: null, water: ctx.plant.startDate, archived: false, category: ctx.plant.category };
  },

  apply(e, ctx) {
    const c = ctx.cache, k = cal(ctx), p = e.payload || {};
    const rules = ctx.opts?.rules;
    switch (e.type) {
      case 'created':
        k.env = p.environment;
        break;
      case 'stage_change': {
        const prev = k.stage;
        if (prev && c.soilDryDays[prev] != null && c.soilDryDays[p.to] == null) {
          c.soilDryDays[p.to] = round2(c.soilDryDays[prev] * stageFactor(p.to) / stageFactor(prev));
          c.confidence[p.to] = round2((c.confidence[prev] || 0) / 2);
        }
        k.stage = p.to;
        break;
      }
      case 'environment_change': {
        const from = k.env;
        if (from && from !== p.environment) {
          const ratio = (ENV_MULTIPLIER[p.environment] ?? 1) / (ENV_MULTIPLIER[from] ?? 1);
          for (const st of Object.keys(c.soilDryDays)) {
            c.soilDryDays[st] = round2(c.soilDryDays[st] * ratio);
            c.confidence[st] = round2((c.confidence[st] || 0) / 2);
          }
        }
        k.env = p.environment;
        break;
      }
      case 'watering':
        k.water = e.occurredAt; c.recheckAt = null;
        break;
      case 'moisture_check':
        learn(e, ctx);
        if (p.watered) k.water = e.occurredAt;
        break;
      case 'measurement':
        if (p.kind === 'výška' && isNum(p.value) && p.value > 0) c.lastHeightCm = p.value;
        break;
      case 'care':
        if (p.kind === 'repotting' && isNum(p.potVolumeL)) {
          const before = potFactor(c.pot, rules);
          c.pot = { ...c.pot, volumeL: p.potVolumeL };
          const ratio = potFactor(c.pot, rules) / before;
          if (ratio !== 1) {
            for (const st of Object.keys(c.soilDryDays)) {
              c.soilDryDays[st] = round2(c.soilDryDays[st] * ratio);
              c.confidence[st] = round2((c.confidence[st] || 0) / 2);
            }
          }
        }
        break;
      case 'harvest':
        c.lastHarvestAt = e.occurredAt; c.harvestDates.push(e.occurredAt);
        if (p.final) c.finalHarvestAt = e.occurredAt;
        c.batches.push(newBatch(e, p, k, c));
        break;
      case 'batch_step': {
        const b = findBatch(c, p.batchId);
        if (!b) break;
        // leaving the drying phase for good gives the measured drying time (unless a dryness-5 check already did)
        if (b.phase === 'drying' && p.phase !== 'drying' && p.phase !== 'discarded' && !b.dryLearn?.actual) {
          const t = dryingElapsed(b, e.occurredAt);
          if (t >= 0.5) { b.dryLearn = { days: t, actual: true, level: 5, at: e.occurredAt }; b.dryDays = round2(t); }
        }
        b.phase = p.phase; b.phaseSince = e.occurredAt;
        if (p.method) b.method = p.method; else if (PROCESSING_PHASES.includes(p.phase)) b.method = p.phase;
        if (isNum(p.estDays)) b.estDays = p.estDays;
        if (p.phase === 'ready') b.readyAt = e.occurredAt;
        if (BATCH_ENDED.includes(p.phase)) b.endedAt = e.occurredAt;
        b.steps.push({ at: e.occurredAt, phase: p.phase });
        break;
      }
      case 'batch_check': {
        const b = findBatch(c, p.batchId);
        if (!b) break;
        b.checks.push({
          at: e.occurredAt, phase: b.phase, dryness: p.dryness ?? null, mold: p.mold ?? null,
          scent: p.scent ?? null, appearance: p.appearance ?? null
        });
        b.lastCheckAt = e.occurredAt;
        learnDrying(b, p.dryness, e.occurredAt);
        break;
      }
      case 'evaluation': {
        const kind = p.kind ?? 'final';   // evaluations from before RCv0.191 count as final
        c.evaluations.push({ at: e.occurredAt, season: p.season ?? null, kind, batchId: p.batchId ?? null });
        const target = p.batchId ? findBatch(c, p.batchId) : (kind === 'final' ? c.batches.at(-1) ?? null : null);
        if (target) target.evals.push({ at: e.occurredAt, kind, part: p.part ?? null });
        break;
      }
      case 'stock_init': case 'stock_use': case 'stock_adjust': case 'stock_move': case 'stock_check':
        applyStockEvent(c, e);
        break;
      case 'archive':
        k.archived = true;
        break;
      case 'unarchive':
        k.archived = false;
        break;
      default:
        break;
    }
  },

  finalize(ctx) {
    const c = ctx.cache, k = cal(ctx);
    // Harvests without a recorded method: on an active "Sklizeno" plant we ask once (phase stays "pending", no tasks);
    // everywhere else (older cycles, perennials still bearing, archived) they are treated as ready, as before.
    const ask = c.stage === 'harvested' && !k.archived;
    for (const b of c.batches) {
      if (b.phase === 'pending' && !ask) { b.phase = 'ready'; b.legacy = true; b.readyAt = b.harvestedAt; }
    }
    // Drying-time learning (R4): each measured batch moves this plant's ratio towards observed/model, faster at first.
    const rules = ctx.opts?.rules, blendOld = rv(rules, 'drying.blendOld');
    let ratio = null, n = 0;
    for (const b of c.batches) {
      b.ratio = ratio;
      if (!b.dryLearn?.actual) continue;
      const model = estimateDryingDays({ ...b, estDays: null }, rules, 1);
      const r = clamp(b.dryLearn.days / model, rv(rules, 'drying.minFactor'), rv(rules, 'drying.maxFactor'));
      b.learnedR = round2(r);
      const wNew = Math.max(1 - blendOld, 1 / (n + 2));
      ratio = round2((1 - wNew) * (ratio ?? 1) + wNew * r); n += 1;
    }
    c.dryLearn = { ratio, n };
  }
};
registerProjector(calendarProjector);

/** Batches still waiting for the user to say how they are processed. */
export const pendingBatches = (plant) => (plant.cache?.batches || []).filter((b) => b.phase === 'pending');
export const openBatches = (plant) => (plant.cache?.batches || []).filter((b) => !BATCH_ENDED.includes(b.phase));

/** Spec 4.2 for one moisture check. */
function learn(e, ctx) {
  const c = ctx.cache, k = cal(ctx), answer = e.payload.answer, stage = k.stage;
  const env = k.env, rules = ctx.opts?.rules;
  const base = baseDrying(ctx.plant, env, stage, rules, c.pot);
  let d = c.soilDryDays[stage] ?? base;
  const mod = seasonModifier(e.occurredAt, env, ctx.opts?.hemisphere, rules);
  const t = daysBetween(k.water, e.occurredAt) / mod;   // de-seasonalized
  let implied = null;

  if (answer === 'dry') {
    if (t <= d * RULE.dryLate) { implied = t * RULE.impliedDry; d = RULE.blendDry * d + (1 - RULE.blendDry) * implied; }
  } else if (answer === 'ok') {
    implied = t * RULE.impliedOk; d = (1 - RULE.blendOk) * d + RULE.blendOk * implied;
  } else if (t >= d * RULE.wetEarly) {   // wet
    implied = t * RULE.impliedWet; d = implied;
  }

  if (implied != null) {
    const st = c.learn[stage] || (c.learn[stage] = { n: 0, implied: [] });
    st.n += 1;
    st.implied = [...st.implied, implied].slice(-LEARN.window);
    d = clamp(d, Math.max(1, LEARN.minFactor * base), LEARN.maxFactor * base);
    if (st.n >= LEARN.minInformative) {
      d = LEARN.blendOld * d + LEARN.blendNew * weightedMean(st.implied);
      d = clamp(d, Math.max(1, LEARN.minFactor * base), LEARN.maxFactor * base);
    }
    c.soilDryDays[stage] = round2(d);
    c.confidence[stage] = round2(Math.min(st.n / LEARN.confidenceN, 1) * (1 - Math.min(coefVariation(st.implied), 1)));
  }
  c.recheckAt = answer === 'wet'
    ? addDays(e.occurredAt, Math.max(1, Math.ceil((c.soilDryDays[stage] ?? d) * RULE.recheckFraction)))
    : null;
}

// ---------- tasks ----------

const SNOOZE_KEY = {
  moisture: 'watering', fertilizing: 'fertilizing', pestCheck: 'pestCheck',
  problemFollowUp: 'problemFollowUp', evaluation: 'evaluation', evaluationReview: 'evaluation'
};

/** Pest-check interval in days (spec 4.7). */
export function pestInterval(plant, now, rules) {
  const c = plant.cache;
  const base = rv(rules, `cat.${plant.category}.pestCheckDays`) ?? CATEGORIES[plant.category].pestCheckDays;
  const boosted = c.pestBoostUntil && now < c.pestBoostUntil;
  if (!boosted) return base;
  if (c.openProblems.some((x) => x.problemType === 'mold' && x.severity >= 2)) return 2;
  return Math.max(1, Math.round(base / 2));
}

/** Next moisture check date. */
export function nextMoistureDue(plant, now, hemisphere = 'north') {
  const o = asOpts(hemisphere);
  const c = plant.cache, env = c.environment ?? plant.environment;
  if (c.recheckAt) return c.recheckAt;
  const { d } = dryingInfo(plant, o.rules);
  const last = c.lastWateredAt ?? plant.startDate;
  return addDays(last, d * seasonModifier(now, env, o.hemisphere, o.rules));
}

/** Next feeding date (R7): first feed after N days, then category interval × stage factor; none when feeding is not due in this stage. */
export function nextFertilizingDue(plant, rules) {
  const c = plant.cache;
  if (!isCaredFor(c.stage) || isDormant(c.stage)) return null;
  const planned = plant.plannedHarvestAt;
  const stop = rv(rules, 'fertilizing.stopBeforeHarvestDays');
  const factor = c.stage === 'fruiting' ? rv(rules, 'fertilizing.fruitingFactor') : 1;
  const days = rv(rules, `cat.${plant.category}.fertilizingDays`) * factor;
  const due = c.lastFertilizedAt ? addDays(c.lastFertilizedAt, days) : addDays(plant.startDate, rv(rules, 'fertilizing.firstFeedDays'));
  if (stop > 0 && planned && due >= addDays(planned, -stop)) return null;
  return due;
}

/** Days between checks of a batch, or null when the phase has none (R3). */
export function batchCheckInterval(batch, rules, now, ratio = batch.ratio ?? 1) {
  const last = batch.lastCheckAt && batch.lastCheckAt > batch.phaseSince ? batch.lastCheckAt : batch.phaseSince;
  const lastCheck = batch.checks.at(-1);
  let days = null;
  switch (batch.phase) {
    case 'drying': {
      const t = daysBetween(batch.phaseSince, last);
      const remaining = Math.max(0, effectiveDryingDays(batch, rules, ratio) - t);
      days = clamp(rv(rules, 'batch.drying.fraction') * remaining, rv(rules, 'batch.drying.minDays'), rv(rules, 'batch.drying.maxDays'));
      if ((lastCheck?.dryness ?? 0) >= 4) days = Math.min(days, rv(rules, 'batch.drying.nearDays'));
      break;
    }
    case 'curing': {
      const age = daysBetween(batch.phaseSince, last);
      days = age < 7 ? rv(rules, 'batch.curing.firstWeekDays') : age < 28 ? rv(rules, 'batch.curing.monthDays') : rv(rules, 'batch.curing.laterDays');
      break;
    }
    case 'fermenting': days = rv(rules, 'batch.fermenting.days'); break;
    case 'pickling': days = rv(rules, 'batch.pickling.days'); break;
    case 'storing': days = rv(rules, batch.fresh ? 'batch.storing.freshDays' : 'batch.storing.driedDays'); break;
    default: return null;
  }
  if (lastCheck?.mold && lastCheck.at === batch.lastCheckAt) days = Math.min(days, 1);
  return { days, last };
}

/** Evaluation reminder offsets for a batch: fresh produce is judged soon, the rest after use. */
const reminderOffsets = (batch, rules) => (batch.fresh
  ? [rv(rules, 'eval.freshRemind1Days'), rv(rules, 'eval.freshRemind2Days')]
  : [rv(rules, 'eval.remind1Days'), rv(rules, 'eval.remind2Days'), rv(rules, 'eval.remind3Days')]);

/** When a batch counts as "ready for use": readyAt, or the day it was used up. */
const anchorOf = (b) => b.readyAt ?? (b.phase === 'used' ? b.endedAt : null);

/** Latest reminder date that has passed, else the first one. */
function pickReminder(anchor, offsets, now) {
  const dates = offsets.map((n) => addDays(anchor, n));
  const passed = dates.filter((x) => x <= now);
  return passed.length ? passed[passed.length - 1] : dates[0];
}

/** Evaluation reminder (R9): anchored on "ready for use"; one per plant, or one per season for perennials. */
function evaluationDue(plant, now, rules) {
  const c = plant.cache;
  if (!plant.harvestable || plant.reminders === false) return null;
  const anchored = c.batches.filter((b) => !b.legacy || !plant.archivedAt).filter((b) => b.phase !== 'discarded' && anchorOf(b));
  if (!anchored.length) return null;
  const finals = c.evaluations.filter((x) => x.kind === 'final');
  const lastBatch = (list) => list.reduce((a, b) => (anchorOf(a) >= anchorOf(b) ? a : b));
  if (plant.lifecycle === 'perennial') {
    const year = (b) => new Date(b.harvestedAt).getFullYear();
    const seasonOfEval = (x) => x.season ?? (x.batchId ? year(c.batches.find((b) => b.id === x.batchId) ?? { harvestedAt: x.at }) : null);
    const missing = [...new Set(anchored.map(year))].sort().filter((y) => !finals.some((x) => seasonOfEval(x) === y));
    if (!missing.length) return null;
    const y = missing.at(-1);
    const b = lastBatch(anchored.filter((x) => year(x) === y));
    return { type: 'evaluation', due: pickReminder(anchorOf(b), reminderOffsets(b, rules), now), season: y, batchId: b.id };
  }
  const b = lastBatch(anchored);
  if (!finals.length) return { type: 'evaluation', due: pickReminder(anchorOf(b), reminderOffsets(b, rules), now), season: null, batchId: b.id };
  if (finals.length === 1) {
    const due = addDays(finals[0].at, rv(rules, 'eval.reviewDays'));
    if (now >= due) return { type: 'evaluationReview', due, season: finals[0].season, batchId: finals[0].batchId };
  }
  return null;
}

/** Tasks for one plant (unfiltered by urgency window, snoozed ones removed). */
export function getPlantTasks(plant, now, opts = {}) {
  const o = asOpts(opts), rules = o.rules, hemisphere = o.hemisphere || 'north';
  const c = plant.cache;
  if (!c) return [];
  const out = [];
  const push = (type, due, extra = {}) => out.push({
    plantId: plant.id, plantName: plant.name, type, snoozeKey: extra.snoozeKey ?? SNOOZE_KEY[type], dueAt: due, ...extra
  });
  const caring = !plant.archivedAt && isCaredFor(c.stage);

  if (caring) {
    push('moisture', nextMoistureDue(plant, now, { hemisphere, rules }));
    const fert = nextFertilizingDue(plant, rules);
    if (fert) push('fertilizing', fert);
    push('pestCheck', addDays(c.lastPestCheckAt ?? plant.startDate, pestInterval(plant, now, rules)));
    for (const pr of c.openProblems) {
      const ref = c.lastPestCheckAt && c.lastPestCheckAt > pr.since ? c.lastPestCheckAt : pr.since;
      const due = addDays(ref, FOLLOWUP_DAYS);
      if (due <= addDays(pr.since, PEST_BOOST_DAYS)) push('problemFollowUp', due, { problemId: pr.id });
    }
  }

  for (const b of c.batches) {
    if (b.legacy || BATCH_ENDED.includes(b.phase) || b.phase === 'pending') continue;
    const iv = batchCheckInterval(b, rules, now, batchRatio(plant, b, o.priors));
    // once the material sits in weighed containers, their own checks replace the batch-level storing check
    const inStock = b.stock?.containers.some((k) => k.status === 'open');
    if (iv && !(inStock && b.phase === 'storing')) push('batchCheck', addDays(iv.last, iv.days), { batchId: b.id, phase: b.phase, snoozeKey: `batchCheck:${b.id}` });
    if (b.fresh && !b.stock && ['storing', 'ready'].includes(b.phase)) {
      push('useBy', addDays(b.harvestedAt, rv(rules, `useBy.${plant.category}`) ?? 10), { batchId: b.id, snoozeKey: `useBy:${b.id}` });
    }
  }

  for (const t of stockTasks(plant, now, { rules, cfg: o.stockCfg, priors: o.priors })) {
    const { type, due, ...extra } = t;
    push(type, due, extra);
  }

  for (const t of customTasks(plant, now, o.taskTemplates)) {
    const { dueAt, ...extra } = t;
    push('custom', dueAt, extra);
  }

  const ev = evaluationDue(plant, now, rules);
  if (ev) push(ev.type, ev.due, { season: ev.season, batchId: ev.batchId });

  return out.filter((t) => {
    const until = c.snoozedUntil?.[t.snoozeKey];
    return !(until && until > now);
  });
}

const ORDER = { overdue: 0, today: 1, upcoming: 2 };

/** All tasks within the look-ahead window, sorted by urgency then due date. */
export function computeTasks(plants, now, opts = {}) {
  const out = [];
  const look = rv(asOpts(opts).rules, 'dashboard.lookaheadDays');
  for (const plant of plants) {
    for (const t of getPlantTasks(plant, now, opts)) {
      const daysUntil = dayDiff(now, t.dueAt);
      if (daysUntil > look) continue;
      out.push({ ...t, daysUntil, urgency: daysUntil < 0 ? 'overdue' : daysUntil === 0 ? 'today' : 'upcoming' });
    }
  }
  return out.sort((a, b) => ORDER[a.urgency] - ORDER[b.urgency] || (a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : 0));
}
