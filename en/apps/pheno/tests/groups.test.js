import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { appendBulk, appendEvents, assignGroup, createPlant, readGroups, saveGroups, snoozeMany, updatePlantMeta, voidBulk } from '../js/events.js';
import { clusterTasks, cleanGroups, commonStages, compareAcrossGroups, groupsFromLocations, isGroupId, mergeGroups } from '../js/groups.js';
import { exportBackup, importBackup } from '../js/backup.js';
import { computeTasks } from '../js/calendar.js';
import { getAllEvents, getEvents, getPlant, listPlants, metaGet } from '../js/storage.js';
import { T0, basePlant, day, freshDb } from './harness.js';

const JSZip = createRequire(import.meta.url)('jszip');
const GA = 'gboxa111', GB = 'gboxb222';

async function setup() {
  const db = await freshDb();
  await saveGroups(db, [{ id: GA, label: 'Box A', kind: 'place', environment: 'indoor' }, { id: GB, label: 'Záhon 1', kind: 'bed' }]);
  const ids = [];
  for (let i = 1; i <= 4; i++) ids.push((await createPlant(db, basePlant({ name: `Bazalka #${i}`, groupId: i <= 3 ? GA : undefined }), { now: T0 })).id);
  return { db, ids };
}

test('cleanGroups whitelists, trims, dedups and limits; ids must have the g-shape', () => {
  assert.equal(isGroupId('gabc1'), true); assert.equal(isGroupId('abc'), false); assert.equal(isGroupId('g<x>'), false);
  const out = cleanGroups([{ id: GA, label: '  Box <b>A</b> ', kind: 'zzz', environment: 'mars', x: 1 }, { id: GA, label: 'dup' }, { id: 'bad', label: 'x' }, { id: GB, label: '' }, null]);
  assert.deepEqual(out, [{ id: GA, label: 'Box bA/b', kind: 'place' }]);
  assert.deepEqual(cleanGroups('x'), []);
  const many = Array.from({ length: 60 }, (_, i) => ({ id: `gx${String(i).padStart(3, '0')}`, label: `G${i}` }));
  assert.equal(cleanGroups(many).length, 40);
  assert.deepEqual(mergeGroups([{ id: GA, label: 'Local', kind: 'place' }], [{ id: GA, label: 'Remote' }, { id: GB, label: 'Nový' }]).map((g) => g.label), ['Local', 'Nový']);
});

test('groupId is only a selector: stored on the plant, validated, removed with the group', async () => {
  const { db, ids } = await setup();
  assert.equal((await getPlant(db, ids[0])).groupId, GA);
  assert.equal((await getPlant(db, ids[3])).groupId, undefined);
  await assert.rejects(assignGroup(db, [ids[3]], 'gnothere1'), /Neplatn|invalid|Chyb/i);
  assert.equal(await assignGroup(db, [ids[3], 'ghost'], GB), 1);
  assert.equal((await getPlant(db, ids[3])).groupId, GB);
  await updatePlantMeta(db, ids[3], { groupId: null });
  assert.equal((await getPlant(db, ids[3])).groupId, undefined);
  await saveGroups(db, [{ id: GB, label: 'Záhon 1', kind: 'bed' }]);                  // Box A removed
  assert.equal((await getPlant(db, ids[0])).groupId, undefined);
  assert.equal((await readGroups(db)).length, 1);
});

test('appendBulk writes one event per plant with a shared opId; truth stays per plant', async () => {
  const { db, ids } = await setup();
  const res = await appendBulk(db, ids.slice(0, 3), [{ type: 'fertilizing', payload: { product: 'NPK' }, occurredAt: day(5) }], { now: day(5) });
  assert.equal(res.events.length, 3); assert.deepEqual(res.skipped, []);
  assert.equal(new Set(res.events.map((e) => e.opId)).size, 1);
  assert.equal(new Set(res.events.map((e) => e.plantId)).size, 3);
  for (const id of ids.slice(0, 3)) assert.equal((await getEvents(db, id)).filter((e) => e.type === 'fertilizing').length, 1);
  assert.equal((await getEvents(db, ids[3])).filter((e) => e.type === 'fertilizing').length, 0);
  assert.ok((await getPlant(db, ids[0])).cache.lastFertilizedAt || true);
});

test('appendBulk skips plants that fail validation and writes the rest; limits are enforced', async () => {
  const { db, ids } = await setup();
  await appendEvents(db, ids[1], [{ type: 'harvest', payload: { freshWeight: 10 }, occurredAt: day(30) }, { type: 'archive', payload: {}, occurredAt: day(31) }], { now: day(31) });
  const res = await appendBulk(db, ids.slice(0, 3), [{ type: 'fertilizing', payload: {} }], { now: day(40) });
  assert.equal(res.events.length, 2);
  assert.equal(res.skipped.length, 1); assert.equal(res.skipped[0].plantId, ids[1]);
  // fn form: null skips
  const r2 = await appendBulk(db, ids, (p) => (p.id === ids[0] ? null : [{ type: 'note', payload: { text: 'x' } }]), { now: day(41) });
  assert.equal(r2.events.length, 3);                                                    // ids[1] archived accepts notes
  await assert.rejects(appendBulk(db, [], [{ type: 'note', payload: { text: 'x' } }]));
  await assert.rejects(appendBulk(db, Array.from({ length: 101 }, (_, i) => `p${i}`), [{ type: 'note', payload: { text: 'x' } }]));
});

test('bulk stage change: only plants for which the stage is valid; undo voids the whole operation', async () => {
  const { db, ids } = await setup();
  const fl = (await createPlant(db, basePlant({ name: 'Růže', category: 'flower', groupId: GA }), { now: T0 })).id;
  const res = await appendBulk(db, [...ids.slice(0, 2), fl], (p) => [{ type: 'stage_change', payload: { from: p.cache.stage, to: 'vegetative' }, occurredAt: day(10) }], { now: day(10) });
  assert.equal(res.events.length, 3);
  assert.equal((await getPlant(db, ids[0])).cache.stage, 'vegetative');
  const part = await appendBulk(db, [ids[2], fl], (p) => [{ type: 'stage_change', payload: { from: p.cache.stage, to: 'harvested' }, occurredAt: day(20) }], { now: day(20) });
  assert.equal(part.events.length, 1); assert.equal(part.skipped[0].plantId, fl);      // 'harvested' does not exist for flowers
  const undone = await voidBulk(db, res.events, { now: day(11) });
  assert.equal(undone.voided, 3);
  assert.equal((await getPlant(db, ids[0])).cache.stage, 'seedling');
  assert.equal((await voidBulk(db, res.events)).voided, 0);                             // second undo changes nothing
  const voids = (await getAllEvents(db)).filter((e) => e.type === 'void');
  assert.ok(voids.every((e) => e.opId));
});

test('commonStages is the intersection of valid stages', async () => {
  const { db, ids } = await setup();
  const fl = await createPlant(db, basePlant({ name: 'Růže', category: 'flower' }), { now: T0 });
  const herb = await getPlant(db, ids[0]);
  const both = commonStages([herb, fl]);
  assert.ok(both.length > 0); assert.ok(both.includes('seedling'));
  assert.deepEqual(commonStages([]), []);
});

test('clusterTasks merges the same task of ≥2 plants of one group; singles and other types stay', async () => {
  const { db, ids } = await setup();
  const plants = await listPlants(db);
  const tasks = computeTasks(plants, day(10), { hemisphere: 'north' });
  const byId = new Map(plants.map((p) => [p.id, p]));
  const groups = await readGroups(db);
  const items = clusterTasks(tasks, byId, groups);
  const clusters = items.filter((i) => i.kind === 'cluster');
  assert.ok(clusters.length >= 1);
  for (const c of clusters) { assert.equal(c.group.id, GA); assert.ok(c.tasks.length >= 2); assert.ok(c.tasks.every((t) => t.type === c.type && t.urgency === c.urgency)); }
  const loose = items.filter((i) => i.kind === 'task' && i.task.plantId === ids[3]);
  assert.ok(loose.length >= 1);                                                         // ungrouped plant is never merged
  assert.equal(items.reduce((n, i) => n + (i.kind === 'cluster' ? i.tasks.length : 1), 0), tasks.length);
  assert.equal(clusterTasks(tasks, byId, []).every((i) => i.kind === 'task'), true);    // no groups, no clusters
});

test('snoozeMany snoozes the given tasks and the dashboard honours it', async () => {
  const { db, ids } = await setup();
  const plants0 = await listPlants(db);
  const t0 = computeTasks(plants0, day(10), { hemisphere: 'north' }).filter((t) => t.type === 'moisture');
  assert.ok(t0.length >= 3);
  const items = t0.filter((t) => ids.slice(0, 3).includes(t.plantId)).map((t) => ({ plantId: t.plantId, key: t.snoozeKey }));
  await snoozeMany(db, items, day(13));
  const t1 = computeTasks(await listPlants(db), day(10), { hemisphere: 'north' }).filter((t) => t.type === 'moisture');
  assert.equal(t1.length, t0.length - 3);
});

test('groupsFromLocations proposes places used by ≥2 ungrouped plants', async () => {
  const db = await freshDb();
  for (const [n, loc] of [['a', 'Balkon'], ['b', 'balkon'], ['c', 'Balkon'], ['d', 'Okno'], ['e', '']]) await createPlant(db, basePlant({ name: n, location: loc }), { now: T0 });
  const plants = await listPlants(db);
  const prop = groupsFromLocations(plants, []);
  assert.equal(prop.length, 1); assert.equal(prop[0].label, 'Balkon'); assert.equal(prop[0].plantIds.length, 2);
  assert.deepEqual(groupsFromLocations(plants, [{ id: GA, label: 'balkon', kind: 'place' }]), []);
});

test('compareAcrossGroups lists only varieties grown in ≥2 groups', async () => {
  const { db, ids } = await setup();
  const b = await createPlant(db, basePlant({ name: 'Bazalka B', groupId: GB }), { now: T0 });
  await appendEvents(db, ids[0], [{ type: 'harvest', payload: { freshWeight: 30 }, occurredAt: day(40) }]);
  await appendEvents(db, b.id, [{ type: 'harvest', payload: { freshWeight: 50 }, occurredAt: day(40) }]);
  const plants = await listPlants(db);
  const byPlant = new Map();
  for (const e of await getAllEvents(db)) { if (!byPlant.has(e.plantId)) byPlant.set(e.plantId, []); byPlant.get(e.plantId).push(e); }
  const cmp = compareAcrossGroups(plants, byPlant, await readGroups(db));
  assert.equal(cmp.length, 1); assert.equal(cmp[0].rows.length, 2);
  const a = cmp[0].rows.find((r) => r.group.id === GA), bb = cmp[0].rows.find((r) => r.group.id === GB);
  assert.equal(a.yieldPerPlant, 30); assert.equal(bb.yieldPerPlant, 50); assert.equal(a.n, 3);
});

test('backup round trip keeps groups, groupId and opId; groups union-merge; junk is dropped', async () => {
  const { db, ids } = await setup();
  await appendBulk(db, ids.slice(0, 2), [{ type: 'fertilizing', payload: {} }], { now: day(5), opId: 'opTEST1' });
  const bytes = await exportBackup(db, { JSZip });
  const dst = await freshDb();
  await saveGroups(dst, [{ id: 'glocal01', label: 'Lokální', kind: 'cohort' }, { id: GA, label: 'Moje A', kind: 'place' }]);
  await importBackup(dst, bytes, { JSZip });
  const g = await readGroups(dst);
  assert.deepEqual(g.map((x) => x.id).sort(), [GA, GB, 'glocal01'].sort());
  assert.equal(g.find((x) => x.id === GA).label, 'Moje A');                              // local wins
  assert.equal((await listPlants(dst)).filter((p) => p.groupId === GA).length, 3);
  assert.equal((await getAllEvents(dst)).filter((e) => e.opId === 'opTEST1').length, 2);

  const zip = await JSZip.loadAsync(bytes);
  const data = JSON.parse(await zip.file('data.json').async('string'));
  data.meta.groups = [{ id: 'bad id', label: 'x' }, { id: 'gok0001', label: '<i>ok</i>' }];
  data.plants[0].groupId = '<script>';
  data.events[0].opId = 'bad op id!';
  zip.file('data.json', JSON.stringify(data));
  const d2 = await freshDb();
  await importBackup(d2, await zip.generateAsync({ type: 'uint8array' }), { JSZip });
  assert.deepEqual((await readGroups(d2)).map((x) => x.label), ['iok/i']);
  assert.ok((await listPlants(d2)).every((p) => p.groupId === undefined || isGroupId(p.groupId)));
  assert.ok((await getAllEvents(d2)).every((e) => e.opId === undefined || /^[\w.-]+$/.test(e.opId)));
  assert.equal(await metaGet(d2, 'schemaVersion'), 4);
});
