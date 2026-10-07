// Stock after harvest (RCv0.192): containers per batch, withdrawals, storage method, quality decay, consumption forecast.
// Pure: no DOM, no storage. The event projection (applyStockEvent) is called by the calendar projector; everything
// else is computed at read time from the projected data plus the storage catalogue, so editing the catalogue
// never needs a rebuild.
import { BATCH_ENDED, FRESH_CATEGORIES } from './config-categories.js';
import { rv } from './config-rules.js';
import { presetFor, resolveMethods, varietyKey } from './stockcfg.js';
import { addDays, clamp, daysBetween, isNum } from './utils.js';

export const STOCK_UNITS = ['g', 'kg', 'ks'];
export const STOCK_EVENT_TYPES = ['stock_init', 'stock_use', 'stock_adjust', 'stock_move', 'stock_check'];
export const MAX_CONTAINERS = 12;
const EPS = 1e-9;
const LN2 = Math.LN2;
const MAX_OPEN_LOSS = 0.3;
const round3 = (v) => Math.round(v * 1000) / 1000;
const round2 = (v) => Math.round(v * 100) / 100;
const dayMs = 864e5;

const findBatch = (c, id) => (c.batches || []).find((b) => b.id === id) ?? null;
const findContainer = (st, id) => st?.containers.find((k) => k.id === id) ?? null;

// ---------- units ----------

/** Unit a plant's stock is counted in by default. */
export const defaultUnit = (plant) => (plant.category === 'herb' ? 'g' : FRESH_CATEGORIES.includes(plant.category) ? 'kg' : 'ks');

/** Convert between g and kg; pieces only convert to pieces. null when impossible. */
export function convertAmount(amount, from, to) {
  if (from === to) return amount;
  if (from === 'g' && to === 'kg') return amount / 1000;
  if (from === 'kg' && to === 'g') return amount * 1000;
  return null;
}

/** Fresh produce (eaten as harvested) decays on a different clock than dried or otherwise processed material. */
export const batchMaterial = (b) => (b.fresh && (b.method == null || b.method === 'none') ? 'fresh' : 'processed');

// ---------- projection ----------

function newContainer(spec, at, source) {
  return {
    id: spec.id, label: spec.label ?? '', method: spec.method, amount: round3(spec.amount), initial: round3(spec.amount),
    since: source?.since ?? at, segments: source?.segments ? [...source.segments, { method: spec.method, from: at }] : [{ method: spec.method, from: at }],
    opens: 0, used: 0, discarded: 0, lastOpenAt: null, lastCheckAt: null, lastAirAt: at, moldAt: null,
    checks: [], status: 'open', endedAt: null, parent: source?.id ?? null
  };
}

function closeIfEmpty(k, at, discard) {
  if (k.amount > EPS) return;
  k.amount = 0;
  k.status = discard && k.used <= EPS ? 'discarded' : 'empty';
  k.endedAt = at;
}

/** A batch whose containers are all closed is used up (or discarded when nothing was ever eaten). */
function endBatchIfDone(b, at) {
  const st = b.stock;
  if (!st || BATCH_ENDED.includes(b.phase) || st.containers.some((k) => k.status === 'open')) return;
  const phase = st.uses.length ? 'used' : 'discarded';
  b.phase = phase; b.phaseSince = at; b.endedAt = at;
  b.steps.push({ at, phase });
}

/** Apply one stock_* event to the projected batches (cache `c`). Tolerant: impossible events are ignored, amounts clamped. */
export function applyStockEvent(c, e) {
  const p = e.payload || {};
  const b = findBatch(c, p.batchId);
  if (!b) return;
  const at = e.occurredAt;
  if (e.type === 'stock_init') {
    if (b.stock || !Array.isArray(p.containers)) return;
    const containers = p.containers.map((s) => newContainer(s, at));
    b.stock = {
      id: e.id, unit: p.unit, source: p.source ?? 'weighed', at, containers, uses: [], firstUseAt: null,
      initial: round3(containers.reduce((n, k) => n + k.initial, 0))
    };
    return;
  }
  const st = b.stock;
  if (!st || st.id !== p.stockId) return;
  const k = findContainer(st, p.containerId);
  if (!k || k.status !== 'open') return;
  switch (e.type) {
    case 'stock_use': {
      const amt = Math.min(p.amount, k.amount);
      if (!(amt > 0)) return;
      k.amount = round3(k.amount - amt);
      if (p.kind === 'discard') k.discarded = round3(k.discarded + amt);
      else {
        st.uses.push({ at, amount: round3(amt), containerId: k.id });
        k.used = round3(k.used + amt); k.opens += 1; k.lastOpenAt = at; k.lastAirAt = at;
        st.firstUseAt = st.firstUseAt ?? at;
      }
      closeIfEmpty(k, at, p.kind === 'discard');
      break;
    }
    case 'stock_adjust': {
      const diff = k.amount - p.remaining;
      if (diff > EPS) {
        st.uses.push({ at, amount: round3(diff), containerId: k.id, adjust: true });
        k.used = round3(k.used + diff);
        st.firstUseAt = st.firstUseAt ?? at;
      } else if (diff < -EPS) { k.initial = round3(k.initial - diff); st.initial = round3(st.initial - diff); }
      k.amount = round3(p.remaining);
      closeIfEmpty(k, at, false);
      break;
    }
    case 'stock_move': {
      if (p.method === k.method && !(p.amount > 0 && p.amount < k.amount - EPS)) return;
      if (p.amount > 0 && p.amount < k.amount - EPS) {
        const part = newContainer({ id: p.newContainerId, label: p.label ?? k.label, method: p.method, amount: p.amount }, at, k);
        part.checks = [];
        k.amount = round3(k.amount - p.amount);
        k.opens += 1; k.lastOpenAt = at; k.lastAirAt = at;
        st.containers.push(part);
      } else {
        k.segments.push({ method: p.method, from: at });
        k.method = p.method; k.opens = 0; k.lastAirAt = at;
        if (p.label) k.label = p.label;
      }
      break;
    }
    case 'stock_check': {
      const hasRating = isNum(p.scent) || isNum(p.appearance);
      // a bare "aired" tick only resets the airing clock; any rating, mold flag, humidity or note is a real check
      if (hasRating || p.mold != null || p.rh != null || p.note) {
        k.checks.push({
          at, scent: p.scent ?? null, appearance: p.appearance ?? null, mold: !!p.mold, rh: p.rh ?? null, rated: hasRating,
          method: k.method
        });
        k.lastCheckAt = at;
        if (p.mold) k.moldAt = at;
      }
      if (p.aired) k.lastAirAt = at;
      break;
    }
    default:
      break;
  }
  endBatchIfDone(b, at);
}

// ---------- quality model ----------

/** Maturing days of the container's first storage segment (0 for fresh produce). */
function maturingFor(seg, preset, M, material) {
  if (material === 'fresh') return 0;
  const m = M[seg.method] ?? M.other;
  return preset && preset.method === seg.method && isNum(preset.maturingDays) ? preset.maturingDays : m.maturingDays;
}

/** Model age in half-lives: Σ (decaying days ÷ (half-life × material factor)) over the container's storage segments. */
export function modelAge(k, at, M, material, preset) {
  const end = Date.parse(at);
  const kFactor = preset?.kFactor ?? 1;
  let x = 0;
  k.segments.forEach((seg, i) => {
    const from = Date.parse(seg.from);
    const to = i + 1 < k.segments.length ? Date.parse(k.segments[i + 1].from) : end;
    let days = Math.max(0, Math.min(to, end) - from) / dayMs;
    if (i === 0) days = Math.max(0, days - maturingFor(seg, preset, M, material));
    const m = M[seg.method] ?? M.other;
    x += days / ((material === 'fresh' ? m.tHalfFresh : m.tHalfProcessed) * kFactor);
  });
  return x;
}

const ratingToQ = (r) => 0.15 + (clamp(r, 1, 5) - 1) * 0.1925;   // 1 → 15 %, 5 → 92 %

/** Decay ratio observed in one container's rated checks: > 1 decays slower than the model, < 1 faster. */
export function ownRatio(k, M, material, preset) {
  const obs = [];
  for (const ch of k.checks) {
    if (ch.mold) continue;
    const r = [ch.scent, ch.appearance].filter(isNum);
    if (!r.length) continue;
    const x = modelAge(k, ch.at, M, material, preset);
    if (x < 0.12) continue;
    const q = ratingToQ(r.reduce((a, b) => a + b, 0) / r.length);
    obs.push({ r: clamp((LN2 * x) / -Math.log(q), 0.25, 4), w: Math.min(x, 1) });
  }
  const recent = obs.slice(-5);
  if (!recent.length) return null;
  const w = recent.reduce((a, o) => a + o.w, 0);
  return { r: round2(recent.reduce((a, o) => a + o.r * o.w, 0) / w), n: recent.length };
}

/** Learned decay priors across plants: per method and per method + variety (the latter from 2 containers). */
export function buildStockPriors(plants, cfg) {
  const M = resolveMethods(cfg);
  const byMethod = {}, byVariety = {};
  const add = (map, key, r) => { const m = map[key] || (map[key] = { sum: 0, n: 0 }); m.sum += r; m.n += 1; };
  for (const pl of plants) {
    const preset = presetFor(pl, cfg);
    const vk = (pl.variety || '').trim() ? varietyKey(pl) : null;
    for (const b of pl.cache?.batches || []) {
      for (const k of b.stock?.containers || []) {
        const o = ownRatio(k, M, batchMaterial(b), preset);
        if (!o) continue;
        add(byMethod, k.method, o.r);
        if (vk) add(byVariety, `${k.method}|${vk}`, o.r);
      }
    }
  }
  const fin = (map, min) => Object.fromEntries(Object.entries(map).filter(([, m]) => m.n >= min).map(([k, m]) => [k, { r: round2(m.sum / m.n), n: m.n }]));
  return { method: fin(byMethod, 1), variety: fin(byVariety, 2) };
}

/** Decay ratio used for a container: own checks shrunk towards the variety/method prior (or 1). */
export function decayRatio(plant, k, own, priors) {
  const vk = (plant.variety || '').trim() ? varietyKey(plant) : null;
  const prior = (vk && priors?.variety?.[`${k.method}|${vk}`]) || priors?.method?.[k.method] || null;
  const base = prior?.r ?? 1;
  if (!own) return { r: base, source: prior ? 'prior' : 'default', n: 0 };
  return { r: round2((own.r * own.n + base) / (own.n + 1)), source: 'own', n: own.n };
}

/**
 * Quality state of one container at `now`: q (0–1), model age, maturing flag, and the date the quality reaches the
 * use-by threshold (null when it is already below it or never within reach).
 */
export function containerState(plant, batch, k, now, env = {}) {
  const M = env.methods ?? resolveMethods(env.cfg);
  const preset = env.preset ?? presetFor(plant, env.cfg);
  const material = batchMaterial(batch);
  const x = modelAge(k, now, M, material, preset);
  const own = ownRatio(k, M, material, preset);
  const dr = decayRatio(plant, k, own, env.priors?.stock);
  const cur = M[k.method] ?? M.other;
  const openLoss = Math.min(MAX_OPEN_LOSS, cur.openCost * k.opens);
  const decay = Math.exp((-LN2 * x) / dr.r);
  const q = clamp(decay * (1 - openLoss), 0, 1);
  const threshold = (preset?.useByPct ?? rv(env.rules, 'stock.useByPct')) / 100;
  const seg0 = k.segments[0];
  const matureEnd = k.segments.length === 1 ? addDays(seg0.from, maturingFor(seg0, preset, M, material)) : null;
  const maturing = !!matureEnd && matureEnd > now;
  let useByAt = null, below = false;
  if (q <= threshold + 1e-9) below = true;
  else {
    const needX = (-dr.r * Math.log(threshold / (1 - openLoss))) / LN2;   // model age at which q hits the threshold
    const th = (material === 'fresh' ? cur.tHalfFresh : cur.tHalfProcessed) * (preset?.kFactor ?? 1);
    const days = Math.max(0, needX - x) * th + (maturing ? daysBetween(now, matureEnd) : 0);
    useByAt = days < 36500 ? addDays(now, days) : null;
  }
  return { q, pct: Math.round(q * 100), x, ratio: dr, maturing, maturingUntil: maturing ? matureEnd : null, useByAt, below, threshold, method: cur };
}

// ---------- plant-level stock and consumption ----------

/** Open amount of a batch in its own unit. */
export const batchRemaining = (b) => round3((b.stock?.containers || []).filter((k) => k.status === 'open').reduce((n, k) => n + k.amount, 0));

/** Average consumption per day over the recent window, in `unit`; null before enough history. */
export function consumptionRate(plant, now, rules, unit) {
  const uses = [];
  for (const b of plant.cache?.batches || []) {
    if (!b.stock) continue;
    for (const u of b.stock.uses) {
      const amt = convertAmount(u.amount, b.stock.unit, unit);
      if (amt != null) uses.push({ at: u.at, amount: amt });
    }
  }
  if (!uses.length) return null;
  const first = uses.reduce((a, u) => (u.at < a ? u.at : a), uses[0].at);
  const span = daysBetween(first, now);
  if (span < rv(rules, 'stock.minRateDays')) return null;
  const w = Math.min(rv(rules, 'stock.rateWindowDays'), span);
  const from = addDays(now, -w);
  const sum = uses.filter((u) => u.at >= from).reduce((n, u) => n + u.amount, 0);
  return sum > 0 ? { perDay: sum / w, windowDays: w } : null;
}

/** Everything the UI and the task engine need about a plant's stock, or null when it has none. */
export function plantStock(plant, now, env = {}) {
  const batches = (plant.cache?.batches || []).filter((b) => b.stock);
  if (!batches.length) return null;
  const M = resolveMethods(env.cfg), preset = presetFor(plant, env.cfg);
  const e = { ...env, methods: M, preset };
  const unit = batches.at(-1).stock.unit;
  let remaining = 0;
  const list = batches.map((b) => {
    const containers = b.stock.containers.map((k) => ({ k, state: k.status === 'open' ? containerState(plant, b, k, now, e) : null }));
    const left = batchRemaining(b);
    const conv = convertAmount(left, b.stock.unit, unit);
    if (conv != null) remaining += conv;
    return { batch: b, stock: b.stock, containers, remaining: left };
  });
  const rate = consumptionRate(plant, now, env.rules, unit);
  const runOutDays = rate && remaining > 0 ? remaining / rate.perDay : null;
  return {
    unit, remaining: round3(remaining), rate, runOutDays, runOutAt: runOutDays != null ? addDays(now, runOutDays) : null,
    batches: list, preset, methods: M
  };
}

// ---------- tasks ----------

/** Tasks for a plant's stock: container checks, airing, use-by, low stock. Dates only; the calendar filters snoozes. */
export function stockTasks(plant, now, env = {}) {
  const ps = plantStock(plant, now, env);
  if (!ps) return [];
  const out = [];
  const M = ps.methods;
  for (const { batch, containers } of ps.batches) {
    if (BATCH_ENDED.includes(batch.phase) && !containers.some(({ k }) => k.status === 'open')) continue;
    for (const { k, state } of containers) {
      if (k.status !== 'open' || !state) continue;
      const m = M[k.method] ?? M.other;
      const segFrom = k.segments.at(-1).from;
      const label = k.label || m.label;
      const base = { batchId: batch.id, containerId: k.id, note: label };
      const lastRef = [segFrom, k.lastCheckAt].filter(Boolean).reduce((a, x) => (x > a ? x : a));
      let due = addDays(lastRef, ps.preset.checkDays ?? m.checkDays);
      const sibling = containers.find(({ k: o }) => o !== k && o.moldAt && (!k.lastCheckAt || k.lastCheckAt < o.moldAt));
      if (sibling) due = sibling.k.moldAt < due ? sibling.k.moldAt : due;
      out.push({ type: 'stockCheck', due, snoozeKey: `stockCheck:${k.id}`, ...base });
      const age = daysBetween(segFrom, now);
      if (m.airEveryDays > 0 && age < m.airForDays) {
        out.push({ type: 'stockAir', due: addDays(k.lastAirAt ?? segFrom, m.airEveryDays), snoozeKey: `stockAir:${k.id}`, ...base });
      }
      if (!state.maturing && (state.below || state.useByAt)) {
        out.push({ type: 'stockUseBy', due: state.below ? now : state.useByAt, snoozeKey: `stockUseBy:${k.id}`, ...base });
      }
    }
  }
  const lowDays = rv(env.rules, 'stock.lowDays');
  if (ps.runOutDays != null && ps.runOutDays < lowDays) {
    out.push({ type: 'stockLow', due: now, snoozeKey: 'stockLow', note: `~${Math.max(1, Math.round(ps.runOutDays))}`, batchId: ps.batches.find((x) => x.remaining > 0)?.batch.id });
  }
  return out;
}

// ---------- suggestions and comparison ----------

/** Starting amount for a new stock: processed weight if entered, else fresh weight × the ratio learned from earlier weighed batches. */
export function suggestInitial(plant, batch) {
  const unit = defaultUnit(plant);
  if (isNum(batch.processedG) && batch.processedG > 0 && unit === 'g') return { amount: batch.processedG, unit, basis: 'processed' };
  const w = batch.weightG;
  if (!isNum(w) || w <= 0) return { amount: null, unit, basis: 'none' };
  if (batchMaterial(batch) === 'fresh') return { amount: unit === 'kg' ? round3(w / 1000) : round3(w), unit, basis: 'fresh' };
  const done = (plant.cache?.batches || []).filter((x) => x.stock?.source === 'weighed' && isNum(x.weightG) && x.weightG > 0 && x.stock.unit === 'g' && x.id !== batch.id);
  if (done.length) {
    const r = done.reduce((n, x) => n + x.stock.initial / x.weightG, 0) / done.length;
    return { amount: round3(w * r), unit: 'g', basis: 'learned', ratio: round2(r) };
  }
  return { amount: unit === 'g' ? round3(w * 0.25) : null, unit, basis: 'default', ratio: 0.25 };
}

/** Rated checks grouped by the storage method in force: how well each method held up, overall and after 60+ days. */
export function methodComparison(plants) {
  const acc = {};
  for (const pl of plants) {
    for (const b of pl.cache?.batches || []) {
      for (const k of b.stock?.containers || []) {
        for (const ch of k.checks) {
          const r = [ch.scent, ch.appearance].filter(isNum);
          if (!r.length || ch.mold) continue;
          const m = acc[ch.method] || (acc[ch.method] = { method: ch.method, n: 0, sum: 0, lateN: 0, lateSum: 0, ageSum: 0 });
          const rating = r.reduce((a, x) => a + x, 0) / r.length;
          const age = daysBetween(k.since, ch.at);
          m.n += 1; m.sum += rating; m.ageSum += age;
          if (age >= 60) { m.lateN += 1; m.lateSum += rating; }
        }
      }
    }
  }
  return Object.values(acc).map((m) => ({
    method: m.method, n: m.n, avg: round2(m.sum / m.n), avgAge: Math.round(m.ageSum / m.n),
    lateN: m.lateN, lateAvg: m.lateN ? round2(m.lateSum / m.lateN) : null
  })).sort((a, b) => (b.lateAvg ?? b.avg) - (a.lateAvg ?? a.avg));
}
