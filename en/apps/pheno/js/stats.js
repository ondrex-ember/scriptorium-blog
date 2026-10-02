// Pure statistics: per-plant summary and variety aggregation (spec 5.4). No DOM, no IO.
import { CATEGORIES } from './config-categories.js';
import { STAGE_FLAGS } from './config-categories.js';
import { liveEvents } from './model.js';
import { daysBetween, mean, normalizeKey } from './utils.js';

const overallOf = (e) => e.payload?.scores?.overall;
const validOverall = (e) => Number.isFinite(overallOf(e));

/** Yield field used for comparison: the first harvest field of the category (its unit). */
export const yieldKey = (category) => CATEGORIES[category]?.harvestFields[0]?.key ?? null;

/** Current evaluations: latest live one; perennial harvestable plants keep the latest per season. */
export function currentEvaluations(plant, events) {
  const evs = liveEvents(events).filter((e) => e.type === 'evaluation' && validOverall(e));
  if (plant.lifecycle !== 'perennial') return evs.length ? [evs.at(-1)] : [];
  const bySeason = new Map();
  for (const e of evs) bySeason.set(e.payload.season ?? null, e);
  return [...bySeason.values()].sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1));
}

/** Latest live evaluation (the one the form is prefilled from). */
export function latestEvaluation(events, season) {
  const evs = liveEvents(events).filter((e) => e.type === 'evaluation' && validOverall(e)
    && (season === undefined || (e.payload.season ?? null) === season));
  return evs.at(-1) ?? null;
}

/** History rows, newest first: date, days after last harvest, overall, note. */
export function evaluationHistory(events) {
  const live = liveEvents(events);
  const harvests = live.filter((e) => e.type === 'harvest');
  return live.filter((e) => e.type === 'evaluation' && validOverall(e)).reverse().map((e) => {
    const prev = harvests.filter((h) => h.occurredAt <= e.occurredAt).at(-1);
    return {
      event: e, at: e.occurredAt, overall: overallOf(e), note: e.payload.note || '', season: e.payload.season ?? null,
      daysAfterHarvest: prev ? daysBetween(prev.occurredAt, e.occurredAt) : (e.payload.daysSinceLastHarvest ?? null)
    };
  });
}

/** Sum of every numeric harvest field over live harvests. */
export function harvestTotals(plant, events) {
  const totals = {};
  for (const f of CATEGORIES[plant.category].harvestFields) {
    totals[f.key] = liveEvents(events).filter((e) => e.type === 'harvest')
      .reduce((s, e) => s + (Number.isFinite(e.payload[f.key]) ? e.payload[f.key] : 0), 0);
  }
  return totals;
}

/** One plant in numbers. */
export function plantSummary(plant, events) {
  const live = liveEvents(events);
  const harvests = live.filter((e) => e.type === 'harvest');
  const evals = currentEvaluations(plant, events);
  const yk = yieldKey(plant.category);
  const yieldSum = harvests.reduce((s, e) => s + (Number.isFinite(e.payload[yk]) ? e.payload[yk] : 0), 0);
  const seasons = plant.lifecycle === 'perennial'
    ? new Set(harvests.map((e) => new Date(e.occurredAt).getFullYear())).size
    : (harvests.length ? 1 : 0);
  let cycleDays = null;
  if (plant.lifecycle !== 'perennial') {
    const end = live.filter((e) => e.type === 'stage_change' && STAGE_FLAGS[e.payload.to]?.terminal).at(-1)
      ?? harvests.at(-1);
    if (end) cycleDays = daysBetween(plant.startDate, end.occurredAt);
  }
  const overall = evals.length ? mean(evals.map(overallOf)) : null;
  const last = latestEvaluation(events);
  return {
    plantId: plant.id, harvestCount: harvests.length, seasons, yield: yieldSum, yieldKey: yk,
    overall, wouldGrowAgain: last && last.payload.wouldGrowAgain != null ? !!last.payload.wouldGrowAgain : null,
    cycleDays, problems: live.filter((e) => e.type === 'problem').length, evaluated: evals.length > 0
  };
}

/** Group key of a plant: its variety, or its own name when the variety is empty (flagged as unnamed). */
export function varietyGroupKey(plant) {
  const key = plant.varietyKey || normalizeKey(plant.variety);
  return key ? { key, unnamed: false } : { key: normalizeKey(plant.name), unnamed: true };
}

const avg = (xs) => (xs.length ? mean(xs) : null);

/** Statistics per (category, varietyKey). Yield is only meaningful inside one category. */
export function aggregateVarieties(plants, byPlant) {
  const groups = new Map();
  for (const plant of plants) {
    const { key, unnamed } = varietyGroupKey(plant);
    const gk = `${plant.category}|${key}`;
    if (!groups.has(gk)) groups.set(gk, { category: plant.category, key, unnamed, items: [] });
    groups.get(gk).items.push({ plant, summary: plantSummary(plant, byPlant.get(plant.id) || []) });
  }
  return [...groups.values()].map((g) => {
    const items = g.items.sort((a, b) => (a.plant.startDate < b.plant.startDate ? 1 : -1));
    const sums = items.map((i) => i.summary);
    const rated = sums.filter((s) => s.overall != null);
    const grow = sums.filter((s) => s.wouldGrowAgain != null);
    const harvested = sums.filter((s) => s.harvestCount > 0);
    const totalYield = sums.reduce((s, x) => s + x.yield, 0);
    return {
      category: g.category, key: g.key, unnamed: g.unnamed,
      label: g.unnamed ? items[0].plant.name : (items[0].plant.variety || g.key),
      items, plantCount: items.length,
      cycles: sums.reduce((s, x) => s + x.seasons, 0),
      avgOverall: avg(rated.map((s) => s.overall)),
      wouldGrowAgainShare: grow.length ? grow.filter((s) => s.wouldGrowAgain).length / grow.length : null,
      totalYield, yieldPerPlant: harvested.length ? totalYield / harvested.length : null,
      yieldKey: yieldKey(g.category),
      avgCycleDays: avg(sums.filter((s) => s.cycleDays != null).map((s) => s.cycleDays)),
      problemsPerPlant: sums.reduce((s, x) => s + x.problems, 0) / items.length
    };
  }).sort((a, b) => (b.avgOverall ?? -1) - (a.avgOverall ?? -1) || b.plantCount - a.plantCount);
}

/** Overview numbers for the varieties screen header. */
export function overviewNumbers(plants, byPlant) {
  const sums = plants.map((p) => plantSummary(p, byPlant.get(p.id) || []));
  return {
    plants: plants.length, archived: plants.filter((p) => p.archivedAt).length,
    harvests: sums.reduce((s, x) => s + x.harvestCount, 0), evaluated: sums.filter((x) => x.evaluated).length
  };
}
