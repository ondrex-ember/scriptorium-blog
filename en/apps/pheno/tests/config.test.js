import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, CYCLE_STAGES, PERENNIAL_STAGES, getStages } from '../js/config-categories.js';
import { S } from '../js/strings.cs.js';
import { normalizeKey, seasonOf, uid, coefVariation, weightedMean } from '../js/utils.js';

test('category defaults match the spec table', () => {
  const row = (c) => [CATEGORIES[c].lifecycle, CATEGORIES[c].harvestable, CATEGORIES[c].fertilizingDays, CATEGORIES[c].pestCheckDays, CATEGORIES[c].baseDryingDays];
  assert.deepEqual(row('herb'), ['cycle', true, 14, 7, 3]);
  assert.deepEqual(row('vegetable'), ['cycle', true, 10, 5, 2]);
  assert.deepEqual(row('fruit'), ['cycle', true, 21, 7, 3]);
  assert.deepEqual(row('flower'), ['cycle', true, 14, 10, 3]);
  assert.deepEqual(row('tree_shrub'), ['perennial', true, 30, 14, 5]);
  assert.deepEqual(row('other'), ['cycle', false, 14, 7, 3]);
});

test('flower has optional totalWeight harvest field', () => {
  assert.ok(CATEGORIES.flower.harvestFields.some((f) => f.key === 'totalWeight'));
});

test('stage lists', () => {
  assert.deepEqual(getStages('herb', 'cycle'), CYCLE_STAGES.herb);
  assert.deepEqual(getStages('herb', 'perennial'), PERENNIAL_STAGES);
});

test('every category, stage, criterion has a Czech string', () => {
  for (const [c, cfg] of Object.entries(CATEGORIES)) {
    assert.ok(S.category[c], c);
    for (const st of getStages(c, cfg.lifecycle)) assert.ok(S.stage[st], st);
    for (const k of ['overall', ...cfg.criteria]) assert.ok(S.criterion[k], k);
    for (const f of cfg.harvestFields) assert.ok(S.harvestField[f.key], f.key);
  }
  for (const st of PERENNIAL_STAGES) assert.ok(S.stage[st]);
});

test('utils', () => {
  assert.equal(normalizeKey('  Genovése   BASIL '), 'genovese basil');
  assert.equal(seasonOf('2026-12-15T12:00:00'), 'winter');
  assert.equal(seasonOf('2026-03-01T12:00:00'), 'spring');
  assert.equal(seasonOf('2026-08-31T12:00:00'), 'summer');
  assert.equal(seasonOf('2026-09-01T12:00:00'), 'autumn');
  const ids = Array.from({ length: 200 }, uid);
  assert.equal(new Set(ids).size, 200);
  assert.deepEqual([...ids].sort(), ids);
  assert.equal(weightedMean([1, 2, 3]), (1 + 4 + 9) / 6);
  assert.equal(coefVariation([2, 2, 2]), 0);
});
