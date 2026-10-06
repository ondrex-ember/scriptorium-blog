import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { activeCriteria, cleanCriteria, criteriaEntries, criterionLabel, newCriterionKey } from '../js/criteria.js';
import { appendEvents, createPlant } from '../js/events.js';
import { exportBackup, importBackup } from '../js/backup.js';
import { metaGet, metaSet } from '../js/storage.js';
import { T0, basePlant, day, freshDb } from './harness.js';

const JSZip = createRequire(import.meta.url)('jszip');

test('defaults come from the category; overrides equal to the defaults vanish; invalid entries are dropped', () => {
  assert.deepEqual(activeCriteria('herb').map((c) => c.key), ['aroma', 'flavor', 'usability']);
  assert.equal(criteriaEntries('herb')[0].label, 'Aroma');
  const defaults = [{ key: 'aroma', label: 'Aroma' }, { key: 'flavor', label: 'Chuť' }, { key: 'usability', label: 'Využitelnost' }];
  assert.deepEqual(cleanCriteria({ herb: defaults }), {});
  const c = cleanCriteria({
    herb: [{ key: 'aroma', label: 'Vůně' }, { key: 'overall', label: 'x' }, { key: 'Bad Key', label: 'x' }, { key: 'aroma', label: 'dup' }, { key: 'cX', label: '<b>Odolnost</b>' }, { key: 'e', label: '  ' }],
    nope: [{ key: 'a', label: 'b' }], other: 'zzz'
  });
  assert.deepEqual(c, { herb: [{ key: 'aroma', label: 'Vůně' }, { key: 'cX', label: 'bOdolnost/b' }] });
  assert.deepEqual(cleanCriteria({ herb: [] }), { herb: [] });                         // everything removed is a legal choice
  assert.deepEqual(cleanCriteria(null), {});
});

test('keys for new criteria are unique, ASCII and never "overall"', () => {
  assert.equal(newCriterionKey('Odolnost vůči mrazu', []), 'cOdolnostVuciMrazu');
  assert.equal(newCriterionKey('Odolnost', ['cOdolnost']), 'cOdolnost2');
  assert.equal(newCriterionKey('???', []), 'cX');
  assert.match(newCriterionKey('x'.repeat(80), []), /^[a-z][a-zA-Z0-9_]{0,31}$/);
});

test('removed criteria keep their label for history, active ones exclude them', () => {
  const custom = { herb: [{ key: 'aroma', label: 'Vůně' }, { key: 'flavor', label: 'Chuť', removed: true }] };
  assert.deepEqual(activeCriteria('herb', custom), [{ key: 'aroma', label: 'Vůně' }]);
  assert.equal(criterionLabel('flavor', custom, 'herb'), 'Chuť');
  assert.equal(criterionLabel('aroma', custom, 'herb'), 'Vůně');
  assert.equal(criterionLabel('overall', custom, 'herb'), 'Celkově');
  assert.equal(criterionLabel('zzz', custom, 'herb'), null);
});

test('evaluation accepts exactly the active criteria; old evaluations stay in the history; backup round trip', async () => {
  const db = await freshDb();
  const p = await createPlant(db, basePlant({ name: 'Bazalka' }), { now: T0 });
  const add = (payload, at) => appendEvents(db, p.id, [{ type: 'evaluation', payload, occurredAt: at }], { now: day(400) });
  await add({ scores: { overall: 4, aroma: 5 } }, day(50));
  await metaSet(db, 'criteria', { herb: [{ key: 'aroma', label: 'Vůně', removed: true }, { key: 'cOdolnost', label: 'Odolnost' }] });
  await assert.rejects(add({ scores: { overall: 4, aroma: 5 } }, day(51)));            // removed
  await assert.rejects(add({ scores: { overall: 4, flavor: 2 } }, day(51)));           // not offered any more
  const ok = await add({ scores: { overall: 5, cOdolnost: 3 } }, day(52));
  assert.equal(ok.events[0].payload.scores.cOdolnost, 3);
  assert.equal((await appendEvents(db, p.id, [{ type: 'note', payload: { text: 'x' }, occurredAt: day(53) }], { now: day(400) })).plant.cache.evaluations.length, 2);

  const dst = await freshDb();
  await importBackup(dst, await exportBackup(db, { JSZip }), { JSZip });
  assert.deepEqual(await metaGet(dst, 'criteria'), await metaGet(db, 'criteria'));
  const evil = await freshDb();
  const zip = await JSZip.loadAsync(await exportBackup(db, { JSZip }));
  const data = JSON.parse(await zip.file('data.json').async('string'));
  data.meta.criteria = { herb: [{ key: 'ok', label: 'Fajn' }, { key: '__proto__', label: 'x' }], hax: [] };
  zip.file('data.json', JSON.stringify(data));
  await importBackup(evil, await zip.generateAsync({ type: 'uint8array' }), { JSZip });
  assert.deepEqual(await metaGet(evil, 'criteria'), { herb: [{ key: 'ok', label: 'Fajn' }] });
});
