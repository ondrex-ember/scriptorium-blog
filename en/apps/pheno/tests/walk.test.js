import test from 'node:test';
import assert from 'node:assert/strict';
import { walkPlants } from '../js/ui-walk.js';

const p = (name, location, stage = 'growing', archivedAt = null) => ({ name, location, archivedAt, cache: { stage } });

test('walk order: by place then name; ended, dormant and archived plants left out', () => {
  const list = walkPlants([p('Máta', 'skleník'), p('Bazalka', 'balkon'), p('Rajče', 'balkon'), p('Stará', 'balkon', 'done'),
    p('Strom', 'zahrada', 'dormant'), p('Archiv', 'balkon', 'growing', '2026-01-01T00:00:00Z'), p('Bez místa', '')]);
  assert.deepEqual(list.map((x) => x.name), ['Bez místa', 'Bazalka', 'Rajče', 'Máta']);
});

test('walk skips harvested plants (no moisture question after harvest) but lists their batches in processing', async () => {
  const { walkBatches } = await import('../js/ui-walk.js');
  const harvested = { ...p('Sklizená', 'balkon', 'harvested'), cache: { stage: 'harvested', batches: [
    { id: 'b1', phase: 'drying', harvestedAt: '2026-09-01T00:00:00Z' }, { id: 'b2', phase: 'used', harvestedAt: '2026-08-01T00:00:00Z' },
    { id: 'b3', phase: 'drying', legacy: true, harvestedAt: '2026-07-01T00:00:00Z' }] } };
  assert.deepEqual(walkPlants([harvested, p('Máta', 'balkon')]).map((x) => x.name), ['Máta']);
  assert.deepEqual(walkBatches([harvested]).map((x) => x.batch.id), ['b1']);
});
