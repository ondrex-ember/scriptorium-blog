import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { appendBulk, appendEvents, createPlant, readTemplates, saveTemplates, snoozeTask, voidEvent } from '../js/events.js';
import { MAX_TEMPLATES, cleanTemplates, customTasks, mergeTemplates, taskTitle, templateApplies } from '../js/customtasks.js';
import { exportBackup, importBackup } from '../js/backup.js';
import { clusterTasks } from '../js/groups.js';
import { computeTasks, getPlantTasks } from '../js/calendar.js';
import { getAllEvents, getPlant, listPlants } from '../js/storage.js';
import { T0, basePlant, day, freshDb } from './harness.js';

const JSZip = createRequire(import.meta.url)('jszip');
const TA = 'tprune01', TB = 'tfixed02', TC = 'tstage03', TD = 'tonce004';
const TEMPLATES = [
  { id: TA, label: 'Prořezat', icon: 'scissors', mode: 'recurring', intervalDays: 10, anchor: 'lastDone' },
  { id: TB, label: 'Změřit pH', icon: 'thermo', mode: 'recurring', intervalDays: 7, anchor: 'fixed' },
  { id: TC, label: 'Zakrýt', icon: 'sun', mode: 'recurring', intervalDays: 14, anchor: 'stageStart', offsetDays: 3, appliesTo: { stages: ['flowering'] } },
  { id: TD, label: 'Přesadit', icon: 'pot', mode: 'once', intervalDays: 30, anchor: 'lastDone' }
];
const ev = (db, id, type, payload, at) => appendEvents(db, id, [{ type, payload, occurredAt: at }], { now: at });
const custom = (plants, at, opts) => computeTasks(plants, at, { ...opts, taskTemplates: TEMPLATES }).filter((t) => t.type === 'custom');
const OPTS = { hemisphere: 'north', taskTemplates: TEMPLATES };

async function setup() {
  const db = await freshDb();
  await saveTemplates(db, TEMPLATES);
  const p = await createPlant(db, basePlant({ name: 'Bazalka' }), { now: T0 });
  return { db, id: p.id };
}

test('cleanTemplates whitelists fields, clamps numbers, drops junk and limits the count', () => {
  const out = cleanTemplates([
    { id: 'tabc1', label: ' <b>Zalít</b> ', icon: 'nope', mode: 'x', intervalDays: 0, anchor: 'zzz', appliesTo: { categories: ['herb', 'nope'], stages: ['flowering', 'x'], environments: ['indoor'] }, extra: 1 },
    { id: 'tabc1', label: 'dup' }, { id: 'bad', label: 'x' }, { id: 'tabc2', label: '' }, null,
    { id: 'tabc3', label: 'Od fáze', anchor: 'stageStart', intervalDays: 400 }
  ]);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { id: 'tabc1', label: 'bZalít/b', icon: 'check', mode: 'recurring', intervalDays: 7, anchor: 'lastDone', appliesTo: { categories: ['herb'], stages: ['flowering'], environments: ['indoor'] } });
  assert.equal(out[1].intervalDays, 7); assert.equal(out[1].offsetDays, 7);
  assert.equal(cleanTemplates(Array.from({ length: 50 }, (_, i) => ({ id: `tx${String(i).padStart(3, '0')}`, label: `T${i}` }))).length, MAX_TEMPLATES);
  assert.deepEqual(mergeTemplates([{ id: 'tabc1', label: 'Local' }], [{ id: 'tabc1', label: 'Remote' }, { id: 'tabc9', label: 'New' }]).map((t) => t.label), ['Local', 'New']);
});

test('assign → recurring lastDone: due = assigned + interval, done moves it, snooze is cleared by done', async () => {
  const { db, id } = await setup();
  await ev(db, id, 'task_assign', { templateId: TA, action: 'enable' }, day(2));
  let p = await getPlant(db, id);
  assert.equal(p.cache.customTasks[TA].state, 'active');
  const t = customTasks(p, day(3), TEMPLATES);
  assert.equal(t.length, 1); assert.equal(t[0].dueAt, day(12)); assert.equal(t[0].snoozeKey, `custom:${TA}`);
  assert.equal(getPlantTasks(p, day(3), OPTS).filter((x) => x.type === 'custom').length, 1);
  await snoozeTask(db, id, `custom:${TA}`, day(20));
  assert.equal(getPlantTasks(await getPlant(db, id), day(13), OPTS).filter((x) => x.type === 'custom').length, 0);
  await ev(db, id, 'task_done', { ref: TA }, day(13));
  p = await getPlant(db, id);
  assert.equal(p.cache.customTasks[TA].doneCount, 1);
  assert.equal(p.cache.snoozedUntil[`custom:${TA}`], undefined);
  assert.equal(customTasks(p, day(14), TEMPLATES)[0].dueAt, day(23));
  assert.equal(taskTitle({ type: 'custom', label: 'Prořezat' }), 'Prořezat');
});

test('fixed anchor keeps a grid regardless of when it was done', async () => {
  const { db, id } = await setup();
  await ev(db, id, 'task_assign', { templateId: TB, action: 'enable' }, day(0));
  assert.equal(customTasks(await getPlant(db, id), day(1), TEMPLATES)[0].dueAt, day(7));
  await ev(db, id, 'task_done', { ref: TB }, day(9));            // done late
  assert.equal(customTasks(await getPlant(db, id), day(10), TEMPLATES)[0].dueAt, day(14));   // grid unchanged
  await ev(db, id, 'task_done', { ref: TB }, day(15));
  assert.equal(customTasks(await getPlant(db, id), day(16), TEMPLATES)[0].dueAt, day(21));
});

test('stageStart anchor and the appliesTo filter follow the current stage', async () => {
  const { db, id } = await setup();
  await ev(db, id, 'task_assign', { templateId: TC, action: 'enable' }, day(1));
  assert.equal(customTasks(await getPlant(db, id), day(5), TEMPLATES).length, 0);              // seedling: filtered out
  await ev(db, id, 'stage_change', { from: 'seedling', to: 'flowering' }, day(20));
  const p = await getPlant(db, id);
  assert.equal(templateApplies(TEMPLATES[2], p), true);
  assert.equal(customTasks(p, day(21), TEMPLATES)[0].dueAt, day(23));                          // stage start + 3
  await ev(db, id, 'task_done', { ref: TC }, day(24));
  assert.equal(customTasks(await getPlant(db, id), day(25), TEMPLATES)[0].dueAt, day(38));     // + interval
  await ev(db, id, 'stage_change', { from: 'flowering', to: 'harvested' }, day(30));
  assert.equal(customTasks(await getPlant(db, id), day(31), TEMPLATES).length, 0);             // stage no longer matches
});

test('once-mode template ends after one completion; pause and end stop it; re-enable starts fresh', async () => {
  const { db, id } = await setup();
  await ev(db, id, 'task_assign', { templateId: TD, action: 'enable' }, day(0));
  assert.equal(customTasks(await getPlant(db, id), day(1), TEMPLATES).length, 1);
  await ev(db, id, 'task_done', { ref: TD }, day(31));
  assert.equal(customTasks(await getPlant(db, id), day(32), TEMPLATES).length, 0);
  await ev(db, id, 'task_assign', { templateId: TA, action: 'enable' }, day(0));
  await ev(db, id, 'task_assign', { templateId: TA, action: 'pause' }, day(1));
  assert.equal(customTasks(await getPlant(db, id), day(30), TEMPLATES).filter((t) => t.ref === TA).length, 0);
  await ev(db, id, 'task_assign', { templateId: TA, action: 'enable' }, day(40));
  assert.equal(customTasks(await getPlant(db, id), day(41), TEMPLATES).find((t) => t.ref === TA).dueAt, day(50));
  await ev(db, id, 'task_assign', { templateId: TA, action: 'end' }, day(42));
  assert.equal(customTasks(await getPlant(db, id), day(60), TEMPLATES).filter((t) => t.ref === TA).length, 0);
});

test('validation: unknown template, double enable, done without assignment, bad one-off, archived plant', async () => {
  const { db, id } = await setup();
  await assert.rejects(ev(db, id, 'task_assign', { templateId: 'tnone001', action: 'enable' }, day(1)));
  await assert.rejects(ev(db, id, 'task_assign', { templateId: TA, action: 'explode' }, day(1)));
  await assert.rejects(ev(db, id, 'task_assign', { templateId: TA, action: 'pause' }, day(1)));       // not assigned yet
  await assert.rejects(ev(db, id, 'task_done', { ref: TA }, day(1)));
  await ev(db, id, 'task_assign', { templateId: TA, action: 'enable' }, day(1));
  await assert.rejects(ev(db, id, 'task_assign', { templateId: TA, action: 'enable' }, day(2)));      // already active
  await assert.rejects(ev(db, id, 'task_once', { label: '   ', dueAt: day(5) }, day(1)));
  await assert.rejects(ev(db, id, 'task_once', { label: 'x', dueAt: 'soon' }, day(1)));
  await ev(db, id, 'archive', {}, day(3));
  await assert.rejects(ev(db, id, 'task_assign', { templateId: TB, action: 'enable' }, day(4)));
  assert.equal(customTasks(await getPlant(db, id), day(50), TEMPLATES).length, 0);                    // archived: no tasks
});

test('one-off tasks: due date, completion, sanitized label, limit', async () => {
  const { db, id } = await setup();
  const r = await ev(db, id, 'task_once', { label: '  Koupit <i>sítě</i> ', dueAt: day(5) }, day(1));
  const oid = r.events[0].id;
  assert.equal(r.events[0].payload.label, 'Koupit isítě/i');
  let t = customTasks(await getPlant(db, id), day(2), []);
  assert.equal(t.length, 1); assert.equal(t[0].dueAt, new Date(day(5)).toISOString()); assert.equal(t[0].once, true);
  await ev(db, id, 'task_done', { ref: oid }, day(4));
  assert.equal(customTasks(await getPlant(db, id), day(6), []).length, 0);
  await assert.rejects(ev(db, id, 'task_done', { ref: oid }, day(5)));                                // already done
  for (let i = 0; i < 30; i++) await ev(db, id, 'task_once', { label: `t${i}`, dueAt: day(10) }, day(7));
  await assert.rejects(ev(db, id, 'task_once', { label: 'one too many', dueAt: day(10) }, day(7)));
});

test('voiding task_done restores the due date; voiding the assignment removes the task', async () => {
  const { db, id } = await setup();
  await ev(db, id, 'task_assign', { templateId: TA, action: 'enable' }, day(0));
  const done = (await ev(db, id, 'task_done', { ref: TA }, day(11))).events[0];
  assert.equal(customTasks(await getPlant(db, id), day(12), TEMPLATES)[0].dueAt, day(21));
  await voidEvent(db, id, done.id);
  assert.equal(customTasks(await getPlant(db, id), day(12), TEMPLATES)[0].dueAt, day(10));
  const assign = (await getAllEvents(db)).find((e) => e.type === 'task_assign');
  await voidEvent(db, id, assign.id);
  assert.equal(customTasks(await getPlant(db, id), day(12), TEMPLATES).length, 0);
});

test('bulk assignment for a group, clustering of the same template, bulk done', async () => {
  const db = await freshDb();
  await saveTemplates(db, TEMPLATES);
  const ids = [];
  for (let i = 0; i < 3; i++) ids.push((await createPlant(db, basePlant({ name: `P${i}`, groupId: 'gcl00001' }), { now: T0 })).id);
  const r = await appendBulk(db, ids, [{ type: 'task_assign', payload: { templateId: TA, action: 'enable' }, occurredAt: day(0) }], { now: day(0) });
  assert.equal(r.events.length, 3);
  const plants = await listPlants(db);
  const tasks = computeTasks(plants, day(11), { ...OPTS }).filter((t) => t.type === 'custom');
  assert.equal(tasks.length, 3);
  const items = clusterTasks(tasks, new Map(plants.map((p) => [p.id, p])), [{ id: 'gcl00001', label: 'Box', kind: 'place' }]);
  assert.equal(items.length, 1); assert.equal(items[0].kind, 'cluster'); assert.equal(items[0].ref, TA);
  const d = await appendBulk(db, ids, [{ type: 'task_done', payload: { ref: TA }, occurredAt: day(11) }], { now: day(11) });
  assert.equal(d.events.length, 3);
  assert.equal(computeTasks(await listPlants(db), day(12), OPTS).filter((t) => t.type === 'custom').length, 0);
});

test('templates and task events survive a backup round trip; junk templates are dropped; merge keeps local', async () => {
  const { db, id } = await setup();
  await ev(db, id, 'task_assign', { templateId: TA, action: 'enable' }, day(1));
  await ev(db, id, 'task_once', { label: 'Jednorázově', dueAt: day(9) }, day(1));
  const bytes = await exportBackup(db, { JSZip });
  const dst = await freshDb();
  await saveTemplates(dst, [{ id: TA, label: 'Moje', intervalDays: 3 }]);
  await importBackup(dst, bytes, { JSZip });
  const list = await readTemplates(dst);
  assert.equal(list.find((t) => t.id === TA).label, 'Moje');
  assert.equal(list.length, 4);
  const got = (await listPlants(dst))[0];
  assert.equal(got.cache.customTasks[TA].state, 'active');
  assert.equal(got.cache.onceTasks.length, 1);
  const zip = await JSZip.loadAsync(bytes);
  const data = JSON.parse(await zip.file('data.json').async('string'));
  data.meta.taskTemplates = [{ id: 'bad id', label: 'x' }, { id: 'tgood001', label: '<s>ok</s>', intervalDays: 99999, icon: 'evil' }];
  zip.file('data.json', JSON.stringify(data));
  const d2 = await freshDb();
  await importBackup(d2, await zip.generateAsync({ type: 'uint8array' }), { JSZip });
  const l2 = await readTemplates(d2);
  assert.equal(l2.length, 1); assert.equal(l2[0].label, 'sok/s'); assert.equal(l2[0].intervalDays, 7); assert.equal(l2[0].icon, 'check');
});
