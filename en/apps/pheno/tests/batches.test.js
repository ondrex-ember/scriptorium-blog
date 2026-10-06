import test from 'node:test';
import assert from 'node:assert/strict';
import { batchCheckInterval, batchRatio, buildDryingPriors, dryingInfo, effectiveDryingDays, estimateDryingDays, getPlantTasks, nextFertilizingDue, pendingBatches, potFactor } from '../js/calendar.js';
import { resolveRules } from '../js/config-rules.js';
import { addDays } from '../js/utils.js';
import { currentEvaluations, tastings } from '../js/stats.js';
import { T0, day } from './harness.js';
import { ev, lastBatch, mk } from './mem.js';

const types = (p, now, opts) => getPlantTasks(p, now, opts).map((t) => t.type);

test('harvest creates a batch whose id is the harvest event id; method decides the phase', () => {
  const st = mk({ stage: 'flowering' });
  let p = ev(st, 'harvest', { freshWeight: 40, processingMethod: 'drying' }, day(60));
  const h = st.events.at(-1);
  assert.equal(h.payload.batchId, h.id);
  assert.equal(lastBatch(p).id, h.id);
  assert.equal(lastBatch(p).phase, 'drying');
  assert.equal(lastBatch(p).weightG, 40);
  p = ev(st, 'harvest', { freshWeight: 10, processingMethod: 'none' }, day(61));
  assert.equal(lastBatch(p).phase, 'ready');
  assert.equal(lastBatch(p).readyAt, day(61));
});

test('no moisture, fertilizing or pest tasks after harvest; batch tasks take over', () => {
  const st = mk({ stage: 'flowering' });
  ev(st, 'harvest', { freshWeight: 40, processingMethod: 'drying', final: true }, day(60));
  assert.ok(types(st.p, day(60)).includes('moisture'));          // stage is still flowering
  const p = ev(st, 'stage_change', { from: 'flowering', to: 'harvested' }, day(60));
  const t = types(p, day(61));
  assert.ok(!t.includes('moisture') && !t.includes('fertilizing') && !t.includes('pestCheck'));
  assert.ok(t.includes('batchCheck'));
  assert.equal(p.cache.finalHarvestAt, day(60));
});

test('harvest without method on an active "Sklizeno" plant waits for an answer; elsewhere it is legacy-ready', () => {
  const st = mk({ stage: 'flowering' });
  ev(st, 'harvest', { freshWeight: 20 }, day(50));
  assert.equal(lastBatch(st.p).phase, 'ready');
  assert.equal(lastBatch(st.p).legacy, true);
  let p = ev(st, 'stage_change', { from: 'flowering', to: 'harvested' }, day(50));
  assert.equal(pendingBatches(p).length, 1);
  assert.deepEqual(types(p, day(52)).filter((x) => x !== 'evaluation'), []);   // no tasks until answered
  p = ev(st, 'batch_step', { batchId: lastBatch(p).id, phase: 'drying' }, day(52));
  assert.equal(pendingBatches(p).length, 0);
  assert.equal(lastBatch(p).method, 'drying');
  assert.ok(types(p, day(54)).includes('batchCheck'));
  // archived plants are never asked
  const old = mk({ stage: 'flowering' });
  ev(old, 'harvest', { freshWeight: 20 }, day(50));
  ev(old, 'stage_change', { from: 'flowering', to: 'harvested' }, day(50));
  const arch = ev(old, 'archive', {}, day(70));
  assert.equal(pendingBatches(arch).length, 0);
});

test('batch events are validated against the projected batches', () => {
  const st = mk({ stage: 'flowering' });
  assert.throws(() => ev(st, 'batch_check', { batchId: 'nope', dryness: 2 }, day(2)));
  ev(st, 'harvest', { freshWeight: 40, processingMethod: 'drying' }, day(60));
  const id = lastBatch(st.p).id;
  assert.throws(() => ev(st, 'batch_check', { batchId: id, dryness: 6 }, day(61)));
  assert.throws(() => ev(st, 'batch_check', { batchId: id, dryness: 1.5 }, day(61)));
  assert.throws(() => ev(st, 'batch_check', { batchId: id }, day(61)));
  assert.throws(() => ev(st, 'batch_step', { batchId: id, phase: 'pending' }, day(61)));
  ev(st, 'batch_check', { batchId: id, dryness: 0 }, day(61));          // level 0 is information
  ev(st, 'batch_check', { batchId: id, mold: false, scent: 4 }, day(62));
  const p = ev(st, 'batch_step', { batchId: id, phase: 'used' }, day(80));
  assert.equal(lastBatch(p).endedAt, day(80));
  assert.throws(() => ev(st, 'batch_check', { batchId: id, dryness: 5 }, day(81)));   // used up
  assert.throws(() => ev(st, 'care', { kind: 'custom' }, day(3)));
});

test('archived plants still accept checks and steps for open batches', () => {
  const st = mk({ stage: 'harvested' });
  ev(st, 'harvest', { freshWeight: 40, processingMethod: 'drying' }, day(60));
  ev(st, 'archive', {}, day(61));
  const id = lastBatch(st.p).id;
  ev(st, 'batch_check', { batchId: id, dryness: 3 }, day(63));
  const p = ev(st, 'batch_step', { batchId: id, phase: 'ready' }, day(70));
  assert.equal(lastBatch(p).phase, 'ready');
  assert.ok(types(p, day(110)).includes('evaluation'));          // reminder survives archiving
  assert.throws(() => ev(st, 'watering', {}, day(71)));
});

test('drying checks: interval is 30 % of the remaining estimate, 1–7 days, 1 day when nearly dry or mouldy', () => {
  const rules = resolveRules();
  const st = mk({ stage: 'harvested' });
  ev(st, 'harvest', { freshWeight: 50, processingMethod: 'drying' }, day(60));
  const b = lastBatch(st.p);
  assert.equal(estimateDryingDays(b, rules), 7);                             // indoor env factor 1, W = Wref → 7 days
  const first = batchCheckInterval(b, rules, day(60));
  assert.ok(Math.abs(first.days - 2.1) < 1e-9);                              // 0.3 × 7
  let p = ev(st, 'batch_check', { batchId: b.id, dryness: 4 }, day(63));
  assert.equal(batchCheckInterval(lastBatch(p), rules, day(63)).days, 1);
  p = ev(st, 'batch_check', { batchId: b.id, dryness: 2, mold: true }, day(64));
  assert.equal(batchCheckInterval(lastBatch(p), rules, day(64)).days, 1);
  const big = mk({ stage: 'harvested' });
  ev(big, 'harvest', { freshWeight: 800, processingMethod: 'drying' }, day(60));
  assert.ok(estimateDryingDays(lastBatch(big.p), rules) > 14);
  const manual = mk({ stage: 'harvested' });
  ev(manual, 'harvest', { freshWeight: 800, processingMethod: 'drying', estDays: 10 }, day(60));
  assert.equal(estimateDryingDays(lastBatch(manual.p), rules), 10);           // manual estimate wins
});

test('other methods: curing ramps down, fermenting every 2 days, storing 7 d fresh / 30 d dried, freezing none', () => {
  const rules = resolveRules();
  const mkBatch = (cat, method, stage = 'harvested') => {
    const st = mk({ category: cat, stage });
    ev(st, 'harvest', { [cat === 'herb' ? 'freshWeight' : 'totalWeight']: 2, processingMethod: method }, day(10));
    return lastBatch(st.p);
  };
  const cur = mkBatch('herb', 'curing');
  assert.equal(batchCheckInterval(cur, rules, day(10)).days, 1);
  assert.equal(batchCheckInterval({ ...cur, lastCheckAt: addDays(cur.phaseSince, 10) }, rules, day(20)).days, 3);
  assert.equal(batchCheckInterval({ ...cur, lastCheckAt: addDays(cur.phaseSince, 30) }, rules, day(40)).days, 7);
  assert.equal(batchCheckInterval(mkBatch('vegetable', 'fermenting'), rules, day(10)).days, 2);
  assert.equal(batchCheckInterval(mkBatch('vegetable', 'storing'), rules, day(10)).days, 7);
  assert.equal(batchCheckInterval(mkBatch('herb', 'storing'), rules, day(10)).days, 30);
  assert.equal(batchCheckInterval(mkBatch('fruit', 'pickling'), rules, day(10)).days, 30);
  assert.equal(batchCheckInterval(mkBatch('fruit', 'freezing'), rules, day(10)), null);
});

test('fresh produce gets a use-by task; evaluation reminders are anchored on "ready"', () => {
  const st = mk({ category: 'fruit', stage: 'harvested' });
  ev(st, 'harvest', { totalWeight: 2, processingMethod: 'storing' }, day(100));
  const b = lastBatch(st.p);
  const useBy = getPlantTasks(st.p, day(101)).find((t) => t.type === 'useBy');
  assert.equal(useBy.dueAt, day(114));                                     // fruit: 14 days
  assert.ok(!types(st.p, day(150)).includes('evaluation'));                // storing is not "ready"
  const p = ev(st, 'batch_step', { batchId: b.id, phase: 'ready' }, day(120));
  const e = getPlantTasks(p, day(121)).find((t) => t.type === 'evaluation');
  assert.equal(e.dueAt, day(120));                                         // fresh: reminders at 0 and 14 days
  const d = getPlantTasks(p, day(140)).find((t) => t.type === 'evaluation');
  assert.equal(d.dueAt, day(134));
  const used = ev(st, 'batch_step', { batchId: b.id, phase: 'used' }, day(125));
  assert.ok(!getPlantTasks(used, day(126)).some((t) => t.type === 'useBy'));
});

test('dried herb: reminders 30 / 90 / 365 days after "ready", a year later still works', () => {
  const st = mk({ stage: 'harvested' });
  ev(st, 'harvest', { freshWeight: 50, processingMethod: 'drying' }, day(60));
  assert.ok(!types(st.p, day(90)).includes('evaluation'));
  const p = ev(st, 'batch_step', { batchId: lastBatch(st.p).id, phase: 'ready' }, day(70));
  const at = (n) => getPlantTasks(p, day(n)).find((t) => t.type === 'evaluation').dueAt;
  assert.equal(at(80), day(100));
  assert.equal(at(200), day(160));
  assert.equal(at(800), day(435));
});

test('evaluation kinds: tasting before harvest, part of a harvest, tastings never enter the scores', () => {
  const st = mk({ category: 'vegetable', stage: 'fruiting' });
  let p = ev(st, 'evaluation', { scores: { overall: 5, taste: 5 } }, day(50));
  assert.equal(st.events.at(-1).payload.kind, 'tasting');
  assert.equal(currentEvaluations(st.plant, st.events).length, 0);
  assert.equal(tastings(st.events).length, 1);
  assert.ok(!types(p, day(200)).includes('evaluation'));                   // tastings never trigger reminders
  p = ev(st, 'harvest', { totalWeight: 3, processingMethod: 'none', final: true }, day(80));
  const id = lastBatch(p).id;
  p = ev(st, 'evaluation', { scores: { overall: 4 }, batchId: id, part: 'velká rajčata' }, day(85));
  p = ev(st, 'evaluation', { scores: { overall: 2 }, batchId: id, part: 'prasklé' }, day(85));
  assert.equal(st.events.at(-1).payload.kind, 'final');
  assert.equal(currentEvaluations(st.plant, st.events).length, 2);          // one per part
  assert.equal(lastBatch(p).evals.length, 2);
  assert.throws(() => ev(st, 'evaluation', { scores: { overall: 4 }, batchId: 'nope' }, day(86)));
  assert.throws(() => ev(st, 'evaluation', { scores: { overall: 4 }, kind: 'weird' }, day(86)));
});

test('herbs can be tasted in life as well', () => {
  const st = mk({ stage: 'vegetative' });
  ev(st, 'evaluation', { scores: { overall: 4, aroma: 5 } }, day(30));
  assert.equal(st.events.at(-1).payload.kind, 'tasting');
});

test('fertilizing profile: first feed after N days, fruiting factor, none after harvest or in dormancy, optional stop before harvest', () => {
  const rules = resolveRules();
  const st = mk({ category: 'vegetable', stage: 'seedling' });
  assert.equal(nextFertilizingDue(st.p, rules), day(14));
  let p = ev(st, 'fertilizing', {}, day(20));
  assert.equal(nextFertilizingDue(p, rules), day(30));                      // 10 days
  p = ev(st, 'stage_change', { from: 'seedling', to: 'fruiting' }, day(40));
  assert.equal(nextFertilizingDue(p, rules), addDays(day(20), 8));          // 10 × 0.8
  const stopRules = resolveRules({ 'fertilizing.stopBeforeHarvestDays': 14 });
  const planned = { ...p, plannedHarvestAt: day(35) };
  assert.equal(nextFertilizingDue(planned, stopRules), null);
  assert.notEqual(nextFertilizingDue(planned, rules), null);
  p = ev(st, 'stage_change', { from: 'fruiting', to: 'harvested' }, day(60));
  assert.equal(nextFertilizingDue(p, rules), null);
  const tree = mk({ category: 'tree_shrub', stage: 'planted' });
  assert.equal(nextFertilizingDue(ev(tree, 'stage_change', { from: 'planted', to: 'dormant' }, day(5)), rules), null);
});

test('user rules change the intervals the engine uses', () => {
  const opts = { rules: resolveRules({ 'cat.herb.pestCheckDays': 3, 'batch.storing.driedDays': 10 }) };
  const st = mk({ stage: 'vegetative' }, opts);
  assert.equal(getPlantTasks(st.p, day(30), opts).find((t) => t.type === 'pestCheck').dueAt, day(3));
  const h = mk({ stage: 'harvested' }, opts);
  ev(h, 'harvest', { freshWeight: 5, processingMethod: 'storing' }, day(10));
  assert.equal(getPlantTasks(h.p, day(11), opts).find((t) => t.type === 'batchCheck').dueAt, day(20));
});

test('pot size and substrate scale the soil base; repotting rescales what was learned', () => {
  const rules = resolveRules();
  assert.equal(potFactor(null, rules), 1);
  assert.equal(potFactor({ volumeL: 5, substrate: 'soil' }, rules), 1);
  assert.ok(Math.abs(potFactor({ volumeL: 20, substrate: 'soil' }, rules) - 2) < 1e-9);          // (4)^0.5
  assert.equal(potFactor({ volumeL: 5, substrate: 'hydro' }, rules), 0.5);
  assert.equal(potFactor({ volumeL: 500, substrate: 'soil' }, rules), 3);                         // clamped
  const st = mk({ stage: 'vegetative', potVolumeL: 5, substrate: 'soil' });
  assert.equal(st.p.cache.pot.volumeL, 5);
  const d0 = dryingInfo(st.p, rules).d;
  let p = ev(st, 'moisture_check', { answer: 'ok', watered: true }, day(4));
  const learned = dryingInfo(p, rules).d;
  p = ev(st, 'care', { kind: 'repotting', potVolumeL: 20 }, day(5));
  assert.ok(Math.abs(dryingInfo(p, rules).d / learned - 2) < 0.02);        // 4× volume → ×2
  assert.ok(Math.abs(dryingInfo(mk({ stage: 'vegetative', potVolumeL: 20 }).p, rules).d / d0 - 2) < 1e-9);
  assert.ok(p.cache.confidence.vegetative <= st.p.cache.confidence.vegetative);
});

test('care events are recorded and validated; repotting needs a positive volume', () => {
  const st = mk({ stage: 'vegetative' });
  ev(st, 'care', { kind: 'pruning', note: 'vršky' }, day(5));
  ev(st, 'care', { kind: 'custom', label: 'Čištění lampy' }, day(6));
  assert.throws(() => ev(st, 'care', { kind: 'repotting', potVolumeL: -1 }, day(7)));
  assert.throws(() => ev(st, 'care', { kind: 'bogus' }, day(7)));
  const p = ev(st, 'care', { kind: 'repotting', potVolumeL: 10 }, day(8));
  assert.equal(p.cache.pot.volumeL, 10);
});

test('cache with batches is rebuildable from events alone', async () => {
  const { projectPlant } = await import('../js/model.js');
  const st = mk({ stage: 'flowering' });
  ev(st, 'harvest', { freshWeight: 40, processingMethod: 'drying' }, day(60));
  ev(st, 'batch_check', { batchId: lastBatch(st.p).id, dryness: 3 }, day(63));
  ev(st, 'evaluation', { scores: { overall: 3 } }, day(64));
  const again = projectPlant({ ...st.plant, cache: undefined }, st.events, st.opts);
  assert.deepEqual(again.cache, st.p.cache);
});

// ---------- drying-time learning (RCv0.191, R4) ----------

test('measured drying time (dryness 5, or leaving the phase) is learned as a ratio for the next batch', () => {
  const rules = resolveRules();
  const st = mk({ stage: 'harvested' });
  ev(st, 'harvest', { freshWeight: 50, processingMethod: 'drying' }, day(60));
  const first = lastBatch(st.p);
  ev(st, 'batch_check', { batchId: first.id, dryness: 5 }, day(69));
  let p = ev(st, 'batch_step', { batchId: first.id, phase: 'curing' }, day(71));   // later move does not overwrite the measurement
  assert.equal(lastBatch(p).dryDays, 9);
  assert.equal(p.cache.dryLearn.n, 1);
  assert.equal(p.cache.dryLearn.ratio, 1.14);                                       // 0.5·1 + 0.5·(9/7)
  p = ev(st, 'harvest', { freshWeight: 50, processingMethod: 'drying' }, day(80));
  const second = lastBatch(p);
  assert.equal(second.ratio, 1.14);
  assert.equal(Math.round(estimateDryingDays(second, rules, second.ratio) * 100) / 100, 7.98);
  assert.equal(p.cache.batches[0].ratio, null);                                      // the first batch had nothing learned before it
  // leaving the drying phase counts as the measurement when no dryness-5 check exists
  p = ev(st, 'batch_step', { batchId: second.id, phase: 'ready' }, day(86));
  assert.equal(p.cache.batches[1].dryDays, 6);
  assert.equal(p.cache.dryLearn.n, 2);
  assert.ok(p.cache.dryLearn.ratio < 1.14);                                          // 6 days < model → ratio drops
});

test('discarded batches and non-drying batches teach nothing; partial dryness only nudges the current estimate', () => {
  const rules = resolveRules();
  const st = mk({ stage: 'harvested' });
  ev(st, 'harvest', { freshWeight: 50, processingMethod: 'drying' }, day(10));
  const b = lastBatch(st.p);
  let p = ev(st, 'batch_check', { batchId: b.id, dryness: 3 }, day(13));
  assert.equal(lastBatch(p).dryLearn.actual, false);
  assert.equal(lastBatch(p).dryLearn.days, 5);                                       // 3 days at level 3/5 → ~5 days in total
  assert.equal(p.cache.dryLearn.n, 0);                                               // partial levels never change the ratio
  assert.ok(Math.abs(effectiveDryingDays(lastBatch(p), rules, 1) - (7 * 0.7 + 5 * 0.3)) < 1e-9);
  p = ev(st, 'batch_step', { batchId: b.id, phase: 'discarded' }, day(14));
  assert.equal(p.cache.dryLearn.n, 0); assert.equal(lastBatch(p).dryDays, null);
  const cur = mk({ stage: 'harvested' });
  ev(cur, 'harvest', { freshWeight: 50, processingMethod: 'curing' }, day(10));
  assert.equal(lastBatch(ev(cur, 'batch_step', { batchId: lastBatch(cur.p).id, phase: 'ready' }, day(30))).dryDays, null);
});

test('cross-plant priors: category mean, variety mean from two batches; own learning wins', () => {
  const mkDried = (variety, days) => {
    const st = mk({ stage: 'harvested', variety });
    ev(st, 'harvest', { freshWeight: 50, processingMethod: 'drying' }, day(10));
    return ev(st, 'batch_check', { batchId: lastBatch(st.p).id, dryness: 5 }, day(10 + days));
  };
  const a = mkDried('Genovese', 14), b = mkDried('Genovese', 14), c = mkDried('Thai', 7);
  const priors = buildDryingPriors([a, b, c]);
  assert.equal(priors.category.herb.n, 3);
  assert.ok(Math.abs(priors.category.herb.ratio - (2 + 2 + 1) / 3) < 0.01);
  assert.equal(priors.variety['herb|genovese'].ratio, 2);
  assert.equal(priors.variety['herb|thai'], undefined);                              // one batch is not enough for a variety
  const fresh = mk({ stage: 'harvested', variety: 'Genovese' });
  const nb = lastBatch(ev(fresh, 'harvest', { freshWeight: 50, processingMethod: 'drying' }, day(10)));
  assert.equal(batchRatio(fresh.p, nb, priors), 2);                                  // variety prior
  assert.equal(batchRatio({ category: 'herb', variety: 'Mint' }, nb, priors), 1.67); // category prior
  assert.equal(batchRatio(fresh.p, { ratio: 0.8 }, priors), 0.8);                    // own learning wins
  assert.equal(batchRatio(fresh.p, nb, { category: {}, variety: {} }), 1);
});
