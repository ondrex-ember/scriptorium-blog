// Calendar engine (spec 4). Pure functions: learning projector + task list. No DOM, no storage.
import { CATEGORIES, STAGE_FLAGS } from './config-categories.js';
import {
  ENV_MULTIPLIER, EVAL_REMINDER_DAYS, EVAL_REVIEW_DAYS, FERT_STAGE_FACTOR, FOLLOWUP_DAYS, LEARN,
  LOOKAHEAD_DAYS, RULE, SEASONAL_ENVIRONMENTS, SEASON_MODIFIER, STAGE_FACTOR, PEST_BOOST_DAYS
} from './config-engine.js';
import { registerProjector } from './model.js';
import { addDays, clamp, coefVariation, dayDiff, daysBetween, seasonOf, weightedMean } from './utils.js';

// ---------- base values ----------

export const stageFactor = (stage) => STAGE_FACTOR[stage] ?? 1;
export const isTerminal = (stage) => !!STAGE_FLAGS[stage]?.terminal;
export const isDormant = (stage) => !!STAGE_FLAGS[stage]?.dormant;

/** categoryBase (or user override) × environment multiplier × stage factor. */
export function baseDrying(plant, env, stage) {
  const cat = plant.baseOverride ?? CATEGORIES[plant.category]?.baseDryingDays ?? 3;
  return cat * (ENV_MULTIPLIER[env] ?? 1) * stageFactor(stage);
}

/** Season modifier for a date; 1 outside outdoor/greenhouse. */
export function seasonModifier(iso, env, hemisphere = 'north') {
  return SEASONAL_ENVIRONMENTS.includes(env) ? SEASON_MODIFIER[seasonOf(iso, hemisphere)] : 1;
}

/** Current drying time for the plant's stage: base, learned (or null), effective d, confidence. */
export function dryingInfo(plant) {
  const c = plant.cache || {};
  const stage = c.stage;
  const base = baseDrying(plant, c.environment ?? plant.environment, stage);
  const learned = c.dryingDays?.[stage] ?? null;
  return { base, learned, d: learned ?? base, confidence: c.confidence?.[stage] ?? 0 };
}

const round2 = (v) => Math.round(v * 100) / 100;

// ---------- learning projector ----------

const cal = (ctx) => ctx.cal;

export const calendarProjector = {
  init(ctx) {
    const c = ctx.cache;
    c.dryingDays = { ...(ctx.plant.learnedBase || {}) };
    c.confidence = {};
    c.learn = {};              // per stage: { n: informative checks, implied: last 5 implied values }
    c.recheckAt = null;        // pending "still moist" recheck
    c.lastHarvestAt = null; c.harvestDates = []; c.evaluations = [];
    ctx.cal = { stage: null, env: null, water: ctx.plant.startDate };
  },

  apply(e, ctx) {
    const c = ctx.cache, k = cal(ctx), p = e.payload || {};
    switch (e.type) {
      case 'created':
        k.env = p.environment;
        break;
      case 'stage_change': {
        const prev = k.stage;
        if (prev && c.dryingDays[prev] != null && c.dryingDays[p.to] == null) {
          c.dryingDays[p.to] = round2(c.dryingDays[prev] * stageFactor(p.to) / stageFactor(prev));
          c.confidence[p.to] = round2((c.confidence[prev] || 0) / 2);
        }
        k.stage = p.to;
        break;
      }
      case 'environment_change': {
        const from = k.env;
        if (from && from !== p.environment) {
          const ratio = (ENV_MULTIPLIER[p.environment] ?? 1) / (ENV_MULTIPLIER[from] ?? 1);
          for (const st of Object.keys(c.dryingDays)) {
            c.dryingDays[st] = round2(c.dryingDays[st] * ratio);
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
      case 'harvest':
        c.lastHarvestAt = e.occurredAt; c.harvestDates.push(e.occurredAt);
        break;
      case 'evaluation':
        c.evaluations.push({ at: e.occurredAt, season: p.season ?? null });
        break;
      default:
        break;
    }
  }
};
registerProjector(calendarProjector);

/** Spec 4.2 for one moisture check. */
function learn(e, ctx) {
  const c = ctx.cache, k = cal(ctx), answer = e.payload.answer, stage = k.stage;
  const env = k.env;
  const base = baseDrying(ctx.plant, env, stage);
  let d = c.dryingDays[stage] ?? base;
  const mod = seasonModifier(e.occurredAt, env, ctx.opts?.hemisphere);
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
    c.dryingDays[stage] = round2(d);
    c.confidence[stage] = round2(Math.min(st.n / LEARN.confidenceN, 1) * (1 - Math.min(coefVariation(st.implied), 1)));
  }
  c.recheckAt = answer === 'wet'
    ? addDays(e.occurredAt, Math.max(1, Math.ceil((c.dryingDays[stage] ?? d) * RULE.recheckFraction)))
    : null;
}

// ---------- tasks ----------

const SNOOZE_KEY = {
  moisture: 'watering', fertilizing: 'fertilizing', pestCheck: 'pestCheck',
  problemFollowUp: 'problemFollowUp', evaluation: 'evaluation', evaluationReview: 'evaluation'
};

/** Pest-check interval in days (spec 4.7). */
export function pestInterval(plant, now) {
  const c = plant.cache;
  const base = CATEGORIES[plant.category].pestCheckDays;
  const boosted = c.pestBoostUntil && now < c.pestBoostUntil;
  if (!boosted) return base;
  if (c.openProblems.some((x) => x.problemType === 'mold' && x.severity >= 2)) return 2;
  return Math.max(1, Math.round(base / 2));
}

/** Next moisture check date and the d that produced it. */
export function nextMoistureDue(plant, now, hemisphere = 'north') {
  const c = plant.cache, env = c.environment ?? plant.environment;
  if (c.recheckAt) return c.recheckAt;
  const { d } = dryingInfo(plant);
  const last = c.lastWateredAt ?? plant.startDate;
  return addDays(last, d * seasonModifier(now, env, hemisphere));
}

function evaluationDue(plant, now) {
  const c = plant.cache, cfg = plant.harvestable;
  if (!cfg || plant.reminders === false || !c.harvestDates?.length) return null;
  const evals = c.evaluations || [];
  if (plant.lifecycle === 'perennial') {
    const years = [...new Set(c.harvestDates.map((h) => new Date(h).getFullYear()))].sort();
    const missing = years.filter((y) => !evals.some((x) => x.season === y));
    if (!missing.length) return null;
    const y = missing[missing.length - 1];
    const last = c.harvestDates.filter((h) => new Date(h).getFullYear() === y).sort().pop();
    return { type: 'evaluation', due: pickReminder(last, now), season: y };
  }
  if (!evals.length) return { type: 'evaluation', due: pickReminder(c.lastHarvestAt, now), season: null };
  if (evals.length === 1) {
    const due = addDays(evals[0].at, EVAL_REVIEW_DAYS);
    if (now >= due) return { type: 'evaluationReview', due, season: evals[0].season };
  }
  return null;
}

/** Latest reminder date that has passed, else the first one (days 14/44/74 after the last harvest). */
function pickReminder(lastHarvest, now) {
  const dates = EVAL_REMINDER_DAYS.map((n) => addDays(lastHarvest, n));
  const passed = dates.filter((x) => x <= now);
  return passed.length ? passed[passed.length - 1] : dates[0];
}

/** Tasks for one plant (unfiltered by urgency window, snoozed ones removed). */
export function getPlantTasks(plant, now, { hemisphere = 'north' } = {}) {
  const c = plant.cache;
  if (!c || plant.archivedAt) return [];
  const out = [];
  const push = (type, due, extra = {}) => out.push({
    plantId: plant.id, plantName: plant.name, type, snoozeKey: SNOOZE_KEY[type], dueAt: due, ...extra
  });
  const ended = isTerminal(c.stage);

  if (!ended) push('moisture', nextMoistureDue(plant, now, hemisphere));

  if (!ended && !isDormant(c.stage)) {
    const days = CATEGORIES[plant.category].fertilizingDays * (FERT_STAGE_FACTOR[c.stage] ?? 1);
    push('fertilizing', addDays(c.lastFertilizedAt ?? plant.startDate, days));
  }

  if (!ended) push('pestCheck', addDays(c.lastPestCheckAt ?? plant.startDate, pestInterval(plant, now)));

  for (const pr of ended ? [] : c.openProblems) {
    const ref = c.lastPestCheckAt && c.lastPestCheckAt > pr.since ? c.lastPestCheckAt : pr.since;
    const due = addDays(ref, FOLLOWUP_DAYS);
    if (due <= addDays(pr.since, PEST_BOOST_DAYS)) push('problemFollowUp', due, { problemId: pr.id });
  }

  const ev = evaluationDue(plant, now);
  if (ev) push(ev.type, ev.due, { season: ev.season });

  return out.filter((t) => {
    const until = c.snoozedUntil?.[t.snoozeKey];
    return !(until && until > now);
  });
}

const ORDER = { overdue: 0, today: 1, upcoming: 2 };

/** All tasks within the look-ahead window, sorted by urgency then due date. */
export function computeTasks(plants, now, opts = {}) {
  const out = [];
  for (const plant of plants) {
    for (const t of getPlantTasks(plant, now, opts)) {
      const daysUntil = dayDiff(now, t.dueAt);
      if (daysUntil > LOOKAHEAD_DAYS) continue;
      out.push({ ...t, daysUntil, urgency: daysUntil < 0 ? 'overdue' : daysUntil === 0 ? 'today' : 'upcoming' });
    }
  }
  return out.sort((a, b) => ORDER[a.urgency] - ORDER[b.urgency] || (a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : 0));
}
