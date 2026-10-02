import test from 'node:test';
import assert from 'node:assert/strict';
import { appendEvents, createPlant, deletePlantPermanently, snoozeTask, voidEvent } from '../js/events.js';
import { clonePlantInput, projectPlant, registerProjector, unregisterProjector } from '../js/model.js';
import { getAllEvents, getEvents, getPhoto, getPlant, listPhotos, putPhoto } from '../js/storage.js';
import { T0, basePlant, day, freshDb } from './harness.js';

const ap = (db, id, type, payload, at) => appendEvents(db, id, [{ type, payload, occurredAt: at }]);
const rejects = (p, code) => assert.rejects(p, (e) => (code ? e.code === code : true));

test('createPlant writes created + stage_change and a projected cache', async () => {
  const db = await freshDb();
  const p = await createPlant(db, basePlant());
  const ev = await getEvents(db, p.id);
  assert.deepEqual(ev.map((e) => e.type).sort(), ['created', 'stage_change']);
  assert.equal(ev.find((e) => e.type === 'stage_change').payload.from, null);
  assert.equal(p.cache.stage, 'seedling');
  assert.equal(p.cache.environment, 'indoor');
  assert.equal(p.harvestable, true);
  assert.equal(p.varietyKey, 'genovese');
});

test('environment is required, no default; category and name required', async () => {
  const db = await freshDb();
  await rejects(createPlant(db, basePlant({ environment: undefined })), 'environment');
  await rejects(createPlant(db, basePlant({ category: 'x' })), 'category');
  await rejects(createPlant(db, basePlant({ name: '  ' })), 'name');
  assert.equal((await getAllEvents(db)).length, 0);
});

test('projection is deterministic and rebuildable from events', async () => {
  const db = await freshDb();
  const p = await createPlant(db, basePlant());
  await ap(db, p.id, 'watering', {}, day(2));
  await ap(db, p.id, 'fertilizing', { product: 'X' }, day(3));
  await ap(db, p.id, 'stage_change', { from: 'seedling', to: 'vegetative' }, day(4));
  const stored = await getPlant(db, p.id);
  const rebuilt = projectPlant({ ...stored, cache: undefined }, await getEvents(db, p.id));
  assert.deepEqual(rebuilt.cache, stored.cache);
  assert.equal(stored.cache.lastWateredAt, day(2));
  assert.equal(stored.cache.lastFertilizedAt, day(3));
  assert.equal(stored.cache.stage, 'vegetative');
});

test('backdated events replay in occurredAt order', async () => {
  const db = await freshDb();
  const p = await createPlant(db, basePlant());
  await ap(db, p.id, 'watering', {}, day(5));
  const r = await ap(db, p.id, 'watering', {}, day(2));
  assert.equal(r.plant.cache.lastWateredAt, day(5));
  assert.equal(r.events[0].payload.daysSinceWatering, null);
});

test('daysSinceWatering computed; watered checks count, dry-only checks do not', async () => {
  const db = await freshDb();
  const p = await createPlant(db, basePlant());
  await ap(db, p.id, 'watering', {}, day(1));
  const a = await ap(db, p.id, 'moisture_check', { answer: 'ok', watered: false }, day(3));
  assert.equal(a.events[0].payload.daysSinceWatering, 2);
  assert.equal(a.plant.cache.lastWateredAt, day(1));
  const b = await ap(db, p.id, 'moisture_check', { answer: 'dry', watered: true }, day(4));
  assert.equal(b.events[0].payload.daysSinceWatering, 3);
  assert.equal(b.plant.cache.lastWateredAt, day(4));
});

test('validation rejects bad payloads and leaves the log untouched', async () => {
  const db = await freshDb();
  const p = await createPlant(db, basePlant());
  const n = (await getEvents(db, p.id)).length;
  await rejects(ap(db, p.id, 'moisture_check', { answer: 'soggy' }), 'invalid');
  await rejects(ap(db, p.id, 'stage_change', { from: 'x', to: 'nope' }), 'invalid');
  await rejects(ap(db, p.id, 'problem', { problemType: 'nope' }), 'invalid');
  await rejects(ap(db, p.id, 'note', { text: ' ' }), 'invalid');
  await rejects(ap(db, p.id, 'harvest', {}), 'invalid');
  await rejects(ap(db, p.id, 'harvest', { freshWeight: -1 }), 'invalid');
  await rejects(ap(db, p.id, 'nonsense', {}), 'invalid');
  await rejects(ap(db, 'missing', 'note', { text: 'a' }), 'invalid');
  assert.equal((await getEvents(db, p.id)).length, n);
});

test('a failing event in a batch rolls back the whole batch', async () => {
  const db = await freshDb();
  const p = await createPlant(db, basePlant());
  const n = (await getEvents(db, p.id)).length;
  await rejects(appendEvents(db, p.id, [
    { type: 'note', payload: { text: 'ok' } }, { type: 'moisture_check', payload: { answer: 'bad' } }
  ]));
  assert.equal((await getEvents(db, p.id)).length, n);
});

test('problems: boost window from open problems, resolved ends it, never touches watering', async () => {
  const db = await freshDb();
  const p = await createPlant(db, basePlant());
  await ap(db, p.id, 'watering', {}, day(1));
  const r = await ap(db, p.id, 'problem', { problemType: 'mold', severity: 2 }, day(2));
  const c = r.plant.cache;
  assert.equal(c.openProblems.length, 1);
  assert.equal(c.pestBoostUntil, day(16));
  assert.equal(c.lastWateredAt, day(1));
  const res = await ap(db, p.id, 'problem_resolved', { problemId: r.events[0].id }, day(4));
  assert.equal(res.plant.cache.pestBoostUntil, null);
  await rejects(ap(db, p.id, 'problem_resolved', { problemId: 'nope' }), 'invalid');
});

test('void removes an event from the projection but keeps it in the log', async () => {
  const db = await freshDb();
  const p = await createPlant(db, basePlant());
  const w = await ap(db, p.id, 'watering', {}, day(2));
  const v = await voidEvent(db, p.id, w.events[0].id, 'omyl');
  assert.equal(v.plant.cache.lastWateredAt, null);
  assert.equal((await getEvents(db, p.id)).filter((e) => e.type === 'watering').length, 1);
  await rejects(voidEvent(db, p.id, w.events[0].id), 'invalid');
  const created = (await getEvents(db, p.id)).find((e) => e.type === 'created');
  await rejects(voidEvent(db, p.id, created.id), 'invalid');
});

test('harvest: fields per category, flower totalWeight optional, other not harvestable', async () => {
  const db = await freshDb();
  const flower = await createPlant(db, basePlant({ name: 'Růže', category: 'flower' }));
  await ap(db, flower.id, 'harvest', { bloomCount: 12 }, day(3));
  await ap(db, flower.id, 'harvest', { bloomCount: 5, totalWeight: 40 }, day(4));
  await rejects(ap(db, flower.id, 'harvest', { freshWeight: 4 }), 'invalid');
  const other = await createPlant(db, basePlant({ name: 'Cokoli', category: 'other' }));
  await rejects(ap(db, other.id, 'harvest', { quantity: 1 }), 'invalid');
  await rejects(ap(db, other.id, 'evaluation', { scores: { overall: 3 } }), 'invalid');
  const herb = await createPlant(db, basePlant());
  const h1 = await ap(db, herb.id, 'harvest', { freshWeight: 30, processedWeight: 8, processingMethod: 'drying', processingDays: 5 }, day(10));
  const h2 = await ap(db, herb.id, 'harvest', { freshWeight: 20 }, day(24));
  assert.equal(h1.events[0].payload.daysSinceLastHarvest, null);
  assert.equal(h2.events[0].payload.daysSinceLastHarvest, 14);
});

test('evaluation: overall required, 1–5 integers, criteria per category, versions append', async () => {
  const db = await freshDb();
  const p = await createPlant(db, basePlant());
  await rejects(ap(db, p.id, 'evaluation', { scores: { aroma: 4 } }), 'invalid');
  await rejects(ap(db, p.id, 'evaluation', { scores: { overall: 6 } }), 'invalid');
  await rejects(ap(db, p.id, 'evaluation', { scores: { overall: 3, taste: 3 } }), 'invalid');
  await rejects(ap(db, p.id, 'evaluation', { scores: { overall: 3 }, season: 2026 }), 'invalid');
  await ap(db, p.id, 'evaluation', { scores: { overall: 3, aroma: 4 } }, day(30));
  await ap(db, p.id, 'evaluation', { scores: { overall: 5, aroma: 5 }, wouldGrowAgain: true }, day(300));
  assert.equal((await getEvents(db, p.id)).filter((e) => e.type === 'evaluation').length, 2);
});

test('perennial: per-season evaluation allowed, perennial stages enforced', async () => {
  const db = await freshDb();
  const t = await createPlant(db, basePlant({ name: 'Jabloň', category: 'tree_shrub', environment: 'outdoor' }));
  assert.equal(t.lifecycle, 'perennial');
  assert.equal(t.cache.stage, 'planted');
  await ap(db, t.id, 'evaluation', { scores: { overall: 4, taste: 5 }, season: 2026 });
  await ap(db, t.id, 'evaluation', { scores: { overall: 3 }, season: 2027 });
  await ap(db, t.id, 'stage_change', { from: 'planted', to: 'dormant' });
  await rejects(ap(db, t.id, 'stage_change', { from: 'dormant', to: 'done' }), 'invalid');
  const herbPerennial = await createPlant(db, basePlant({ name: 'Levandule', lifecycle: 'perennial' }));
  assert.equal(herbPerennial.cache.stage, 'planted');
});

test('archive: only allowed events afterwards; unarchive restores', async () => {
  const db = await freshDb();
  const p = await createPlant(db, basePlant());
  await rejects(ap(db, p.id, 'unarchive', {}), 'notArchived');
  const a = await ap(db, p.id, 'archive', {}, day(20));
  assert.equal(a.plant.archivedAt, day(20));
  await rejects(ap(db, p.id, 'watering', {}), 'archived');
  await rejects(ap(db, p.id, 'archive', {}), 'archived');
  await ap(db, p.id, 'evaluation', { scores: { overall: 4 } });
  await ap(db, p.id, 'note', { text: 'po roce' });
  const u = await ap(db, p.id, 'unarchive', {}, day(30));
  assert.equal(u.plant.archivedAt, null);
  await ap(db, p.id, 'watering', {});
});

test('snooze: cache only, no event, carried over and cleared by the completing event', async () => {
  const db = await freshDb();
  const p = await createPlant(db, basePlant());
  const n = (await getEvents(db, p.id)).length;
  await snoozeTask(db, p.id, 'watering', day(9));
  await snoozeTask(db, p.id, 'fertilizing', day(9));
  assert.equal((await getEvents(db, p.id)).length, n);
  const r1 = await ap(db, p.id, 'note', { text: 'x' });
  assert.equal(r1.plant.cache.snoozedUntil.watering, day(9));
  const r2 = await ap(db, p.id, 'moisture_check', { answer: 'ok', watered: false });
  assert.equal(r2.plant.cache.snoozedUntil.watering, undefined);
  assert.equal(r2.plant.cache.snoozedUntil.fertilizing, day(9));
  const r3 = await ap(db, p.id, 'fertilizing', {});
  assert.deepEqual(r3.plant.cache.snoozedUntil, {});
});

test('environment_change updates cache and plant.environment', async () => {
  const db = await freshDb();
  const p = await createPlant(db, basePlant({ environment: 'indoor' }));
  const r = await ap(db, p.id, 'environment_change', { environment: 'greenhouse' }, day(10));
  assert.equal(r.plant.cache.environment, 'greenhouse');
  assert.equal(r.plant.environment, 'greenhouse');
  await rejects(ap(db, p.id, 'environment_change', { environment: 'moon' }), 'invalid');
});

test('projector registry lets later modules extend the projection', async () => {
  const db = await freshDb();
  const proj = {
    init: (c) => { c.cache.n = 0; },
    apply: (e, c) => { if (e.type === 'watering') c.cache.n += 1; },
    finalize: (c) => { c.cache.done = true; }
  };
  registerProjector(proj);
  try {
    const p = await createPlant(db, basePlant());
    const r = await ap(db, p.id, 'watering', {});
    assert.equal(r.plant.cache.n, 1);
    assert.equal(r.plant.cache.done, true);
  } finally { unregisterProjector(proj); }
});

test('clonePlantInput: next #n, carries variety, env, learned values', async () => {
  const db = await freshDb();
  const p = await createPlant(db, basePlant({ name: 'Bazalka' }));
  p.cache.dryingDays = { seedling: 2.5 };
  let c = clonePlantInput(p, []);
  assert.equal(c.name, 'Bazalka #2');
  assert.deepEqual(c.learnedBase, { seedling: 2.5 });
  c = clonePlantInput({ ...p, name: 'Bazalka #2' }, ['Bazalka', 'Bazalka #2', 'Bazalka #3']);
  assert.equal(c.name, 'Bazalka #4');
  const p2 = await createPlant(db, c);
  assert.equal(p2.learnedBase.seedling, 2.5);
  assert.equal(p2.variety, 'Genovese');
  assert.equal(p2.cache.environment, 'indoor');
});

test('permanent delete requires the typed name and removes events and photos', async () => {
  const db = await freshDb();
  const p = await createPlant(db, basePlant());
  const q = await createPlant(db, basePlant({ name: 'Jiná' }));
  await putPhoto(db, { id: 'ph1', plantId: p.id, blob: new Blob(['x']), createdAt: T0 });
  await putPhoto(db, { id: 'ph2', plantId: q.id, blob: new Blob(['y']), createdAt: T0 });
  await rejects(deletePlantPermanently(db, p.id, 'bazalka'), 'confirmName');
  assert.ok(await getPlant(db, p.id));
  const r = await deletePlantPermanently(db, p.id, 'Bazalka');
  assert.equal(r.events, 2);
  assert.equal(await getPlant(db, p.id), undefined);
  assert.equal((await getEvents(db, p.id)).length, 0);
  assert.equal((await listPhotos(db, p.id)).length, 0);
  assert.ok(await getPhoto(db, 'ph2'));
  assert.ok(await getPlant(db, q.id));
});
