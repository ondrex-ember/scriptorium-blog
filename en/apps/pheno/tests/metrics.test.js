import test from 'node:test';
import assert from 'node:assert/strict';
import { appendEvents, createPlant, voidEvent } from '../js/events.js';
import { getAllEvents, getPlant } from '../js/storage.js';
import { aggregateVarieties, plantSummary } from '../js/stats.js';
import { METRICS, aggregateMetric, metricsFor, patterns, spearman, stageDurations, stageStats, storageStats, varietyMetrics } from '../js/metrics.js';
import { T0, basePlant, day, freshDb } from './harness.js';

const add = (db, id, type, payload, at) => appendEvents(db, id, [{ type, payload, occurredAt: at }], { now: day(400) });
const evs = async (db, id) => (await getAllEvents(db)).filter((e) => e.plantId === id);
const metrics = async (db, id, now = day(200)) => metricsFor(await getPlant(db, id), await evs(db, id), now);

async function tomato(db, o = {}, name = 'Rajče') {
  const p = await createPlant(db, basePlant({ name, variety: 'San Marzano', category: 'vegetable', environment: 'outdoor', ...o }), { now: T0 });
  await add(db, p.id, 'stage_change', { from: 'seedling', to: 'fruiting' }, day(60));
  await add(db, p.id, 'harvest', { totalWeight: 2, pieceCount: 10 }, day(90));
  await add(db, p.id, 'harvest', { totalWeight: 3, pieceCount: 14 }, day(100));
  await add(db, p.id, 'stage_change', { from: 'fruiting', to: 'done' }, day(111));
  return p;
}

test('registry: every metric has key, unit, scope, better, compute; keys unique', () => {
  assert.equal(new Set(METRICS.map((m) => m.key)).size, METRICS.length);
  for (const m of METRICS) {
    assert.ok(m.key && m.unit && m.scope === 'plant' && typeof m.compute === 'function' && 'better' in m, m.key);
  }
});

test('missing inputs give null, never zero', async () => {
  const db = await freshDb();
  const p = await createPlant(db, basePlant({ name: 'Nová' }), { now: T0 });
  const m = await metrics(db, p.id, day(3));
  for (const k of Object.keys(m)) assert.equal(m[k], null, k);
});

test('yield per day and per litre need a weight and a day count / pot volume', async () => {
  const db = await freshDb();
  const a = await tomato(db);
  const m = await metrics(db, a.id);
  assert.equal(m.yieldPerDay, 45.05);                 // 5000 g / 111 d
  assert.equal(m.yieldPerLiter, null);                // no pot volume
  const b = await tomato(db, { potVolumeL: 20 }, 'Rajče 2');
  assert.equal((await metrics(db, b.id)).yieldPerLiter, 250);
  await add(db, b.id, 'care', { kind: 'repotting', potVolumeL: 25 }, day(30));
  assert.equal((await metrics(db, b.id)).yieldPerLiter, 200);   // final pot counts
  const c = await createPlant(db, basePlant({ name: 'Bez sklizně', category: 'vegetable' }), { now: T0 });
  assert.equal((await metrics(db, c.id)).yieldPerDay, null);
});

test('perennials have no per-day yield (no cycle to divide by)', async () => {
  const db = await freshDb();
  const p = await createPlant(db, basePlant({ name: 'Keř', category: 'tree_shrub', lifecycle: 'perennial', environment: 'outdoor' }), { now: T0 });
  await add(db, p.id, 'harvest', { totalWeight: 4 }, day(120));
  assert.equal((await metrics(db, p.id)).yieldPerDay, null);
});

test('processed/fresh ratio from harvests with both weights; voided harvest drops out', async () => {
  const db = await freshDb();
  const p = await createPlant(db, basePlant(), { now: T0 });
  await add(db, p.id, 'harvest', { freshWeight: 100, processedWeight: 25 }, day(40));
  const { events } = await add(db, p.id, 'harvest', { freshWeight: 100, processedWeight: 15 }, day(50));
  await add(db, p.id, 'harvest', { freshWeight: 50 }, day(55));                    // no processed weight: ignored
  assert.equal((await metrics(db, p.id)).processedRatio, 20);
  await voidEvent(db, p.id, events[0].id);
  assert.equal((await metrics(db, p.id)).processedRatio, 25);
});

test('care frequencies: null for short spans and zero logged events', async () => {
  const db = await freshDb();
  const p = await createPlant(db, basePlant(), { now: T0 });
  for (let i = 1; i <= 6; i++) await add(db, p.id, 'watering', {}, day(i * 5));
  await add(db, p.id, 'moisture_check', { answer: 'dry', watered: true }, day(31));
  await add(db, p.id, 'moisture_check', { answer: 'ok', watered: false }, day(32));
  const m = await metrics(db, p.id, day(35));
  assert.equal(m.wateringsPerWeek, 1.4);               // 7 waterings / 5 weeks
  assert.equal(m.fertilizingsPerCycle, null);          // nothing logged / cycle not finished
  const q = await createPlant(db, basePlant({ name: 'Mladá' }), { now: T0 });
  await add(db, q.id, 'watering', {}, day(2));
  assert.equal((await metrics(db, q.id, day(4))).wateringsPerWeek, null);   // span < 7 days
  const t = await tomato(db);
  await add(db, t.id, 'fertilizing', {}, day(20));
  await add(db, t.id, 'fertilizing', {}, day(40));
  assert.equal((await metrics(db, t.id)).fertilizingsPerCycle, 2);
});

test('problems per 100 days and time to resolve', async () => {
  const db = await freshDb();
  const p = await createPlant(db, basePlant(), { now: T0 });
  assert.equal((await metrics(db, p.id, day(10))).problemsPer100Days, null);        // too short to say
  const { events } = await add(db, p.id, 'problem', { problemType: 'pest', severity: 2 }, day(20));
  await add(db, p.id, 'problem', { problemType: 'mold', severity: 1 }, day(50));
  await add(db, p.id, 'problem_resolved', { problemId: events[0].id }, day(26));
  const m = await metrics(db, p.id, day(100));
  assert.equal(m.problemsPer100Days, 2);
  assert.equal(m.problemResolveDays, 6);
  const clean = await createPlant(db, basePlant({ name: 'Zdravá' }), { now: T0 });
  assert.equal((await metrics(db, clean.id, day(60))).problemsPer100Days, 0);       // a real zero: span is long enough
});

test('growAgain is 100/0 from the latest final evaluation', async () => {
  const db = await freshDb();
  const t = await tomato(db);
  await add(db, t.id, 'evaluation', { scores: { overall: 4 }, wouldGrowAgain: false }, day(120));
  assert.equal((await metrics(db, t.id)).growAgain, 0);
  await add(db, t.id, 'evaluation', { scores: { overall: 5 }, wouldGrowAgain: true }, day(150));
  assert.equal((await metrics(db, t.id)).growAgain, 100);
});

test('stock consumption comes from the recent use rate in g/day and is null for pieces', () => {
  const plant = (unit, amount) => ({ id: 'x', name: 'x', category: 'herb', environment: 'indoor', startDate: T0,
    cache: { batches: [{ stock: { unit, uses: [10, 20, 30].map((d) => ({ at: day(d), amount })), containers: [] } }] } });
  const sum = { cycleDays: null, wouldGrowAgain: null };
  const g = metricsFor(plant('g', 10), [], day(40), sum).stockPerDay;
  const kg = metricsFor(plant('kg', 0.01), [], day(40), sum).stockPerDay;
  assert.ok(g > 0); assert.equal(g, kg);
  assert.equal(metricsFor(plant('ks', 1), [], day(40), sum).stockPerDay, null);
});

test('aggregateMetric: n, nulls excluded, provisional under 3, flag for mixed environments', () => {
  const row = (env, v) => ({ plant: { environment: env }, values: { yieldPerDay: v } });
  const a = aggregateMetric([row('indoor', 10), row('indoor', null), row('indoor', 20)], 'yieldPerDay');
  assert.equal(a.n, 2); assert.equal(a.mean, 15); assert.equal(a.provisional, true); assert.equal(a.mixedEnv, false);
  const b = aggregateMetric([row('indoor', 10), row('indoor', 20), row('indoor', 30)], 'yieldPerDay');
  assert.equal(b.provisional, false); assert.equal(b.min, 10); assert.equal(b.max, 30);
  const c = aggregateMetric([row('indoor', 10), row('outdoor', 20), row('indoor', 30)], 'yieldPerDay');
  assert.equal(c.mixedEnv, true); assert.equal(c.provisional, true);
  assert.equal(aggregateMetric([row('indoor', null)], 'yieldPerDay').n, 0);
});

test('varietyMetrics aggregates the plants of one variety group', async () => {
  const db = await freshDb();
  const a = await tomato(db, {}, 'Rajče A'); const b = await tomato(db, {}, 'Rajče B');
  const plants = [await getPlant(db, a.id), await getPlant(db, b.id)];
  const byPlant = new Map([[a.id, await evs(db, a.id)], [b.id, await evs(db, b.id)]]);
  const [g] = aggregateVarieties(plants, byPlant);
  const vm = varietyMetrics(g, byPlant, day(200));
  const y = vm.aggregates.find((x) => x.key === 'yieldPerDay');
  assert.equal(y.n, 2); assert.equal(y.provisional, true);
  assert.equal(vm.aggregates.some((x) => x.key === 'growAgain'), false);   // n = 0 is omitted, not shown as zero
});

test('stage durations: completed stages only, terminal skipped; variety stats carry n', async () => {
  const db = await freshDb();
  const a = await tomato(db); const b = await tomato(db, {}, 'Rajče B');
  const d = stageDurations(await getPlant(db, a.id), await evs(db, a.id));
  assert.deepEqual(d, { seedling: 60, fruiting: 51 });
  const items = [{ plant: await getPlant(db, a.id) }, { plant: await getPlant(db, b.id) }];
  const byPlant = new Map([[a.id, await evs(db, a.id)], [b.id, await evs(db, b.id)]]);
  const st = stageStats(items, byPlant);
  assert.equal(st.find((s) => s.stage === 'seedling').n, 2);
  assert.equal(st.find((s) => s.stage === 'seedling').mean, 60);
  const c = await createPlant(db, basePlant({ name: 'Bez změn' }), { now: T0 });
  assert.deepEqual(stageDurations(await getPlant(db, c.id), await evs(db, c.id)), {});
});

test('spearman handles ties and refuses degenerate input', () => {
  assert.equal(spearman([1, 2, 3, 4], [10, 20, 30, 40]), 1);
  assert.equal(spearman([1, 2, 3, 4], [4, 3, 2, 1]), -1);
  assert.equal(spearman([1, 1, 1], [1, 2, 3]), null);
  assert.equal(spearman([1], [1]), null);
  assert.ok(Math.abs(spearman([1, 2, 2, 3], [1, 3, 2, 4])) <= 1);
});

async function rated(db, n, yieldOf, overallOf, category = 'vegetable') {
  const plants = []; const byPlant = new Map();
  for (let i = 0; i < n; i++) {
    const p = await createPlant(db, basePlant({ name: `P${i}`, variety: `V${i}`, category, environment: 'outdoor' }), { now: T0 });
    await add(db, p.id, 'harvest', { totalWeight: yieldOf(i) }, day(50 + i));
    await add(db, p.id, 'evaluation', { scores: { overall: overallOf(i) }, wouldGrowAgain: true }, day(80 + i));
    plants.push(await getPlant(db, p.id)); byPlant.set(p.id, await evs(db, p.id));
  }
  return { plants, byPlant };
}

test('patterns: only from n >= 8, only inside one category, only when |r| >= 0.3', async () => {
  const db = await freshDb();
  const s7 = await rated(db, 7, (i) => i + 1, (i) => Math.min(5, 1 + Math.floor(i / 2)));
  assert.deepEqual(patterns(s7.plants, s7.byPlant, day(200)), []);                        // n = 7
  const db2 = await freshDb();
  const s8 = await rated(db2, 8, (i) => i + 1, (i) => 1 + Math.floor(i / 2));
  const p = patterns(s8.plants, s8.byPlant, day(200));
  assert.equal(p.length, 1); assert.equal(p[0].id, 'yieldRating'); assert.equal(p[0].n, 8);
  assert.equal(p[0].direction, 'up'); assert.equal(p[0].category, 'vegetable'); assert.ok(p[0].r > 0.9);
  const db3 = await freshDb();
  const flat = await rated(db3, 8, (i) => i + 1, () => 3);                                // no variation in rating
  assert.deepEqual(patterns(flat.plants, flat.byPlant, day(200)), []);
  // mixing two categories never pools them: 4 + 4 is below the per-category minimum
  const a = await rated(await freshDb(), 4, (i) => i + 1, (i) => i + 1, 'vegetable');
  const b = await rated(await freshDb(), 4, (i) => i + 1, (i) => i + 1, 'fruit');
  assert.deepEqual(patterns([...a.plants, ...b.plants], new Map([...a.byPlant, ...b.byPlant]), day(200)), []);
});

test('storageStats: loss share and real shelf life by method, eaten containers are not spoiled', () => {
  const k = (method, o) => ({ id: Math.random().toString(36), method, initial: 100, amount: 0, status: 'empty', since: day(0), endedAt: day(100), discarded: 0, moldAt: null, checks: [], ...o });
  const plant = { cache: { batches: [{ stock: { containers: [
    k('jar', { status: 'empty' }),                                   // eaten: no spoilage
    k('jar', { status: 'discarded', discarded: 100, endedAt: day(60) }),
    k('bag', { status: 'empty', discarded: 20, moldAt: day(40) }),
    k('bag', { status: 'open', amount: 50 })                         // still open: not counted
  ] } }] } };
  const s = storageStats([plant]);
  const jar = s.find((x) => x.method === 'jar'), bag = s.find((x) => x.method === 'bag');
  assert.equal(jar.n, 2); assert.equal(jar.lossShare, 0.5); assert.equal(jar.shelfLifeDays, 60); assert.equal(jar.spoiledN, 1);
  assert.equal(bag.n, 1); assert.equal(bag.shelfLifeDays, 40); assert.equal(bag.provisional, true);
  assert.deepEqual(storageStats([{ cache: {} }]), []);
});

test('metricsFor takes a precomputed summary and matches the one it would compute', async () => {
  const db = await freshDb();
  const t = await tomato(db);
  const plant = await getPlant(db, t.id), events = await evs(db, t.id);
  assert.deepEqual(metricsFor(plant, events, day(200), plantSummary(plant, events)), metricsFor(plant, events, day(200)));
});
