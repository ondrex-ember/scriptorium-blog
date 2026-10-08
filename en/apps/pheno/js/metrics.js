// Derived metrics (RCv0.193). Pure functions over plants and events; no schema change, no DOM, no IO.
// Rules: a missing input gives null (never zero); only like is compared with like (category, and a flag when
// environments are mixed); n is always reported and n < 3 is "orientační"; a correlation needs n ≥ 8 and is a
// pattern, never a cause; there are no user formulas (nothing is evaluated).
import { harvestWeightG } from './calendar.js';
import { STAGE_FLAGS } from './config-categories.js';
import { resolveRules } from './config-rules.js';
import { liveEvents } from './model.js';
import { plantSummary } from './stats.js';
import { consumptionRate, convertAmount } from './stock.js';
import { S } from './strings.cs.js';
import { daysBetween, isNum, mean } from './utils.js';

export const MIN_N = 3;           // below this a figure is shown as provisional
export const MIN_CORRELATION_N = 8;
const rules = resolveRules();
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/** Days a plant was cared for: the finished cycle, else start → archive/now. null when shorter than a day. */
function careSpan(plant, summary, now) {
  const d = summary.cycleDays ?? daysBetween(plant.startDate, plant.archivedAt ?? now);
  return d >= 1 ? d : null;
}

const totalWeightG = (live) => {
  const ws = live.filter((e) => e.type === 'harvest').map((e) => harvestWeightG(e.payload || {})).filter(isNum);
  return ws.length ? ws.reduce((a, b) => a + b, 0) : null;
};

/**
 * The registry. compute({plant, live, summary, now}) → number | null.
 * better: 'higher' | 'lower' | null (null = no value judgement). digits: display precision.
 */
export const METRICS = [
  { key: 'yieldPerDay', unit: 'g/den', scope: 'plant', better: 'higher', digits: 2,
    compute: ({ live, summary }) => {
      const g = totalWeightG(live);
      return g != null && g > 0 && summary.cycleDays >= 1 ? round(g / summary.cycleDays) : null;
    } },
  { key: 'yieldPerLiter', unit: 'g/l', scope: 'plant', better: 'higher', digits: 1,
    compute: ({ plant, live }) => {
      const g = totalWeightG(live);
      const l = plant.cache?.pot?.volumeL ?? plant.potVolumeL;
      return g != null && g > 0 && isNum(l) && l > 0 ? round(g / l, 1) : null;
    } },
  { key: 'processedRatio', unit: '%', scope: 'plant', better: null, digits: 0,
    compute: ({ live }) => {
      const hs = live.filter((e) => e.type === 'harvest' && isNum(e.payload.freshWeight) && e.payload.freshWeight > 0 && isNum(e.payload.processedWeight));
      if (!hs.length) return null;
      const fresh = hs.reduce((s, e) => s + e.payload.freshWeight, 0);
      return round(100 * hs.reduce((s, e) => s + e.payload.processedWeight, 0) / fresh, 1);
    } },
  { key: 'wateringsPerWeek', unit: '×/týden', scope: 'plant', better: null, digits: 1,
    compute: ({ plant, live, summary, now }) => {
      const span = careSpan(plant, summary, now);
      const n = live.filter((e) => e.type === 'watering' || (e.type === 'moisture_check' && e.payload.watered)).length;
      return span != null && span >= 7 && n > 0 ? round(n / (span / 7), 1) : null;
    } },
  { key: 'fertilizingsPerCycle', unit: '×', scope: 'plant', better: null, digits: 0,
    compute: ({ live, summary }) => {
      const n = live.filter((e) => e.type === 'fertilizing').length;
      return summary.cycleDays != null && n > 0 ? n : null;
    } },
  { key: 'problemsPer100Days', unit: '/100 dní', scope: 'plant', better: 'lower', digits: 1,
    compute: ({ plant, live, summary, now }) => {
      const span = careSpan(plant, summary, now);
      return span != null && span >= 14 ? round(100 * live.filter((e) => e.type === 'problem').length / span, 1) : null;
    } },
  { key: 'problemResolveDays', unit: 'dní', scope: 'plant', better: 'lower', digits: 1,
    compute: ({ live }) => {
      const at = new Map(live.filter((e) => e.type === 'problem').map((e) => [e.id, e.occurredAt]));
      const days = live.filter((e) => e.type === 'problem_resolved' && at.has(e.payload.problemId))
        .map((e) => daysBetween(at.get(e.payload.problemId), e.occurredAt)).filter((d) => d >= 0);
      return days.length ? round(mean(days), 1) : null;
    } },
  { key: 'growAgain', unit: '%', scope: 'plant', better: 'higher', digits: 0,
    compute: ({ summary }) => (summary.wouldGrowAgain == null ? null : (summary.wouldGrowAgain ? 100 : 0)) },
  { key: 'stockPerDay', unit: 'g/den', scope: 'plant', better: null, digits: 1,
    compute: ({ plant, now }) => {
      const unit = [...(plant.cache?.batches || [])].reverse().find((b) => b.stock)?.stock.unit;
      if (!unit || unit === 'ks') return null;
      const rate = consumptionRate(plant, now, rules, unit);
      const g = rate ? convertAmount(rate.perDay, unit, 'g') : null;
      return g != null ? round(g, 1) : null;
    } }
];
export const metricLabel = (key) => S.metrics.items[key] ?? key;
export const metricDef = (key) => METRICS.find((m) => m.key === key) ?? null;

/** All plant-scope metrics of one plant: {key: number|null}. `events` are raw (voids are handled here). */
export function metricsFor(plant, events, now, summary) {
  const live = liveEvents(events);
  const ctx = { plant, live, summary: summary ?? plantSummary(plant, events), now };
  return Object.fromEntries(METRICS.map((m) => [m.key, m.compute(ctx)]));
}

/** Format a value with its unit; '—' when null. */
export function fmtMetric(def, value) {
  if (value == null) return '—';
  const text = value.toLocaleString('cs-CZ', { maximumFractionDigits: def.digits, minimumFractionDigits: 0 });
  return `${text} ${def.unit}`;
}

/**
 * Aggregate one metric over rows [{plant, values}]: n, mean, min, max and honesty flags.
 * mixedEnv: contributing plants grow in different environments; provisional: n < MIN_N or mixed.
 */
export function aggregateMetric(rows, key) {
  const vals = rows.filter((r) => isNum(r.values[key]));
  if (!vals.length) return { key, n: 0, mean: null, min: null, max: null, mixedEnv: false, provisional: true };
  const xs = vals.map((r) => r.values[key]);
  const mixedEnv = new Set(vals.map((r) => r.plant.environment)).size > 1;
  return { key, n: xs.length, mean: round(mean(xs), 3), min: Math.min(...xs), max: Math.max(...xs), mixedEnv, provisional: xs.length < MIN_N || mixedEnv };
}

/** Per-plant values and per-metric aggregates of one variety group (an item of aggregateVarieties). */
export function varietyMetrics(group, byPlant, now) {
  const rows = group.items.map(({ plant, summary }) => ({ plant, values: metricsFor(plant, byPlant.get(plant.id) || [], now, summary) }));
  return { rows, aggregates: METRICS.map((m) => aggregateMetric(rows, m.key)).filter((a) => a.n > 0) };
}

// ---------- stage durations ----------

/** Completed stage durations of a plant in days: {stage: days}. The stage still running (or terminal) is not counted. */
export function stageDurations(plant, events) {
  const changes = liveEvents(events).filter((e) => e.type === 'stage_change');
  if (!changes.length) return {};
  const marks = [{ stage: changes[0].payload.from, at: plant.startDate }, ...changes.map((e) => ({ stage: e.payload.to, at: e.occurredAt }))];
  const out = {};
  for (let i = 0; i < marks.length - 1; i++) {
    const { stage, at } = marks[i];
    if (!stage || STAGE_FLAGS[stage]?.terminal) continue;
    const d = daysBetween(at, marks[i + 1].at);
    if (d >= 0) out[stage] = round((out[stage] ?? 0) + d, 1);
  }
  return out;
}

/** Per stage across a variety: [{stage, n, mean, byPlant:{id: days}}], longest-mean order not implied (stage order of first plant). */
export function stageStats(items, byPlant) {
  const acc = new Map();
  for (const { plant } of items) {
    for (const [stage, days] of Object.entries(stageDurations(plant, byPlant.get(plant.id) || []))) {
      if (!acc.has(stage)) acc.set(stage, { stage, n: 0, sum: 0, byPlant: {} });
      const a = acc.get(stage);
      a.n += 1; a.sum += days; a.byPlant[plant.id] = days;
    }
  }
  return [...acc.values()].map((a) => ({ stage: a.stage, n: a.n, mean: round(a.sum / a.n, 1), byPlant: a.byPlant, provisional: a.n < MIN_N }));
}

// ---------- patterns (correlation) ----------

function ranks(xs) {
  const idx = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(xs.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j += 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}

/** Spearman rank correlation; null for fewer than 2 pairs or no variation. */
export function spearman(xs, ys) {
  if (xs.length < 2 || xs.length !== ys.length) return null;
  const a = ranks(xs), b = ranks(ys);
  const ma = mean(a), mb = mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da === 0 || db === 0 ? null : round(num / Math.sqrt(da * db), 3);
}
export const strengthOf = (r) => (Math.abs(r) >= 0.6 ? 'strong' : Math.abs(r) >= 0.4 ? 'medium' : 'weak');

/**
 * Patterns inside one category (never across): yield vs rating and problems vs rating. Only from n ≥ 8 pairs
 * and only when |r| ≥ 0.3. Returned as observations, not causes.
 */
export function patterns(plants, byPlant, now) {
  const out = [];
  const cats = [...new Set(plants.map((p) => p.category))];
  for (const category of cats) {
    const rows = plants.filter((p) => p.category === category).map((p) => {
      const evs = byPlant.get(p.id) || [];
      const sum = plantSummary(p, evs);
      return { values: metricsFor(p, evs, now, sum), overall: sum.overall, yieldG: totalWeightG(liveEvents(evs)) };
    }).filter((r) => r.overall != null);
    const pairs = [
      ['yieldRating', rows.filter((r) => r.yieldG != null && r.yieldG > 0).map((r) => [r.yieldG, r.overall])],
      ['problemsRating', rows.filter((r) => r.values.problemsPer100Days != null).map((r) => [r.values.problemsPer100Days, r.overall])]
    ];
    for (const [id, ps] of pairs) {
      if (ps.length < MIN_CORRELATION_N) continue;
      const r = spearman(ps.map((p) => p[0]), ps.map((p) => p[1]));
      if (r != null && Math.abs(r) >= 0.3) out.push({ id, category, n: ps.length, r, direction: r > 0 ? 'up' : 'down', strength: strengthOf(r) });
    }
  }
  return out;
}

// ---------- storage by method ----------

/**
 * Closed containers grouped by their storage method: how many, how much was thrown away, and the real shelf life
 * (time until mold or discard; containers that were simply eaten do not count as spoiled).
 */
export function storageStats(plants) {
  const acc = {};
  for (const pl of plants) {
    for (const b of pl.cache?.batches || []) {
      for (const k of b.stock?.containers || []) {
        if (k.status === 'open' || !isNum(k.initial) || k.initial <= 0) continue;
        const m = acc[k.method] || (acc[k.method] = { method: k.method, n: 0, loss: [], life: [] });
        m.n += 1;
        m.loss.push((k.discarded || 0) / k.initial);
        const spoiledAt = k.moldAt ?? (k.discarded > 0 || k.status === 'discarded' ? k.endedAt : null);
        if (spoiledAt) m.life.push(daysBetween(k.since, spoiledAt));
      }
    }
  }
  return Object.values(acc).map((m) => ({
    method: m.method, n: m.n, lossShare: round(mean(m.loss), 3), spoiledN: m.life.length,
    shelfLifeDays: m.life.length ? Math.round(mean(m.life)) : null, provisional: m.n < MIN_N
  })).sort((a, b) => b.n - a.n);
}
