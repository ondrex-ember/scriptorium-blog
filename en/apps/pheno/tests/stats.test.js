import test from 'node:test';
import assert from 'node:assert/strict';
import { appendEvents, createPlant, voidEvent } from '../js/events.js';
import { getPlant, getAllEvents, listPlants } from '../js/storage.js';
import { getPlantTasks } from '../js/calendar.js';
import { aggregateVarieties, currentEvaluations, evaluationHistory, harvestTotals, plantSummary } from '../js/stats.js';
import { T0, basePlant, day, freshDb } from './harness.js';

const evs = async (db, id) => (await getAllEvents(db)).filter((e) => e.plantId === id);
const add = (db, id, type, payload, at) => appendEvents(db, id, [{ type, payload, occurredAt: at }], { now: day(400) });

async function tomato(db, name = 'Rajče #1', variety = 'San Marzano') {
  const p = await createPlant(db, basePlant({ name, variety, category: 'vegetable', environment: 'outdoor' }), { now: T0 });
  await add(db, p.id, 'stage_change', { from: 'seedling', to: 'fruiting' }, day(60));
  await add(db, p.id, 'harvest', { totalWeight: 2, pieceCount: 10 }, day(90));
  await add(db, p.id, 'harvest', { totalWeight: 3, pieceCount: 14 }, day(100));
  await add(db, p.id, 'harvest', { totalWeight: 1, pieceCount: 5 }, day(110));
  await add(db, p.id, 'stage_change', { from: 'fruiting', to: 'done' }, day(111));
  return p;
}

test('scenario 1: tomato cycle, 3 harvests, versioned evaluations 14 and 60 days after', async () => {
  const db = await freshDb();
  const p = await tomato(db);
  await add(db, p.id, 'evaluation', { scores: { overall: 3, taste: 3 }, wouldGrowAgain: false }, day(124));
  await add(db, p.id, 'evaluation', { scores: { overall: 5, taste: 5 }, wouldGrowAgain: true, note: 'lepší po čase' }, day(170));
  const events = await evs(db, p.id);
  const hist = evaluationHistory(events);
  assert.equal(hist.length, 2);
  assert.deepEqual(hist.map((h) => h.daysAfterHarvest), [60, 14]);   // newest first
  assert.equal(currentEvaluations(await getPlant(db, p.id), events)[0].payload.scores.overall, 5);
  assert.equal(harvestTotals(p, events).totalWeight, 6);
  const sum = plantSummary(p, events);
  assert.equal(sum.seasons, 1); assert.equal(sum.yield, 6); assert.equal(sum.overall, 5); assert.equal(sum.wouldGrowAgain, true);
  assert.equal(sum.cycleDays, 111);
  assert.equal(events.filter((e) => e.type === 'evaluation').length, 2);   // nothing overwritten
});

test('terminal (not archived) plant keeps only evaluation reminders; archived gets none', async () => {
  const db = await freshDb();
  const p = await tomato(db);
  const plant = await getPlant(db, p.id);
  const types = getPlantTasks(plant, day(126)).map((t) => t.type);
  assert.deepEqual(types, ['evaluation']);
  await add(db, p.id, 'archive', {}, day(127));
  assert.deepEqual(getPlantTasks(await getPlant(db, p.id), day(130)), []);
});

test('voided evaluation drops out; evaluation without overall never reaches stats', async () => {
  const db = await freshDb();
  const p = await tomato(db);
  await add(db, p.id, 'evaluation', { scores: { overall: 2 } }, day(124));
  const { events } = await add(db, p.id, 'evaluation', { scores: { overall: 5 } }, day(130));
  await assert.rejects(add(db, p.id, 'evaluation', { scores: { taste: 4 } }, day(131)));
  await voidEvent(db, p.id, events[0].id);
  const all = await evs(db, p.id);
  assert.equal(plantSummary(p, all).overall, 2);
  assert.ok(Number.isFinite(plantSummary(p, all).overall));
});

test('scenario 2: strawberry bed, perennial, two seasons in variety view', async () => {
  const db = await freshDb();
  const p = await createPlant(db, basePlant({ name: 'Jahody', variety: 'Elsanta', category: 'fruit', lifecycle: 'perennial', environment: 'outdoor' }), { now: T0 });
  await add(db, p.id, 'harvest', { totalWeight: 1.5 }, '2026-06-20T08:00:00.000Z');
  await add(db, p.id, 'harvest', { totalWeight: 2.5 }, '2027-06-20T08:00:00.000Z');
  await add(db, p.id, 'evaluation', { scores: { overall: 3 }, season: 2026 }, '2026-07-10T08:00:00.000Z');
  await add(db, p.id, 'evaluation', { scores: { overall: 4 }, season: 2027 }, '2027-07-10T08:00:00.000Z');
  await add(db, p.id, 'evaluation', { scores: { overall: 5 }, season: 2027 }, '2027-08-10T08:00:00.000Z');
  const events = await evs(db, p.id);
  const cur = currentEvaluations(await getPlant(db, p.id), events);
  assert.deepEqual(cur.map((e) => [e.payload.season, e.payload.scores.overall]), [[2026, 3], [2027, 5]]);
  const [g] = aggregateVarieties(await listPlants(db), new Map([[p.id, events]]));
  assert.equal(g.cycles, 2); assert.equal(g.avgOverall, 4); assert.equal(g.totalYield, 4);
});

test('aggregation groups by variety key across spellings and never mixes categories', async () => {
  const db = await freshDb();
  const a = await tomato(db, 'A', 'San Marzano');
  const b = await tomato(db, 'B', ' san  marzáno ');
  const c = await createPlant(db, basePlant({ name: 'Bazalka', variety: 'San Marzano' }), { now: T0 });
  const d = await createPlant(db, basePlant({ name: 'Bez odrůdy', variety: '' }), { now: T0 });
  await add(db, a.id, 'evaluation', { scores: { overall: 4 }, wouldGrowAgain: true }, day(124));
  await add(db, b.id, 'evaluation', { scores: { overall: 2 }, wouldGrowAgain: false }, day(124));
  const plants = await listPlants(db);
  const all = await getAllEvents(db);
  const by = new Map(); for (const e of all) by.set(e.plantId, [...(by.get(e.plantId) || []), e]);
  const groups = aggregateVarieties(plants, by);
  assert.equal(groups.length, 3);
  const tom = groups.find((g) => g.category === 'vegetable');
  assert.equal(tom.plantCount, 2); assert.equal(tom.avgOverall, 3); assert.equal(tom.wouldGrowAgainShare, 0.5);
  assert.equal(tom.totalYield, 12); assert.equal(tom.avgCycleDays, 111); assert.equal(tom.problemsPerPlant, 0);
  const unnamed = groups.find((g) => g.unnamed);
  assert.equal(unnamed.label, 'Bez odrůdy');
  assert.equal(groups.find((g) => g.category === 'herb' && !g.unnamed).avgOverall, null);
});
