// Pure in-memory plant for engine tests: no IndexedDB.
import { buildEvents } from '../js/events.js';
import { buildPlant, projectPlant } from '../js/model.js';
import { resolveRules } from '../js/config-rules.js';
import { T0, basePlant } from './harness.js';

export function mk(input = {}, opts = {}) {
  const { plant, stage } = buildPlant({ ...basePlant(), ...input }, T0);
  const st = { plant, events: [], opts: { rules: resolveRules(), ...opts } };
  add(st, [{ type: 'created', payload: { environment: plant.environment } }, { type: 'stage_change', payload: { from: null, to: stage } }], T0);
  return st;
}
export function add(st, items, at) {
  const list = items.map((i) => ({ occurredAt: at, ...i }));
  st.events = st.events.concat(buildEvents(st.plant, st.events, list, at, st.opts));
  st.p = projectPlant(st.plant, st.events, st.opts);
  return st.p;
}
export const ev = (st, type, payload, at) => add(st, [{ type, payload }], at);
export const lastBatch = (p) => p.cache.batches.at(-1);
