// Append-only event store: validation, derived fields, atomic writes.
import { BATCH_ENDED, BATCH_PHASES, CARE_KINDS, CATEGORIES, DRYNESS_MAX, ENVIRONMENTS, EVAL_KINDS, MOISTURE_ANSWERS, PROBLEM_TYPES, PROCESSING_METHODS, RATING_MAX, SOURCES, getStages } from './config-categories.js';
import { cleanRules, resolveRules } from './config-rules.js';
import { activeCriteria, cleanCriteria } from './criteria.js';
import { MAX_CONTAINERS, STOCK_EVENT_TYPES, STOCK_UNITS } from './stock.js';
import { cleanStock, resolveMethods } from './stockcfg.js';
import './calendar.js';
import { buildPlant, isPresetKey, liveEvents, optionalPot, projectPlant } from './model.js';
import { deletePlantData, idbReq, withTx } from './storage.js';
import { S } from './strings.cs.js';
import { PhenoError, compareEvents, daysBetween, isNum, normalizeKey, nowIso, uid } from './utils.js';

/** Bump when projection logic changes: the app rebuilds every cache once on the next start. */
export const ENGINE_REV = 4;

export const EVENT_TYPES = [
  'created', 'stage_change', 'environment_change', 'watering', 'moisture_check', 'fertilizing',
  'pest_check', 'problem', 'problem_resolved', 'note', 'photo', 'measurement', 'milestone',
  'harvest', 'evaluation', 'archive', 'unarchive', 'void', 'batch_step', 'batch_check', 'care', 'harvest_edit', ...STOCK_EVENT_TYPES
];
/** Allowed on an archived plant. */
const ARCHIVED_OK = ['unarchive', 'evaluation', 'note', 'photo', 'void', 'batch_step', 'batch_check', ...STOCK_EVENT_TYPES];
/** Which snoozed task an event completes. */
const COMPLETES = {
  watering: ['watering'], moisture_check: ['watering'], fertilizing: ['fertilizing'],
  pest_check: ['pestCheck', 'problemFollowUp'], evaluation: ['evaluation']
};

const bad = (msg = S.err.invalid) => new PhenoError('invalid', msg);
const str = (v) => typeof v === 'string' && v.trim().length > 0;

/** Validate one payload against the plant state; returns the cleaned payload. */
function validatePayload(type, payload, plant, live, cur, opts = {}) {
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
      if (p.estDays != null) {
        if (!isNum(p.estDays) || p.estDays < 0.5 || p.estDays > 120) throw bad();
        out.estDays = p.estDays;
      }
      if (p.note) out.note = String(p.note);
      if (!Object.keys(out).length) throw bad();
      if (p.final) out.final = true;
      return out;
    }
    case 'harvest_edit': {
      const target = live.find((e) => e.id === p.harvestId && e.type === 'harvest');
      if (!target) throw bad();
      const out = validatePayload('harvest', p, plant, live, cur, opts);
      out.harvestId = target.id;
      if (p.date != null) {
        const t = Date.parse(p.date);
        if (!Number.isFinite(t)) throw bad();
        // the harvest cannot move behind its own processing steps and checks
        const first = live.filter((e) => e.payload?.batchId === target.id && e.id !== target.id).map((e) => Date.parse(e.occurredAt));
        if (first.some((x) => t > x)) throw bad(S.err.harvestDate);
        out.date = p.date;
      }
      return out;
    }
    case 'batch_step': {
      const b = openBatch(cur, p.batchId);
      if (!BATCH_PHASES.includes(p.phase)) throw bad();
      const out = { batchId: b.id, phase: p.phase };
      if (p.method != null) {
        if (!PROCESSING_METHODS.includes(p.method)) throw bad();
        out.method = p.method;
      }
      if (p.estDays != null) {
        if (!isNum(p.estDays) || p.estDays < 0.5 || p.estDays > 120) throw bad();
        out.estDays = p.estDays;
      }
      if (p.note) out.note = String(p.note);
      return out;
    }
    case 'batch_check': {
      const b = openBatch(cur, p.batchId);
      const out = { batchId: b.id };
      if (p.dryness != null) {
        if (!Number.isInteger(p.dryness) || p.dryness < 0 || p.dryness > DRYNESS_MAX) throw bad();
        out.dryness = p.dryness;
      }
      if (p.mold != null) out.mold = !!p.mold;
      for (const k of ['scent', 'appearance']) {
        if (p[k] == null) continue;
        if (!Number.isInteger(p[k]) || p[k] < 1 || p[k] > RATING_MAX) throw bad();
        out[k] = p[k];
      }
      if (p.note) out.note = String(p.note);
      if (p.photoId) out.photoId = String(p.photoId);
      if (Object.keys(out).length < 2) throw bad();
      return out;
    }
    case 'stock_init': case 'stock_use': case 'stock_adjust': case 'stock_move': case 'stock_check':
      return validateStock(type, p, plant, cur, opts);
    case 'care': {
      if (!CARE_KINDS.includes(p.kind)) throw bad();
      const out = { kind: p.kind };
      if (p.kind === 'custom') { if (!str(p.label)) throw bad(); out.label = p.label.trim().slice(0, 80); }
      if (p.potVolumeL != null) { if (!isNum(p.potVolumeL) || p.potVolumeL <= 0) throw bad(); out.potVolumeL = p.potVolumeL; }
      if (p.note) out.note = String(p.note);
      return out;
    }
    case 'evaluation': {
      if (!plant.harvestable && plant.lifecycle !== 'perennial') throw bad(S.err.notHarvestable);
      const scores = p.scores || {};
      const allowed = ['overall', ...activeCriteria(plant.category, opts.criteria).map((c) => c.key)];
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
      if (p.batchId != null) {
        const b = (cur?.cache?.batches || []).find((x) => x.id === p.batchId);
        if (!b) throw bad();
        res.batchId = b.id;
      }
      if (p.part) res.part = String(p.part).trim().slice(0, 80);
      const c = cur?.cache;
      const afterHarvest = res.batchId || res.season != null || c?.finalHarvestAt || ['harvested', 'done', 'dormant'].includes(c?.stage)
        || (c?.batches || []).some((b) => b.readyAt || b.phase === 'used');
      const kind = p.kind ?? (afterHarvest ? 'final' : 'tasting');
      if (!EVAL_KINDS.includes(kind)) throw bad();
      res.kind = kind;
      return res;
    }
    case 'archive': case 'unarchive':
      return {};
    case 'void': {
      // corrections (harvest_edit) are not in `live` (they are merged into their harvest) but can be undone
      const voided = new Set((opts.rawEvents || []).filter((e) => e.type === 'void').map((e) => e.payload.targetId));
      const target = live.find((e) => e.id === p.targetId)
        || (opts.rawEvents || []).find((e) => e.id === p.targetId && e.type === 'harvest_edit' && !voided.has(e.id));
      if (!target || target.type === 'created') throw bad();
      return { targetId: p.targetId, ...(p.reason ? { reason: String(p.reason) } : {}) };
    }
    default:
      throw bad();
  }
}

const amountOk = (v) => isNum(v) && v > 0 && v < 1e7;
const idOk = (v) => typeof v === 'string' && /^[\w.-]{1,60}$/.test(v);

/** stock_* payloads (RCv0.192): containers of a weighed batch, withdrawals, calibration, moves between storage methods, checks. */
function validateStock(type, p, plant, cur, opts) {
  const methods = resolveMethods(opts.stockCfg);
  const b = (cur?.cache?.batches || []).find((x) => x.id === p.batchId);
  if (!plant.harvestable || !b) throw bad();
  if (opts.at && Date.parse(opts.at) < Date.parse(b.stock?.at ?? b.harvestedAt)) throw bad(S.err.stockDate);
  if (type === 'stock_init') {
    if (b.stock || b.phase === 'pending' || BATCH_ENDED.includes(b.phase)) throw bad(S.err.stockInit);
    if (!STOCK_UNITS.includes(p.unit)) throw bad();
    if (!Array.isArray(p.containers) || !p.containers.length || p.containers.length > MAX_CONTAINERS) throw bad();
    const taken = new Set((cur.cache.batches || []).flatMap((x) => (x.stock?.containers || []).map((k) => k.id)));
    const containers = p.containers.map((s) => {
      if (!s || !idOk(s.id) || taken.has(s.id) || !amountOk(s.amount) || !methods[s.method]) throw bad();
      taken.add(s.id);
      return { id: s.id, amount: s.amount, method: s.method, ...(s.label ? { label: String(s.label).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40) } : {}) };
    });
    return { batchId: b.id, unit: p.unit, containers, source: p.source === 'estimate' ? 'estimate' : 'weighed' };
  }
  const st = b.stock;
  if (!st) throw bad(S.err.noStock);
  const k = st.containers.find((x) => x.id === p.containerId);
  if (!k || k.status !== 'open') throw bad(S.err.noStock);
  const out = { batchId: b.id, stockId: st.id, containerId: k.id };
  switch (type) {
    case 'stock_use':
      if (!amountOk(p.amount) || p.amount > k.amount + 1e-9) throw bad(S.err.stockAmount);
      out.amount = p.amount;
      if (p.kind === 'discard') { out.kind = 'discard'; if (p.reason) out.reason = String(p.reason).slice(0, 80); }
      return out;
    case 'stock_adjust':
      if (!isNum(p.remaining) || p.remaining < 0 || p.remaining > 1e7) throw bad();
      out.remaining = p.remaining;
      return out;
    case 'stock_move': {
      if (!methods[p.method]) throw bad();
      const partial = p.amount != null && p.amount < k.amount - 1e-9;
      if (p.amount != null && !amountOk(p.amount)) throw bad();
      if (p.amount != null && p.amount > k.amount + 1e-9) throw bad(S.err.stockAmount);
      if (!partial && p.method === k.method) throw bad();
      out.method = p.method;
      if (partial) {
        const taken = new Set((cur.cache.batches || []).flatMap((x) => (x.stock?.containers || []).map((c) => c.id)));
        if (!idOk(p.newContainerId) || taken.has(p.newContainerId)) throw bad();
        out.amount = p.amount; out.newContainerId = p.newContainerId;
      }
      if (p.label) out.label = String(p.label).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40);
      return out;
    }
    default: {   // stock_check
      for (const f of ['scent', 'appearance']) {
        if (p[f] == null) continue;
        if (!Number.isInteger(p[f]) || p[f] < 1 || p[f] > RATING_MAX) throw bad();
        out[f] = p[f];
      }
      if (p.mold != null) out.mold = !!p.mold;
      if (p.rh != null) { if (!isNum(p.rh) || p.rh < 0 || p.rh > 100) throw bad(); out.rh = p.rh; }
      if (p.aired) out.aired = true;
      if (p.note) out.note = String(p.note).slice(0, 300);
      if (Object.keys(out).length <= 3) throw bad();
      return out;
    }
  }
}

/** A batch that exists and is not used up or discarded; otherwise the payload is invalid. */
function openBatch(cur, id) {
  const b = (cur?.cache?.batches || []).find((x) => x.id === id);
  if (!b || BATCH_ENDED.includes(b.phase)) throw bad();
  return b;
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
    const occurredAt = inp.occurredAt || now;
    const payload = validatePayload(inp.type, inp.payload, plant, live, cur, { ...opts, rawEvents: all, at: occurredAt });
    const id = uid();
    if (inp.type === 'harvest') payload.batchId = id;
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
    const ev = { id, plantId: plant.id, type: inp.type, occurredAt, recordedAt: now, payload };
    built.push(ev);
    all = all.concat(ev);
  }
  return built;
}

/** Engine options stored in meta: hemisphere (default north) and the resolved rules (defaults + valid overrides). */
async function readOpts(s) {
  const h = await idbReq(s.meta.get('hemisphere'));
  const r = await idbReq(s.meta.get('rules'));
  const cr = await idbReq(s.meta.get('criteria'));
  const st = await idbReq(s.meta.get('stock'));
  return { hemisphere: h?.value === 'south' ? 'south' : 'north', rules: resolveRules(cleanRules(r?.value)), criteria: cleanCriteria(cr?.value), stockCfg: cleanStock(st?.value) };
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
    for (const e of events) {
      for (const k of COMPLETES[e.type] || []) delete snoozed[k];
      const cid = e.payload?.containerId;
      if (cid && e.type === 'stock_check') for (const k of [`stockCheck:${cid}`, `stockAir:${cid}`]) delete snoozed[k];
      if (cid && e.type === 'stock_use') delete snoozed[`stockUseBy:${cid}`];
      const bid = e.payload?.batchId;
      if (bid && ['batch_check', 'batch_step', 'evaluation'].includes(e.type)) {
        for (const k of [`batchCheck:${bid}`, `useBy:${bid}`, `evaluation:${bid}`]) delete snoozed[k];
      }
    }
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
    let ok = 0;
    for (const pl of plants) {
      const evs = await idbReq(s.events.index('plantId').getAll(pl.id));
      try { s.plants.put(projectPlant(pl, evs, opts)); ok += 1; } catch (e) { console.error('rebuild failed for', pl.id, e); }
    }
    return ok;
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
    for (const k of ['potVolumeL', 'substrate', 'plannedHarvestAt']) {
      if (!(k in patch)) continue;
      if (patch[k] == null || patch[k] === '') delete next[k];
      else { const v = optionalPot({ [k]: patch[k] }); if (!(k in v)) throw bad(); next[k] = v[k]; }
    }
    if ('stockPreset' in patch) {
      if (isPresetKey(patch.stockPreset)) next.stockPreset = patch.stockPreset; else delete next.stockPreset;
    }
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
