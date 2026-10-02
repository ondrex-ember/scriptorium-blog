// Append-only event store: validation, derived fields, atomic writes.
import { CATEGORIES, ENVIRONMENTS, MOISTURE_ANSWERS, PROBLEM_TYPES, PROCESSING_METHODS, RATING_MAX, SOURCES, getStages } from './config-categories.js';
import './calendar.js';
import { buildPlant, liveEvents, projectPlant } from './model.js';
import { deletePlantData, idbReq, withTx } from './storage.js';
import { S } from './strings.cs.js';
import { PhenoError, compareEvents, daysBetween, isNum, normalizeKey, nowIso, uid } from './utils.js';

export const EVENT_TYPES = [
  'created', 'stage_change', 'environment_change', 'watering', 'moisture_check', 'fertilizing',
  'pest_check', 'problem', 'problem_resolved', 'note', 'photo', 'measurement', 'milestone',
  'harvest', 'evaluation', 'archive', 'unarchive', 'void'
];
/** Allowed on an archived plant. */
const ARCHIVED_OK = ['unarchive', 'evaluation', 'note', 'photo', 'void'];
/** Which snoozed task an event completes. */
const COMPLETES = {
  watering: ['watering'], moisture_check: ['watering'], fertilizing: ['fertilizing'],
  pest_check: ['pestCheck', 'problemFollowUp'], evaluation: ['evaluation']
};

const bad = (msg = S.err.invalid) => new PhenoError('invalid', msg);
const str = (v) => typeof v === 'string' && v.trim().length > 0;

/** Validate one payload against the plant state; returns the cleaned payload. */
function validatePayload(type, payload, plant, live) {
  const p = payload || {};
  const cfg = CATEGORIES[plant.category];
  switch (type) {
    case 'created':
      if (!ENVIRONMENTS.includes(p.environment)) throw bad(S.err.environment);
      return { environment: p.environment };
    case 'stage_change': {
      if (!getStages(plant.category, plant.lifecycle).includes(p.to)) throw bad();
      return { from: p.from ?? null, to: p.to };
    }
    case 'environment_change':
      if (!ENVIRONMENTS.includes(p.environment)) throw bad(S.err.environment);
      return { environment: p.environment };
    case 'watering': {
      const out = {};
      if (p.amountMl != null) { if (!isNum(p.amountMl) || p.amountMl < 0) throw bad(); out.amountMl = p.amountMl; }
      if (p.note) out.note = String(p.note);
      return out;
    }
    case 'moisture_check':
      if (!MOISTURE_ANSWERS.includes(p.answer)) throw bad();
      return { answer: p.answer, watered: !!p.watered };
    case 'fertilizing':
      return { ...(p.product ? { product: String(p.product) } : {}), ...(p.note ? { note: String(p.note) } : {}) };
    case 'pest_check':
      return { found: !!p.found, ...(p.note ? { note: String(p.note) } : {}) };
    case 'problem': {
      if (!PROBLEM_TYPES.includes(p.problemType)) throw bad();
      const sev = p.severity ?? 1;
      if (![1, 2, 3].includes(sev)) throw bad();
      return { problemType: p.problemType, severity: sev, ...(p.note ? { note: String(p.note) } : {}) };
    }
    case 'problem_resolved': {
      const target = live.find((e) => e.id === p.problemId && e.type === 'problem');
      if (!target) throw bad();
      return { problemId: p.problemId };
    }
    case 'note':
      if (!str(p.text)) throw bad();
      return { text: p.text.trim() };
    case 'photo':
      if (!str(p.photoId)) throw bad();
      return { photoId: p.photoId, ...(p.caption ? { caption: String(p.caption) } : {}) };
    case 'measurement':
      if (!str(p.kind) || !isNum(p.value)) throw bad();
      return { kind: p.kind.trim(), value: p.value, ...(p.unit ? { unit: String(p.unit) } : {}) };
    case 'milestone':
      if (!str(p.label)) throw bad();
      return { label: p.label.trim() };
    case 'harvest': {
      if (!plant.harvestable) throw bad(S.err.notHarvestable);
      const out = {};
      for (const f of cfg.harvestFields) {
        const v = p[f.key];
        if (v == null || v === '') continue;
        if (!isNum(v) || v < f.min) throw bad();
        out[f.key] = v;
      }
      if (p.processingMethod != null) {
        if (!PROCESSING_METHODS.includes(p.processingMethod)) throw bad();
        out.processingMethod = p.processingMethod;
      }
      if (p.processingDays != null) {
        if (!isNum(p.processingDays) || p.processingDays < 0) throw bad();
        out.processingDays = p.processingDays;
      }
      if (p.note) out.note = String(p.note);
      if (!Object.keys(out).length) throw bad();
      return out;
    }
    case 'evaluation': {
      if (!plant.harvestable && plant.lifecycle !== 'perennial') throw bad(S.err.notHarvestable);
      const scores = p.scores || {};
      const allowed = ['overall', ...cfg.criteria];
      const out = {};
      for (const [k, v] of Object.entries(scores)) {
        if (!allowed.includes(k)) throw bad();
        if (!Number.isInteger(v) || v < 1 || v > RATING_MAX) throw bad();
        out[k] = v;
      }
      if (out.overall == null) throw bad();
      const res = { scores: out };
      if (p.wouldGrowAgain != null) res.wouldGrowAgain = !!p.wouldGrowAgain;
      if (p.note) res.note = String(p.note);
      if (p.season != null) {
        if (plant.lifecycle !== 'perennial' || !plant.harvestable || !Number.isInteger(p.season)) throw bad();
        res.season = p.season;
      }
      return res;
    }
    case 'archive': case 'unarchive':
      return {};
    case 'void': {
      const target = live.find((e) => e.id === p.targetId);
      if (!target || target.type === 'created') throw bad();
      return { targetId: p.targetId, ...(p.reason ? { reason: String(p.reason) } : {}) };
    }
    default:
      throw bad();
  }
}

function lastBefore(live, pred, at) {
  let found = null;
  for (const e of live) if (e.occurredAt <= at && pred(e)) found = e;
  return found;
}

/** Turn inputs into stored events (validated, with derived fields) against the current log. */
export function buildEvents(plant, existing, inputs, now = nowIso(), opts = {}) {
  const built = [];
  let all = existing.slice();
  for (const inp of inputs) {
    if (!EVENT_TYPES.includes(inp.type)) throw bad();
    const cur = projectPlant(plant, all, opts);
    if (inp.type !== 'created') {
      if (cur.archivedAt && !ARCHIVED_OK.includes(inp.type)) throw new PhenoError('archived', S.err.archived);
      if (inp.type === 'archive' && cur.archivedAt) throw new PhenoError('archived', S.err.archived);
      if (inp.type === 'unarchive' && !cur.archivedAt) throw new PhenoError('notArchived', S.err.notArchived);
    }
    const live = liveEvents(all);
    const payload = validatePayload(inp.type, inp.payload, plant, live);
    const occurredAt = inp.occurredAt || now;
    if (inp.type === 'watering' || inp.type === 'moisture_check') {
      const prev = lastBefore(live, (e) => e.type === 'watering' || (e.type === 'moisture_check' && e.payload.watered), occurredAt);
      payload.daysSinceWatering = prev ? daysBetween(prev.occurredAt, occurredAt) : null;
    }
    if (inp.type === 'harvest') {
      const prev = lastBefore(live, (e) => e.type === 'harvest', occurredAt);
      payload.daysSinceLastHarvest = prev ? daysBetween(prev.occurredAt, occurredAt) : null;
    }
    if (inp.type === 'evaluation') {
      const prev = lastBefore(live, (e) => e.type === 'harvest', occurredAt);
      payload.daysSinceLastHarvest = prev ? daysBetween(prev.occurredAt, occurredAt) : null;
    }
    const ev = { id: uid(), plantId: plant.id, type: inp.type, occurredAt, recordedAt: now, payload };
    built.push(ev);
    all = all.concat(ev);
  }
  return built;
}

/** Engine options stored in meta (hemisphere, asked once; default north). */
async function readOpts(s) {
  const h = await idbReq(s.meta.get('hemisphere'));
  return { hemisphere: h?.value === 'south' ? 'south' : 'north' };
}

/** Append events to one plant and refresh its cache, in one transaction. Returns {plant, events}. */
export function appendEvents(db, plantId, inputs, { now } = {}) {
  return withTx(db, ['plants', 'events', 'meta'], 'readwrite', async (s) => {
    const plant = await idbReq(s.plants.get(plantId));
    if (!plant) throw bad();
    const opts = await readOpts(s);
    const existing = await idbReq(s.events.index('plantId').getAll(plantId));
    const events = buildEvents(plant, existing, inputs, now, opts);
    const snoozed = { ...(plant.cache?.snoozedUntil || {}) };
    for (const e of events) for (const k of COMPLETES[e.type] || []) delete snoozed[k];
    const base = { ...plant, cache: { ...plant.cache, snoozedUntil: snoozed } };
    const next = projectPlant(base, existing.concat(events), opts);
    for (const e of events) s.events.put(e);
    s.plants.put(next);
    return { plant: next, events };
  });
}

/** Void an earlier event (correction). The original stays in the log. */
export const voidEvent = (db, plantId, targetId, reason) =>
  appendEvents(db, plantId, [{ type: 'void', payload: { targetId, reason } }]);

/** Create a plant with its first events (created, stage_change from null). */
export async function createPlant(db, input, { now = nowIso() } = {}) {
  const { plant, stage } = buildPlant(input, now);
  const at = input.startDate || now;
  const opts = await withTx(db, 'meta', 'readonly', readOpts);
  const events = buildEvents(plant, [], [
    { type: 'created', payload: { environment: input.environment }, occurredAt: at },
    { type: 'stage_change', payload: { from: null, to: stage }, occurredAt: at }
  ], now, opts);
  const projected = projectPlant(plant, events, opts);
  return withTx(db, ['plants', 'events'], 'readwrite', async (s) => {
    for (const e of events) s.events.put(e);
    s.plants.put(projected);
    return projected;
  });
}

/** Rebuild every plant's cache from its events (after import, or after engine changes). */
export function rebuildAll(db) {
  return withTx(db, ['plants', 'events', 'meta'], 'readwrite', async (s) => {
    const opts = await readOpts(s);
    const plants = await idbReq(s.plants.getAll());
    for (const pl of plants) {
      const evs = await idbReq(s.events.index('plantId').getAll(pl.id));
      s.plants.put(projectPlant(pl, evs, opts));
    }
    return plants.length;
  });
}

/** Edit plant metadata (not events): name, variety, location, source, baseOverride. Reprojects the cache. */
export function updatePlantMeta(db, plantId, patch) {
  return withTx(db, ['plants', 'events', 'meta'], 'readwrite', async (s) => {
    const plant = await idbReq(s.plants.get(plantId));
    if (!plant) throw bad();
    const next = { ...plant };
    if ('name' in patch) {
      if (!str(patch.name)) throw new PhenoError('name', S.err.name);
      next.name = patch.name.trim();
    }
    if ('variety' in patch) {
      next.variety = String(patch.variety || '').trim();
      next.varietyKey = normalizeKey(next.variety);
    }
    if ('location' in patch) next.location = String(patch.location || '').trim();
    if ('source' in patch && SOURCES.includes(patch.source)) next.source = patch.source;
    if ('baseOverride' in patch) {
      const v = patch.baseOverride;
      if (v != null && (!isNum(v) || v <= 0)) throw bad();
      next.baseOverride = v ?? null;
    }
    const opts = await readOpts(s);
    const events = await idbReq(s.events.index('plantId').getAll(plantId));
    const out = projectPlant(next, events, opts);
    s.plants.put(out);
    return out;
  });
}

/** Snooze a task: cache only, no events (spec 4). */
export function snoozeTask(db, plantId, taskType, untilIso) {
  return withTx(db, 'plants', 'readwrite', async (s) => {
    const plant = await idbReq(s.plants.get(plantId));
    if (!plant) throw bad();
    plant.cache = { ...plant.cache, snoozedUntil: { ...plant.cache.snoozedUntil, [taskType]: untilIso } };
    s.plants.put(plant);
    return plant;
  });
}

/** Permanent delete: only with the exact plant name typed. */
export async function deletePlantPermanently(db, plantId, typedName) {
  const plant = await withTx(db, 'plants', 'readonly', (s) => idbReq(s.plants.get(plantId)));
  if (!plant) throw bad();
  if (String(typedName || '').trim() !== plant.name) throw new PhenoError('confirmName', S.err.confirmName);
  return deletePlantData(db, plantId);
}

export { compareEvents };
