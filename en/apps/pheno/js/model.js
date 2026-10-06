// Plant model: pure construction helpers and projectPlant (replay of the event log).
import { CATEGORIES, ENVIRONMENTS, SOURCES, getStages } from './config-categories.js';
import { PEST_BOOST_DAYS } from './config-engine.js';
import { SUBSTRATES } from './config-rules.js';
import { S } from './strings.cs.js';
import { PhenoError, addDays, compareEvents, normalizeKey, nowIso, uid } from './utils.js';

const projectors = [];
/** Extension point: {init(ctx), apply(event, ctx), finalize(ctx)}; ctx = {plant, cache, events, opts}. Used by calendar.js (S2). */
export function registerProjector(p) { if (!projectors.includes(p)) projectors.push(p); }
export function unregisterProjector(p) { const i = projectors.indexOf(p); if (i >= 0) projectors.splice(i, 1); }
export function clearProjectors() { projectors.length = 0; }

export function emptyCache(prev) {
  return {
    stage: null, stageSince: null, environment: null,
    lastWateredAt: null, lastFertilizedAt: null, lastPestCheckAt: null,
    openProblems: [], pestBoostUntil: null,
    snoozedUntil: { ...(prev?.snoozedUntil || {}) },
    soilDryDays: {}, confidence: {}, batches: [],
    cacheRev: null
  };
}

/** Events that count: void events and the events they void are dropped. */
export function liveEvents(events) {
  const voided = new Set(events.filter((e) => e.type === 'void').map((e) => e.payload.targetId));
  return events.filter((e) => e.type !== 'void' && !voided.has(e.id)).sort(compareEvents);
}

/** Pure: rebuild plant.cache and archivedAt from events. Same input, same output. */
export function projectPlant(plant, events, opts = {}) {
  const live = liveEvents(events);
  const cache = emptyCache(plant.cache);
  let archivedAt = null;
  const ctx = { plant, cache, events: live, opts };
  for (const p of projectors) p.init?.(ctx);
  for (const e of live) {
    const p = e.payload || {};
    switch (e.type) {
      case 'created':
        cache.environment = p.environment;
        break;
      case 'stage_change':
        cache.stage = p.to; cache.stageSince = e.occurredAt;
        break;
      case 'environment_change':
        cache.environment = p.environment;
        break;
      case 'watering':
        cache.lastWateredAt = e.occurredAt;
        break;
      case 'moisture_check':
        if (p.watered) cache.lastWateredAt = e.occurredAt;
        break;
      case 'fertilizing':
        cache.lastFertilizedAt = e.occurredAt;
        break;
      case 'pest_check':
        cache.lastPestCheckAt = e.occurredAt;
        break;
      case 'problem':
        cache.openProblems.push({ id: e.id, problemType: p.problemType, severity: p.severity, since: e.occurredAt });
        break;
      case 'problem_resolved':
        cache.openProblems = cache.openProblems.filter((x) => x.id !== p.problemId);
        break;
      case 'archive':
        archivedAt = e.occurredAt;
        break;
      case 'unarchive':
        archivedAt = null;
        break;
      default:
        break;
    }
    for (const pr of projectors) pr.apply?.(e, ctx);
    cache.cacheRev = e.id;
  }
  cache.pestBoostUntil = cache.openProblems.length
    ? addDays(cache.openProblems.reduce((m, x) => (x.since > m ? x.since : m), ''), PEST_BOOST_DAYS)
    : null;
  for (const p of projectors) p.finalize?.(ctx);
  return { ...plant, environment: cache.environment ?? plant.environment, archivedAt, cache };
}

/** Optional size fields: pot volume (l), substrate, planned harvest date. Only valid values are kept. */
export function optionalPot(input) {
  const out = {};
  if (Number.isFinite(input?.potVolumeL) && input.potVolumeL > 0) out.potVolumeL = input.potVolumeL;
  if (SUBSTRATES.includes(input?.substrate)) out.substrate = input.substrate;
  if (typeof input?.plannedHarvestAt === 'string' && !Number.isNaN(Date.parse(input.plannedHarvestAt))) out.plannedHarvestAt = input.plannedHarvestAt;
  return out;
}

/** Validate input; returns {plant, stage} (plant has an empty cache until events are projected). Throws PhenoError. */
export function buildPlant(input, now = nowIso()) {
  const name = String(input?.name || '').trim();
  if (!name) throw new PhenoError('name', S.err.name);
  const cfg = CATEGORIES[input.category];
  if (!cfg) throw new PhenoError('category', S.err.category);
  if (!ENVIRONMENTS.includes(input.environment)) throw new PhenoError('environment', S.err.environment);
  const lifecycle = input.lifecycle || cfg.lifecycle;
  const stages = getStages(input.category, lifecycle);
  const stage = input.stage || stages[0];
  if (!stages.includes(stage)) throw new PhenoError('stage', S.err.invalid);
  const variety = String(input.variety || '').trim();
  const plant = {
    id: uid(), name, variety, varietyKey: normalizeKey(variety),
    category: input.category, lifecycle, environment: input.environment,
    harvestable: input.harvestable ?? cfg.harvestable,
    location: String(input.location || '').trim(),
    source: SOURCES.includes(input.source) ? input.source : 'other',
    baseOverride: Number.isFinite(input.baseOverride) ? input.baseOverride : null,
    learnedBase: input.learnedBase && Object.keys(input.learnedBase).length ? { ...input.learnedBase } : null,
    startDate: input.startDate || now, createdAt: now, archivedAt: null,
    cache: emptyCache()
  };
  const pot = optionalPot(input);
  Object.assign(plant, pot);
  return { plant, stage };
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Input for "start again like this one": name gets the next #n, learned values carry over. */
export function clonePlantInput(plant, existingNames = []) {
  const base = plant.name.replace(/\s*#\d+$/, '').trim();
  const re = new RegExp(`^${esc(base)} #(\\d+)$`);
  const nums = [1];
  for (const n of [plant.name, ...existingNames]) {
    if (n === base) nums.push(1);
    const m = n.match(re);
    if (m) nums.push(Number(m[1]));
  }
  const soil = plant.cache?.soilDryDays ?? plant.cache?.dryingDays;
  const learned = soil && Object.keys(soil).length ? { ...soil } : plant.learnedBase;
  return {
    name: `${base} #${Math.max(...nums) + 1}`,
    variety: plant.variety, category: plant.category, lifecycle: plant.lifecycle,
    environment: plant.cache?.environment ?? plant.environment,
    harvestable: plant.harvestable, location: plant.location, source: plant.source,
    baseOverride: plant.baseOverride, learnedBase: learned || null,
    potVolumeL: plant.cache?.pot?.volumeL ?? plant.potVolumeL, substrate: plant.substrate
  };
}
