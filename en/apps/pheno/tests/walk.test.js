import test from 'node:test';
import assert from 'node:assert/strict';
import { walkPlants } from '../js/ui-walk.js';

const p = (name, location, stage = 'growing', archivedAt = null) => ({ name, location, archivedAt, cache: { stage } });

test('walk order: by place then name; ended, dormant and archived plants left out', () => {
  const list = walkPlants([p('Máta', 'skleník'), p('Bazalka', 'balkon'), p('Rajče', 'balkon'), p('Stará', 'balkon', 'done'),
    p('Strom', 'zahrada', 'dormant'), p('Archiv', 'balkon', 'growing', '2026-01-01T00:00:00Z'), p('Bez místa', '')]);
  assert.deepEqual(list.map((x) => x.name), ['Bez místa', 'Bazalka', 'Rajče', 'Máta']);
});
