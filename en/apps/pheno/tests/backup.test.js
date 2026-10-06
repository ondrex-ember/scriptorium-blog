import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { appendEvents, createPlant } from '../js/events.js';
import { getAllEvents, listPhotoKeys, listPlants, metaGet, metaSet, putPhoto } from '../js/storage.js';
import { backupReminderDue, dismissBackupReminder, exportBackup, importBackup, readBackup } from '../js/backup.js';
import { computeTasks } from '../js/calendar.js';
import { T0, basePlant, day, freshDb } from './harness.js';

const JSZip = createRequire(import.meta.url)('jszip');
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const add = (db, id, type, payload, at) => appendEvents(db, id, [{ type, payload, occurredAt: at }], { now: day(400) });

async function seed(db) {
  const a = await createPlant(db, basePlant({ name: 'Rajče', variety: 'San Marzano', category: 'vegetable', environment: 'outdoor' }), { now: T0 });
  await metaSet(db, 'hemisphere', 'south');
  for (let i = 1; i <= 6; i++) await add(db, a.id, 'moisture_check', { answer: ['dry', 'ok', 'wet', 'dry', 'ok', 'dry'][i - 1], watered: i !== 3 }, day(i * 3));
  await add(db, a.id, 'stage_change', { from: 'seedling', to: 'fruiting' }, day(30));
  await add(db, a.id, 'problem', { problemType: 'pest', severity: 2 }, day(31));
  await add(db, a.id, 'harvest', { totalWeight: 2, pieceCount: 9 }, day(60));
  await add(db, a.id, 'evaluation', { scores: { overall: 4 }, wouldGrowAgain: true, note: '<b>ok</b>' }, day(74));
  await add(db, a.id, 'archive', {}, day(75));
  const b = await createPlant(db, basePlant({ name: 'Monstera', category: 'other', lifecycle: 'perennial', environment: 'indoor', harvestable: false }), { now: T0 });
  await add(db, b.id, 'milestone', { label: 'Přesazení' }, day(10));
  await putPhoto(db, { id: 'ph1', plantId: a.id, blob: new Blob([JPEG], { type: 'image/jpeg' }), createdAt: T0 });
  return { a, b };
}
const strip = (plants) => plants.map((p) => ({ ...p, cache: { ...p.cache, snoozedUntil: {} } })).sort((x, y) => (x.id < y.id ? -1 : 1));

test('export → wipe → import gives identical plants, events, photos, meta', async () => {
  const src = await freshDb();
  await seed(src);
  const bytes = await exportBackup(src, { JSZip, now: day(80) });
  const zip = await JSZip.loadAsync(bytes);
  assert.deepEqual(Object.keys(zip.files).sort(), ['data.json', 'manifest.json', 'photos/', 'photos/ph1.jpg']);
  const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
  assert.equal(manifest.schemaVersion, 2); assert.equal(manifest.counts.plants, 2); assert.equal(manifest.counts.photos, 1);

  const dst = await freshDb();
  const rep = await importBackup(dst, bytes, { JSZip });
  assert.equal(rep.plantsAdded, 2); assert.equal(rep.photosAdded, 1); assert.deepEqual(rep.conflicts, []);
  assert.deepEqual(strip(await listPlants(dst)), strip(await listPlants(src)));
  const key = (e) => e.id; const evs = async (d) => (await getAllEvents(d)).sort((x, y) => (key(x) < key(y) ? -1 : 1));
  assert.deepEqual(await evs(dst), await evs(src));
  assert.deepEqual(await listPhotoKeys(dst), ['ph1']);
  assert.equal(await metaGet(dst, 'hemisphere'), 'south');
  assert.equal(await metaGet(dst, 'lastExportAt'), undefined);      // device-specific keys do not travel
  assert.equal(await metaGet(dst, 'schemaVersion'), 2);
  const t = async (d) => computeTasks(await listPlants(d), day(90), { hemisphere: 'south' }).map((x) => [x.plantId, x.type, x.dueAt]);
  assert.deepEqual(await t(dst), await t(src));
});

test('importing twice is idempotent; merging unions events by id and reports conflicts', async () => {
  const src = await freshDb();
  const { a } = await seed(src);
  const bytes = await exportBackup(src, { JSZip });
  const dst = await freshDb();
  await importBackup(dst, bytes, { JSZip });
  const again = await importBackup(dst, bytes, { JSZip });
  assert.equal(again.plantsAdded, 0); assert.equal(again.eventsAdded, 0); assert.equal(again.photosAdded, 0);
  assert.equal((await getAllEvents(dst)).length, (await getAllEvents(src)).length);

  await add(src, a.id, 'note', { text: 'jen ve zdroji' }, day(76));      // archived plants accept notes
  const more = await importBackup(dst, await exportBackup(src, { JSZip }), { JSZip });
  assert.equal(more.eventsAdded, 1);

  // same event id with different content → conflict, local copy is kept
  const zip = await JSZip.loadAsync(await exportBackup(src, { JSZip }));
  const data = JSON.parse(await zip.file('data.json').async('string'));
  data.events.find((e) => e.type === 'harvest').payload.totalWeight = 99;
  zip.file('data.json', JSON.stringify(data));
  const r = await importBackup(dst, await zip.generateAsync({ type: 'uint8array' }), { JSZip });
  assert.equal(r.conflicts.length, 1);
  assert.equal((await getAllEvents(dst)).find((e) => e.type === 'harvest').payload.totalWeight, 2);
});

test('import refuses newer schema, garbage, and drops invalid or orphan records', async () => {
  const dst = await freshDb();
  await assert.rejects(importBackup(dst, new Uint8Array([1, 2, 3]), { JSZip }), /ZIP/);
  const mk = async (manifest, data, photos = {}) => {
    const z = new JSZip(); z.file('manifest.json', JSON.stringify(manifest)); z.file('data.json', JSON.stringify(data));
    for (const [k, v] of Object.entries(photos)) z.file(`photos/${k}.jpg`, v);
    return z.generateAsync({ type: 'uint8array' });
  };
  await assert.rejects(importBackup(dst, await mk({ schemaVersion: 3 }, { plants: [], events: [] }), { JSZip }), /novější/);
  const good = { id: 'p1', name: '<img src=x onerror=alert(1)>', category: 'herb', environment: 'indoor', startDate: T0, lifecycle: 'cycle', harvestable: true, extra: 'x' };
  const ev = (o) => ({ id: 'e1', plantId: 'p1', type: 'note', occurredAt: T0, recordedAt: T0, payload: { text: 'a' }, ...o });
  const bytes = await mk({ schemaVersion: 1 }, {
    plants: [good, { id: 'bad', name: 'x', category: 'nope', environment: 'indoor', startDate: T0 }],
    events: [ev({}), ev({ id: 'e2', type: 'hack' }), ev({ id: 'e3', plantId: 'ghost' }), ev({ id: 'e4', occurredAt: 'nonsense' })],
    photos: [{ id: 'good', plantId: 'p1' }, { id: 'fake', plantId: 'p1' }]
  }, { good: JPEG, fake: new Uint8Array([1, 2, 3]) });
  const r = await importBackup(dst, bytes, { JSZip });
  assert.equal(r.plantsAdded, 1); assert.equal(r.eventsAdded, 1); assert.equal(r.photosAdded, 1);
  assert.ok(r.skipped >= 5);
  const [p] = await listPlants(dst);
  assert.equal('extra' in p, false);
  assert.equal(p.name, '<img src=x onerror=alert(1)>');          // stored as text; UI renders via textContent
});

test('readBackup validates without writing', async () => {
  const z = new JSZip(); z.file('manifest.json', '{"schemaVersion":1}');
  await assert.rejects(readBackup(await z.generateAsync({ type: 'uint8array' }), { JSZip }), /chybí/);
});

test('backup reminder: 30 days and 10 new events since last export, dismissal hides for 7 days', async () => {
  const db = await freshDb();
  assert.equal(await backupReminderDue(db, day(100)), false);           // nothing to back up
  const p = await createPlant(db, basePlant(), { now: day(400) });
  for (let i = 0; i < 12; i++) await add(db, p.id, 'note', { text: `n${i}` }, day(i + 1));
  const at = (n) => new Date(Date.parse(day(400)) + n * 864e5).toISOString();   // recordedAt of the events above is day(400)
  assert.equal(await backupReminderDue(db, at(10)), false);              // too soon
  assert.equal(await backupReminderDue(db, at(31)), true);
  await dismissBackupReminder(db, at(31));
  assert.equal(await backupReminderDue(db, at(35)), false);
  assert.equal(await backupReminderDue(db, at(39)), true);
  await exportBackup(db, { JSZip, now: at(39) });
  assert.equal(await backupReminderDue(db, at(80)), false);              // no new events since the export
});

test('RCv0.191: batches, care events, rules and pot fields survive a round trip; invalid rules are dropped', async () => {
  const src = await freshDb();
  const a = await createPlant(src, basePlant({ name: 'Bazalka', potVolumeL: 3, substrate: 'coco' }), { now: T0 });
  await metaSet(src, 'rules', { 'cat.herb.pestCheckDays': 4, 'batch.storing.driedDays': 9999, 'bogus.key': 1 });
  await add(src, a.id, 'harvest', { freshWeight: 30, processingMethod: 'drying' }, day(40));
  const batch = (await getAllEvents(src)).find((e) => e.type === 'harvest');
  await add(src, a.id, 'batch_check', { batchId: batch.id, dryness: 2, mold: false }, day(42));
  await add(src, a.id, 'batch_step', { batchId: batch.id, phase: 'ready' }, day(46));
  await add(src, a.id, 'care', { kind: 'repotting', potVolumeL: 6 }, day(47));
  const bytes = await exportBackup(src, { JSZip });
  const dst = await freshDb();
  const rep = await importBackup(dst, bytes, { JSZip });
  assert.equal(rep.eventsAdded, (await getAllEvents(src)).length);
  assert.equal(rep.skipped, 0);
  assert.deepEqual(await metaGet(dst, 'rules'), { 'cat.herb.pestCheckDays': 4 });
  const [got] = await listPlants(dst);
  assert.equal(got.potVolumeL, 3); assert.equal(got.substrate, 'coco');
  assert.equal(got.cache.batches[0].phase, 'ready');
  assert.equal(got.cache.pot.volumeL, 6);
});
