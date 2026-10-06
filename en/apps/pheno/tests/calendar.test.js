import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDrying, computeTasks, dryingInfo, getPlantTasks, nextMoistureDue, pestInterval, seasonModifier } from '../js/calendar.js';
import { buildEvents } from '../js/events.js';
import { buildPlant, projectPlant } from '../js/model.js';
import { addDays } from '../js/utils.js';
import { T0, basePlant, day } from './harness.js';

/** Pure in-memory plant: no IndexedDB. */
function mk(input = {}, opts = {}) {
  const { plant, stage } = buildPlant({ ...basePlant(), ...input }, T0);
  const st = { plant, events: [], opts };
  add(st, [{ type: 'created', payload: { environment: plant.environment } }, { type: 'stage_change', payload: { from: null, to: stage } }], T0);
  return st;
}
function add(st, items, at) {
  const list = items.map((i) => ({ occurredAt: at, ...i }));
  st.events = st.events.concat(buildEvents(st.plant, st.events, list, at, st.opts));
  st.p = projectPlant(st.plant, st.events, st.opts);
  return st.p;
}
const ev = (st, type, payload, at) => add(st, [{ type, payload }], at);
const near = (a, b, tol = 0.02) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('base = category × environment × stage; override replaces category base', () => {
  const { plant } = buildPlant({ ...basePlant(), environment: 'indoor' }, T0);
  near(baseDrying(plant, 'indoor', 'seedling'), 3 * 1.3 * 1.2);
  near(baseDrying(plant, 'greenhouse', 'flowering'), 3 * 0.8 * 0.9);
  near(baseDrying({ ...plant, baseOverride: 5 }, 'outdoor', 'dormant'), 15);
});

test('ok answers at t = d raise d ~1.5 % per step, never above 3 × base', () => {
  const st = mk({ environment: 'indoor', stage: 'vegetative' });
  const base = baseDrying(st.plant, 'indoor', 'vegetative');
  let p = st.p, prev = base, at = T0;
  const ratios = [];
  for (let i = 0; i < 300; i++) {
    const d = dryingInfo(p).d;
    at = addDays(p.cache.lastWateredAt ?? T0, d);
    p = ev(st, 'moisture_check', { answer: 'ok', watered: true }, at);
    const nd = dryingInfo(p).d;
    if (i < 4) ratios.push(nd / prev);
    prev = nd;
    assert.ok(nd <= 3 * base + 0.01);
  }
  assert.ok(prev >= 3 * base - 0.05, 'reaches the ceiling');
});

test('first four ok steps at t = d: +1.5 % each (outside seasonal months)', () => {
  const st = mk({ environment: 'indoor', stage: 'vegetative' });
  let p = st.p, d = dryingInfo(p).d;
  for (let i = 0; i < 4; i++) {
    const at = addDays(p.cache.lastWateredAt ?? T0, d);
    p = ev(st, 'moisture_check', { answer: 'ok', watered: true }, at);
    const nd = dryingInfo(p).d;
    near(nd / d, 1.015, 0.004);
    d = nd;
  }
  // fifth informative check blends with the weighted mean of the last five implied values
  const at = addDays(p.cache.lastWateredAt, d);
  p = ev(st, 'moisture_check', { answer: 'ok', watered: true }, at);
  // blend with the lagging weighted mean slightly damps the step
  assert.ok(dryingInfo(p).d / d > 1.005 && dryingInfo(p).d / d < 1.025);
});

test('dry moves d half-way to the implied value; late dry check changes nothing', () => {
  const st = mk({ environment: 'indoor' });          // seedling: d = 4.68
  const d0 = dryingInfo(st.p).d;
  near(d0, 3 * 1.3 * 1.2);
  let p = ev(st, 'moisture_check', { answer: 'dry', watered: true }, addDays(T0, 3));
  near(dryingInfo(p).d, 0.5 * d0 + 0.5 * 3 * 0.85, 0.01);
  const d1 = dryingInfo(p).d;
  p = ev(st, 'moisture_check', { answer: 'dry', watered: true }, addDays(addDays(T0, 3), d1 * 1.1 + 2));
  assert.equal(dryingInfo(p).d, d1);
  assert.equal(p.cache.learn.seedling.n, 1);
});

test('wet: early check leaves d unchanged and schedules a recheck; late wet sets d', () => {
  const st = mk({ environment: 'indoor' });
  const d0 = dryingInfo(st.p).d;
  let p = ev(st, 'moisture_check', { answer: 'wet', watered: false }, addDays(T0, 1));
  assert.equal(dryingInfo(p).d, d0);
  assert.equal(p.cache.recheckAt, addDays(addDays(T0, 1), Math.max(1, Math.ceil(d0 * 0.3))));
  assert.equal(nextMoistureDue(p, addDays(T0, 1)), p.cache.recheckAt);
  // watering clears the pending recheck
  p = ev(st, 'watering', {}, addDays(T0, 2));
  assert.equal(p.cache.recheckAt, null);
  const st2 = mk({ environment: 'indoor' });
  p = ev(st2, 'moisture_check', { answer: 'wet', watered: false }, addDays(T0, 6));
  near(dryingInfo(p).d, 6 * 1.3, 0.01);
  assert.equal(p.cache.recheckAt, addDays(addDays(T0, 6), Math.ceil(7.8 * 0.3)));
});

test('season modifier moves the due date, not the learned value; observations are de-seasonalized', () => {
  const st = mk({ environment: 'outdoor', stage: 'vegetative', startDate: '2026-06-01T08:00:00.000Z' });
  const p = ev(st, 'watering', {}, '2026-06-05T08:00:00.000Z');
  const dSummer = nextMoistureDue(p, '2026-07-01T08:00:00.000Z');
  const dWinter = nextMoistureDue(p, '2026-01-10T08:00:00.000Z');
  near((new Date(dSummer) - new Date('2026-06-05T08:00:00.000Z')) / 86400000, 3 * 0.85);
  near((new Date(dWinter) - new Date('2026-06-05T08:00:00.000Z')) / 86400000, 3 * 1.3);
  assert.equal(dryingInfo(p).d, 3);
  // fresh plant, ok check in July at t = 2.55 days (= 3 × 0.85): de-seasonalized t = 3 → implied 3.15
  const st2 = mk({ environment: 'outdoor', stage: 'vegetative', startDate: '2026-07-01T08:00:00.000Z' });
  const r = ev(st2, 'moisture_check', { answer: 'ok', watered: true }, addDays('2026-07-01T08:00:00.000Z', 2.55));
  near(dryingInfo(r).d, 0.7 * 3 + 0.3 * 3 * 1.05, 0.01);
});

test('indoor and controlled ignore season; hemisphere mirrors it', () => {
  assert.equal(seasonModifier('2026-07-10T08:00:00.000Z', 'indoor'), 1);
  assert.equal(seasonModifier('2026-07-10T08:00:00.000Z', 'controlled'), 1);
  assert.equal(seasonModifier('2026-07-10T08:00:00.000Z', 'outdoor'), 0.85);
  assert.equal(seasonModifier('2026-07-10T08:00:00.000Z', 'outdoor', 'south'), 1.3);
  assert.equal(seasonModifier('2026-04-10T08:00:00.000Z', 'greenhouse', 'south'), 1);
});

test('seedling moved indoor → outdoor: season applies only after the move; learned d scales by the ratio', () => {
  const st = mk({ environment: 'indoor', stage: 'vegetative', startDate: '2026-07-01T08:00:00.000Z' });
  const at = (n) => addDays('2026-07-01T08:00:00.000Z', n);
  let p = ev(st, 'moisture_check', { answer: 'ok', watered: true }, at(3.9));   // indoor: no de-seasonalization
  const dIndoor = dryingInfo(p).d;
  near(dIndoor, 0.7 * 3.9 + 0.3 * 3.9 * 1.05, 0.01);
  p = ev(st, 'environment_change', { environment: 'outdoor' }, at(5));
  near(dryingInfo(p).d, dIndoor / 1.3, 0.02);
  assert.ok(seasonModifier(at(6), p.cache.environment) === 0.85);
  // before the move the check was indoor: it was not divided by the season modifier
  assert.equal(p.cache.learn.vegetative.n, 1);
});

test('stage change without a learned value scales d by the factor ratio, confidence halved', () => {
  const st = mk({ environment: 'indoor' });
  let p = ev(st, 'moisture_check', { answer: 'ok', watered: true }, addDays(T0, 4.68));
  const d = dryingInfo(p).d, conf = p.cache.confidence.seedling;
  p = ev(st, 'stage_change', { from: 'seedling', to: 'vegetative' }, addDays(T0, 10));
  near(dryingInfo(p).d, d * 1.0 / 1.2, 0.02);
  near(p.cache.confidence.vegetative, conf / 2, 0.01);
  // an already-learned stage is not overwritten
  p = ev(st, 'stage_change', { from: 'vegetative', to: 'seedling' }, addDays(T0, 11));
  assert.equal(p.cache.soilDryDays.seedling, d);
});

test('learnedBase (clone) seeds d; baseOverride replaces the category base', () => {
  const st = mk({ environment: 'indoor', learnedBase: { seedling: 2.2 } });
  assert.equal(dryingInfo(st.p).d, 2.2);
  const st2 = mk({ environment: 'indoor', baseOverride: 10 });
  near(dryingInfo(st2.p).d, 10 * 1.3 * 1.2);
});

test('problem boost: 14 days or resolution; watering schedule untouched', () => {
  const st = mk({ category: 'herb', environment: 'indoor', stage: 'vegetative' });
  const before = nextMoistureDue(st.p, day(2));
  let p = ev(st, 'problem', { problemType: 'pest', severity: 1 }, day(2));
  assert.equal(nextMoistureDue(p, day(2)), before);
  assert.equal(dryingInfo(p).d, dryingInfo(st.p).d);
  assert.equal(pestInterval(p, day(3)), 4);                       // round(7/2)
  assert.equal(pestInterval(p, day(15)), 4);
  assert.equal(pestInterval(p, day(17)), 7);                      // expired
  const st2 = mk({ environment: 'indoor' });
  p = ev(st2, 'problem', { problemType: 'mold', severity: 2 }, day(2));
  assert.equal(pestInterval(p, day(3)), 2);
  const pid = p.cache.openProblems[0].id;
  p = ev(st2, 'problem_resolved', { problemId: pid }, day(4));
  assert.equal(pestInterval(p, day(5)), 7);
});

test('problem follow-up: 3 days after, repeats, stops on resolution or after 14 days', () => {
  const st = mk({ environment: 'indoor' });
  let p = ev(st, 'problem', { problemType: 'pest', severity: 1 }, day(2));
  const f = (pl, now) => getPlantTasks(pl, now).filter((t) => t.type === 'problemFollowUp');
  assert.equal(f(p, day(3)).length, 1);
  assert.equal(f(p, day(3))[0].dueAt, day(5));
  p = ev(st, 'pest_check', { found: true }, day(5));
  assert.equal(f(p, day(5))[0].dueAt, day(8));
  p = ev(st, 'pest_check', { found: true }, day(15));
  assert.equal(f(p, day(15)).length, 0);                       // next would be day 18 > day 16
  const st2 = mk({ environment: 'indoor' });
  p = ev(st2, 'problem', { problemType: 'pest' }, day(2));
  p = ev(st2, 'problem_resolved', { problemId: p.cache.openProblems[0].id }, day(3));
  assert.equal(f(p, day(6)).length, 0);
});

test('terminal stage returns no tasks; dormant returns no fertilizing task', () => {
  const st = mk({ category: 'herb', environment: 'indoor', stage: 'vegetative' });
  let p = ev(st, 'stage_change', { from: 'vegetative', to: 'done' }, day(10));
  assert.deepEqual(getPlantTasks(p, day(60)), []);
  const tr = mk({ category: 'tree_shrub', environment: 'outdoor' });
  const before = getPlantTasks(tr.p, '2026-09-01T08:00:00.000Z').map((t) => t.type);
  assert.ok(before.includes('fertilizing'));
  p = ev(tr, 'stage_change', { from: 'planted', to: 'dormant' }, day(100));
  const after = getPlantTasks(p, '2026-12-01T08:00:00.000Z').map((t) => t.type);
  assert.ok(!after.includes('fertilizing'));
  assert.ok(after.includes('moisture') && after.includes('pestCheck'));
});

test('archived plants have no tasks', () => {
  const st = mk({ environment: 'indoor' });
  const p = ev(st, 'archive', {}, day(3));
  assert.deepEqual(getPlantTasks(p, day(30)), []);
});

test('snooze hides a task until the date; cleared entries come back', () => {
  const st = mk({ environment: 'indoor' });
  const now = day(30);
  assert.ok(getPlantTasks(st.p, now).some((t) => t.type === 'moisture'));
  const snoozed = { ...st.p, cache: { ...st.p.cache, snoozedUntil: { watering: addDays(now, 2) } } };
  assert.ok(!getPlantTasks(snoozed, now).some((t) => t.type === 'moisture'));
  assert.ok(getPlantTasks(snoozed, addDays(now, 3)).some((t) => t.type === 'moisture'));
});

test('fertilizing and pest check intervals come from category config', () => {
  const st = mk({ category: 'vegetable', environment: 'indoor' });
  const t = getPlantTasks(st.p, day(30));
  assert.equal(t.find((x) => x.type === 'fertilizing').dueAt, addDays(T0, 14));   // first feed after 14 days (rule fertilizing.firstFeedDays)
  assert.equal(t.find((x) => x.type === 'pestCheck').dueAt, addDays(T0, 5));
  const p = ev(st, 'fertilizing', {}, day(12));
  assert.equal(getPlantTasks(p, day(30)).find((x) => x.type === 'fertilizing').dueAt, addDays(day(12), 10));
});

test('computeTasks: urgency buckets, 3-day look-ahead, sorting', () => {
  const a = mk({ name: 'A', environment: 'indoor', stage: 'vegetative' });
  const b = mk({ name: 'B', environment: 'indoor', stage: 'vegetative' });
  ev(a, 'watering', {}, day(10)); ev(b, 'watering', {}, day(9));
  const now = day(14);            // A due 3.9 days after day 10 → today; B due after day 9 → yesterday
  const tasks = computeTasks([a.p, b.p], now).filter((t) => t.type === 'moisture');
  assert.deepEqual(tasks.map((t) => [t.plantName, t.urgency]), [['B', 'overdue'], ['A', 'today']]);
  assert.equal(computeTasks([a.p], day(10)).filter((t) => t.type === 'moisture').length, 0);   // 4 days ahead
  const up = computeTasks([a.p], day(11)).filter((t) => t.type === 'moisture');
  assert.deepEqual(up.map((t) => [t.urgency, t.daysUntil]), [['upcoming', 3]]);
});

test('evaluation reminders: 30/90/365 days after "ready" until evaluated; single review at 90 days', () => {
  const st = mk({ environment: 'indoor' });
  ev(st, 'harvest', { freshWeight: 30 }, day(20));
  const e = (pl, now) => getPlantTasks(pl, now).filter((t) => t.type.startsWith('evaluation'));
  assert.equal(e(st.p, day(21))[0].dueAt, day(50));       // legacy harvest without method counts as ready on the harvest day
  assert.equal(e(st.p, day(120))[0].dueAt, day(110));
  assert.equal(e(st.p, day(500))[0].dueAt, day(385));
  const p = ev(st, 'evaluation', { scores: { overall: 4 } }, day(70));
  assert.equal(e(p, day(100)).length, 0);
  assert.equal(e(p, day(161))[0].type, 'evaluationReview');
  const p2 = ev(st, 'evaluation', { scores: { overall: 5 } }, day(200));
  assert.equal(e(p2, day(400)).length, 0);
  const off = { ...st.p, reminders: false };
  assert.equal(e(off, day(21)).length, 0);
});

test('evaluation reminders: perennial per season, non-harvestable none', () => {
  const st = mk({ category: 'tree_shrub', environment: 'outdoor', startDate: '2026-03-01T08:00:00.000Z' });
  ev(st, 'harvest', { totalWeight: 3 }, '2026-08-01T08:00:00.000Z');
  ev(st, 'harvest', { totalWeight: 4 }, '2027-08-01T08:00:00.000Z');
  const e = (pl, now) => getPlantTasks(pl, now).filter((t) => t.type === 'evaluation');
  assert.equal(e(st.p, '2027-08-20T08:00:00.000Z')[0].season, 2027);
  let p = ev(st, 'evaluation', { scores: { overall: 4 }, season: 2027 }, '2027-09-01T08:00:00.000Z');
  assert.equal(e(p, '2027-09-05T08:00:00.000Z')[0].season, 2026);
  p = ev(st, 'evaluation', { scores: { overall: 3 }, season: 2026 }, '2027-09-02T08:00:00.000Z');
  assert.equal(e(p, '2027-09-05T08:00:00.000Z').length, 0);
  const other = mk({ category: 'other', environment: 'indoor' });
  assert.equal(getPlantTasks(other.p, day(400)).filter((t) => t.type.startsWith('evaluation')).length, 0);
});

test('houseplant (perennial, indoor, not harvestable): no season modifier, no evaluation tasks', () => {
  const st = mk({ category: 'other', lifecycle: 'perennial', environment: 'indoor', harvestable: false });
  const w = getPlantTasks(st.p, '2026-12-20T08:00:00.000Z').find((t) => t.type === 'moisture');
  const s = getPlantTasks(st.p, '2026-07-20T08:00:00.000Z').find((t) => t.type === 'moisture');
  assert.equal(w.dueAt, s.dueAt);
});

test('cache projection with the calendar is rebuildable', () => {
  const st = mk({ environment: 'outdoor' });
  ev(st, 'moisture_check', { answer: 'dry', watered: true }, addDays(T0, 3));
  ev(st, 'moisture_check', { answer: 'wet', watered: false }, addDays(T0, 4));
  ev(st, 'harvest', { freshWeight: 5 }, addDays(T0, 5));
  const again = projectPlant({ ...st.plant, cache: undefined }, st.events, st.opts);
  assert.deepEqual(again.cache, st.p.cache);
});
