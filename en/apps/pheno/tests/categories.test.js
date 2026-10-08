import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { CATEGORIES, CYCLE_STAGES, FRESH_CATEGORIES, getStages } from '../js/config-categories.js';
import { MAX_CUSTOM_CATEGORIES, applyCategories, categoryChoices, cleanCategories, currentCategories, mergeCategories, withCategories } from '../js/categories.js';
import { cleanRules, resolveRules, ruleDef } from '../js/config-rules.js';
import { ENGINE_REV, appendEvents, createPlant, saveCategories } from '../js/events.js';
import { getPlantTasks } from '../js/calendar.js';
import { exportBackup, importBackup } from '../js/backup.js';
import { getPlant, listPlants, metaGet, metaSet } from '../js/storage.js';
import { S } from '../js/strings.cs.js';
import { T0, basePlant, day, freshDb } from './harness.js';

const JSZip = createRequire(import.meta.url)('jszip');
afterEach(() => applyCategories(null));

const MINT = { u_mint1: { label: 'Máta <b>pole</b>', icon: 'leaf', base: 'herb', overrides: { pestCheckDays: 3, stages: ['growing', 'seedling'], harvestFields: ['pieceCount', 'freshWeight'] } } };

test('cleanCategories whitelists ids, bases, labels, overrides and the count', () => {
  const c = cleanCategories({
    u_ok123: { label: ' Mint ', icon: 'nope', base: 'herb', overrides: { pestCheckDays: 3, fertilizingDays: 9999, baseDryingDays: 'x', junk: 1, lifecycle: 'weird', stages: ['flowering', 'bogus'], harvestFields: ['evil', 'brix'] } },
    bad: { label: 'x', base: 'herb' }, u_nobase: { label: 'x', base: 'u_other' }, u_nolabel: { label: '  ', base: 'herb' }, u_same1: { label: 'Same', base: 'herb', overrides: { pestCheckDays: 7, harvestable: true } }
  });
  assert.deepEqual(Object.keys(c).sort(), ['u_ok123', 'u_same1']);
  assert.equal(c.u_ok123.label, 'Mint'); assert.equal(c.u_ok123.icon, 'leaf');                 // unknown icon → base icon
  assert.deepEqual(c.u_ok123.overrides, { pestCheckDays: 3, stages: ['flowering', 'done'], harvestFields: ['brix'] });
  assert.deepEqual(c.u_same1.overrides, {});                                                    // equal to base → no override
  const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`u_n${String(i).padStart(3, '0')}`, { label: `K${i}`, base: 'herb' }]));
  assert.equal(Object.keys(cleanCategories(many)).length, MAX_CUSTOM_CATEGORIES);
  assert.deepEqual(cleanCategories(null), {}); assert.deepEqual(cleanCategories([1]), {});
});

test('applyCategories registers custom categories in the shared tables and leaves built-ins alone', () => {
  const builtinHerb = JSON.stringify(CATEGORIES.herb);
  applyCategories(MINT);
  const cfg = CATEGORIES.u_mint1;
  assert.ok(cfg.custom); assert.equal(cfg.base, 'herb'); assert.equal(cfg.pestCheckDays, 3); assert.equal(cfg.fertilizingDays, 14);   // inherited
  assert.deepEqual(cfg.harvestFields.map((f) => f.key), ['freshWeight', 'pieceCount']);
  assert.deepEqual(getStages('u_mint1', 'cycle'), ['seedling', 'growing', 'done']);                // canonical order, done last
  assert.deepEqual(getStages('u_mint1', 'perennial'), getStages('herb', 'perennial'));
  assert.equal(S.category.u_mint1, 'Máta bpole/b');                                                   // angle brackets stripped
  assert.equal(JSON.stringify(CATEGORIES.herb), builtinHerb);
  assert.ok(ruleDef('cat.u_mint1.pestCheckDays')); assert.equal(resolveRules()['cat.u_mint1.pestCheckDays'], 3);
  assert.deepEqual(cleanRules({ 'cat.u_mint1.pestCheckDays': 5 }), { 'cat.u_mint1.pestCheckDays': 5 });
  applyCategories(null);
  assert.equal(CATEGORIES.u_mint1, undefined); assert.equal(CYCLE_STAGES.u_mint1, undefined); assert.equal(S.category.u_mint1, undefined);
  assert.equal(ruleDef('cat.u_mint1.pestCheckDays'), undefined); assert.deepEqual(cleanRules({ 'cat.u_mint1.pestCheckDays': 5 }), {});
});

test('a custom category on a fresh base is a fresh category; withCategories restores the registry', () => {
  withCategories({ u_tom01: { label: 'Cherry', base: 'vegetable' } }, () => {
    assert.ok(FRESH_CATEGORIES.includes('u_tom01'));
    assert.ok(ruleDef('useBy.u_tom01'));
  });
  assert.equal(CATEGORIES.u_tom01, undefined); assert.ok(!FRESH_CATEGORIES.includes('u_tom01'));
  applyCategories(MINT);
  withCategories({ u_tom01: { label: 'Cherry', base: 'vegetable' } }, () => assert.ok(CATEGORIES.u_mint1 && CATEGORIES.u_tom01));
  assert.ok(CATEGORIES.u_mint1); assert.equal(CATEGORIES.u_tom01, undefined);
});

test('plants of a custom category use its stages, harvest fields and care intervals', async () => {
  const db = await freshDb();
  await saveCategories(db, MINT);
  assert.equal(ENGINE_REV, 5);
  const p = await createPlant(db, basePlant({ category: 'u_mint1', name: 'Máta' }), { now: T0 });
  assert.equal(p.cache.stage, 'seedling');
  await appendEvents(db, p.id, [{ type: 'stage_change', payload: { from: 'seedling', to: 'growing' }, occurredAt: day(5) }], { now: day(6) });
  await assert.rejects(appendEvents(db, p.id, [{ type: 'stage_change', payload: { from: 'growing', to: 'flowering' }, occurredAt: day(6) }], { now: day(7) }));   // not in this category's stages
  await appendEvents(db, p.id, [{ type: 'harvest', payload: { freshWeight: 20, pieceCount: 4 }, occurredAt: day(30) }], { now: day(31) });
  const due = (rules) => getPlantTasks({ ...p, startDate: T0, cache: p.cache }, day(1), { rules }).find((t) => t.type === 'pestCheck')?.dueAt;
  const custom = due(resolveRules());
  const herb = getPlantTasks({ ...p, category: 'herb' }, day(1), { rules: resolveRules() }).find((t) => t.type === 'pestCheck')?.dueAt;
  assert.ok(custom && herb && custom < herb, `${custom} < ${herb}`);                              // 3 days vs 7
});

test('saveCategories stores the cleaned map and survives a reload', async () => {
  const db = await freshDb();
  const saved = await saveCategories(db, { ...MINT, junk: 1 });
  assert.deepEqual(Object.keys(saved), ['u_mint1']);
  assert.deepEqual(await metaGet(db, 'categories'), saved);
  assert.deepEqual(currentCategories(), saved);
  await saveCategories(db, {});
  assert.equal(CATEGORIES.u_mint1, undefined);
});

test('soft-deleted categories keep working for existing plants and are hidden from new ones', async () => {
  const db = await freshDb();
  await saveCategories(db, MINT);
  const p = await createPlant(db, basePlant({ category: 'u_mint1' }), { now: T0 });
  await saveCategories(db, { u_mint1: { ...MINT.u_mint1, deleted: true } });
  assert.ok(CATEGORIES.u_mint1.deleted);
  assert.ok(!categoryChoices().includes('u_mint1')); assert.ok(categoryChoices('u_mint1').includes('u_mint1'));
  await appendEvents(db, p.id, [{ type: 'harvest', payload: { freshWeight: 5 }, occurredAt: day(20) }], { now: day(21) });   // still fully usable
  assert.equal((await getPlant(db, p.id)).category, 'u_mint1');
});

test('backup: custom categories travel, merge with local winning, and plants fall back to "other" when unknown', async () => {
  const src = await freshDb();
  await saveCategories(src, MINT);
  await createPlant(src, basePlant({ category: 'u_mint1', name: 'Máta' }), { now: T0 });
  const bytes = await exportBackup(src, { JSZip });
  applyCategories(null);
  const dst = await freshDb();
  const rep = await importBackup(dst, bytes, { JSZip });
  assert.equal(rep.plantsAdded, 1); assert.equal(rep.skipped, 0);
  assert.deepEqual(await metaGet(dst, 'categories'), cleanCategories(MINT));
  assert.equal((await listPlants(dst))[0].category, 'u_mint1');
  assert.ok(CATEGORIES.u_mint1);                                                                 // registered for the running app
  // local copy wins on a clash
  const local = await freshDb();
  await saveCategories(local, { u_mint1: { label: 'Moje', base: 'herb' } });
  await importBackup(local, bytes, { JSZip });
  assert.equal((await metaGet(local, 'categories')).u_mint1.label, 'Moje');
  assert.equal(S.category.u_mint1, 'Moje');
  // archive without meta.categories: unknown custom key → other, plain junk key still dropped
  const z = await JSZip.loadAsync(bytes);
  const data = JSON.parse(await z.file('data.json').async('string'));
  delete data.meta.categories;
  data.plants.push({ ...data.plants[0], id: 'junk1', category: 'nope' });
  z.file('data.json', JSON.stringify(data));
  applyCategories(null);
  const dst2 = await freshDb();
  const r2 = await importBackup(dst2, await z.generateAsync({ type: 'uint8array' }), { JSZip });
  assert.equal(r2.plantsAdded, 1); assert.equal(r2.skipped, 1);
  assert.equal((await listPlants(dst2))[0].category, 'other');
  assert.equal(await metaGet(dst2, 'categories'), undefined);
  // hostile categories are cleaned
  data.meta.categories = { u_evil1: { label: '<img src=x onerror=1>', base: '__proto__', overrides: {} }, u_good1: { label: 'OK', base: 'herb', overrides: { pestCheckDays: 1e9 } } };
  z.file('data.json', JSON.stringify(data));
  applyCategories(null);
  const dst3 = await freshDb();
  await importBackup(dst3, await z.generateAsync({ type: 'uint8array' }), { JSZip });
  assert.deepEqual(await metaGet(dst3, 'categories'), { u_good1: { label: 'OK', icon: 'leaf', base: 'herb', overrides: {} } });
});

test('mergeCategories: union by id, local wins', () => {
  const m = mergeCategories({ u_aaa1: { label: 'A', base: 'herb' } }, { u_aaa1: { label: 'X', base: 'herb' }, u_bbb2: { label: 'B', base: 'fruit' } });
  assert.equal(m.u_aaa1.label, 'A'); assert.equal(m.u_bbb2.label, 'B');
});
