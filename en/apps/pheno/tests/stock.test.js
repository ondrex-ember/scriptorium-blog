import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlantTasks } from '../js/calendar.js';
import { resolveRules } from '../js/config-rules.js';
import { liveEvents } from '../js/model.js';
import {
  batchRemaining, buildStockPriors, consumptionRate, containerState, convertAmount, decayRatio, methodComparison, modelAge, ownRatio,
  plantStock, stockTasks, suggestInitial
} from '../js/stock.js';
import { cleanStock, presetFor, resolveMethods, resolvePresets } from '../js/stockcfg.js';
import { day } from './harness.js';
import { ev, lastBatch, mk } from './mem.js';

const CFG = cleanStock(null);
const opts = { rules: resolveRules(), stockCfg: CFG };
let n = 0;
const cid = () => `c${++n}`;

/** Herb plant with one batch that is ready on day 61 and stocked (default: one jar of 100 g). */
function stocked(containers = [{ amount: 100, method: 'jar' }], input = {}, category = 'herb') {
  const st = mk({ category, stage: category === 'herb' ? 'flowering' : 'fruiting', ...input }, opts);
  ev(st, 'harvest', { freshWeight: 400, processingMethod: 'drying', estDays: 7 }, day(60));
  const b = lastBatch(st.p);
  ev(st, 'batch_step', { batchId: b.id, phase: 'ready' }, day(61));
  ev(st, 'stock_init', { batchId: b.id, unit: 'g', containers: containers.map((c) => ({ id: cid(), ...c })), source: 'weighed' }, day(61));
  return { st, id: b.id };
}
const batch = (st) => lastBatch(st.p);
const k0 = (st) => batch(st).stock.containers[0];
const useOf = (st, amount, at, extra = {}) => {
  const b = batch(st);
  return ev(st, 'stock_use', { batchId: b.id, stockId: b.stock.id, containerId: extra.containerId ?? k0(st).id, amount, ...extra }, at);
};

test('stock_init needs a processed batch, happens once, and sums the containers', () => {
  const st = mk({ category: 'herb', stage: 'flowering' }, opts);
  ev(st, 'harvest', { freshWeight: 100, processingMethod: 'drying' }, day(60));
  const b = lastBatch(st.p);
  assert.throws(() => ev(st, 'stock_init', { batchId: 'nope', unit: 'g', containers: [{ id: 'x1', amount: 5, method: 'jar' }] }, day(61)));
  assert.throws(() => ev(st, 'stock_init', { batchId: b.id, unit: 'lb', containers: [{ id: 'x1', amount: 5, method: 'jar' }] }, day(61)));
  assert.throws(() => ev(st, 'stock_init', { batchId: b.id, unit: 'g', containers: [{ id: 'x1', amount: 0, method: 'jar' }] }, day(61)));
  assert.throws(() => ev(st, 'stock_init', { batchId: b.id, unit: 'g', containers: [{ id: 'x1', amount: 5, method: 'zzz' }] }, day(61)));
  assert.throws(() => ev(st, 'stock_init', { batchId: b.id, unit: 'g', containers: [{ id: 'x1', amount: 5, method: 'jar' }, { id: 'x1', amount: 5, method: 'jar' }] }, day(61)));
  const p = ev(st, 'stock_init', { batchId: b.id, unit: 'g', containers: [{ id: 'a1', amount: 30, method: 'jar' }, { id: 'a2', amount: 20.5, method: 'freezer', label: 'Mrazák <b>' }] }, day(63));
  const s = lastBatch(p).stock;
  assert.equal(s.initial, 50.5);
  assert.equal(s.containers.length, 2);
  assert.equal(s.containers[1].label, 'Mrazák b');
  assert.throws(() => ev(st, 'stock_init', { batchId: b.id, unit: 'g', containers: [{ id: 'a3', amount: 5, method: 'jar' }] }, day(64)));
  assert.equal(batchRemaining(lastBatch(p)), 50.5);
});

test('stock_init is rejected for a batch without processing and before the harvest', () => {
  const st = mk({ category: 'herb', stage: 'flowering' }, opts);
  ev(st, 'harvest', { freshWeight: 100 }, day(60));
  ev(st, 'stage_change', { from: 'flowering', to: 'harvested' }, day(60));
  const b = lastBatch(st.p);
  assert.equal(b.phase, 'pending');
  assert.throws(() => ev(st, 'stock_init', { batchId: b.id, unit: 'g', containers: [{ id: 'x1', amount: 5, method: 'jar' }] }, day(61)));
  ev(st, 'batch_step', { batchId: b.id, phase: 'ready' }, day(62));
  assert.throws(() => ev(st, 'stock_init', { batchId: b.id, unit: 'g', containers: [{ id: 'x1', amount: 5, method: 'jar' }] }, day(59)));
});

test('withdrawals reduce the container, over-withdrawal is refused, discard is tracked separately', () => {
  const { st } = stocked([{ amount: 100, method: 'jar' }]);
  useOf(st, 10, day(70));
  assert.equal(k0(st).amount, 90);
  assert.equal(k0(st).opens, 1);
  assert.equal(batch(st).stock.firstUseAt, day(70));
  assert.throws(() => useOf(st, 91, day(71)));
  assert.throws(() => useOf(st, 0, day(71)));
  useOf(st, 5, day(72), { kind: 'discard', reason: 'zvlhlé' });
  assert.equal(k0(st).amount, 85);
  assert.equal(k0(st).discarded, 5);
  assert.equal(k0(st).used, 10);
  assert.equal(batch(st).stock.uses.length, 1);
});

test('emptying every container ends the batch: used when anything was eaten, discarded otherwise', () => {
  const a = stocked([{ amount: 10, method: 'jar' }, { amount: 5, method: 'freezer' }]);
  const b0 = batch(a.st);
  useOf(a.st, 10, day(70), { containerId: b0.stock.containers[0].id });
  assert.equal(batch(a.st).phase, 'ready');
  const p = useOf(a.st, 5, day(71), { containerId: b0.stock.containers[1].id });
  assert.equal(lastBatch(p).phase, 'used');
  assert.equal(lastBatch(p).endedAt, day(71));
  assert.throws(() => useOf(a.st, 1, day(72), { containerId: b0.stock.containers[0].id }));

  const d = stocked([{ amount: 8, method: 'jar' }]);
  const p2 = useOf(d.st, 8, day(70), { kind: 'discard' });
  assert.equal(lastBatch(p2).phase, 'discarded');
  assert.equal(lastBatch(p2).stock.containers[0].status, 'discarded');
});

test('stock_adjust books a lower remainder as consumption and a higher one as a bigger start', () => {
  const { st } = stocked([{ amount: 100, method: 'jar' }]);
  const b = batch(st);
  ev(st, 'stock_adjust', { batchId: b.id, stockId: b.stock.id, containerId: k0(st).id, remaining: 70 }, day(70));
  assert.equal(k0(st).amount, 70);
  assert.equal(batch(st).stock.uses.at(-1).amount, 30);
  assert.equal(batch(st).stock.uses.at(-1).adjust, true);
  ev(st, 'stock_adjust', { batchId: b.id, stockId: b.stock.id, containerId: k0(st).id, remaining: 80 }, day(71));
  assert.equal(k0(st).amount, 80);
  assert.equal(k0(st).initial, 110);
  assert.equal(batch(st).stock.uses.length, 1);
  assert.throws(() => ev(st, 'stock_adjust', { batchId: b.id, stockId: b.stock.id, containerId: k0(st).id, remaining: -1 }, day(72)));
});

test('stock_move: whole container changes method (opens reset), partial move splits a new container', () => {
  const { st } = stocked([{ amount: 100, method: 'jar' }]);
  const b = batch(st);
  useOf(st, 10, day(70));
  assert.equal(k0(st).opens, 1);
  ev(st, 'stock_move', { batchId: b.id, stockId: b.stock.id, containerId: k0(st).id, method: 'freezer' }, day(75));
  assert.equal(k0(st).method, 'freezer');
  assert.equal(k0(st).opens, 0);
  assert.equal(k0(st).segments.length, 2);
  assert.throws(() => ev(st, 'stock_move', { batchId: b.id, stockId: b.stock.id, containerId: k0(st).id, method: 'freezer' }, day(76)));
  ev(st, 'stock_move', { batchId: b.id, stockId: b.stock.id, containerId: k0(st).id, method: 'jar', amount: 30, newContainerId: 'split1', label: 'sklenice B' }, day(80));
  const ks = batch(st).stock.containers;
  assert.equal(ks.length, 2);
  assert.equal(ks[0].amount, 60);
  assert.equal(ks[1].amount, 30);
  assert.equal(ks[1].method, 'jar');
  assert.equal(ks[1].label, 'sklenice B');
  assert.equal(ks[1].parent, ks[0].id);
  assert.equal(ks[1].segments.length, 3);   // history of the parent is inherited: jar → freezer → jar
  assert.equal(batchRemaining(batch(st)), 90);
  assert.throws(() => ev(st, 'stock_move', { batchId: b.id, stockId: b.stock.id, containerId: ks[0].id, method: 'jar', amount: 5, newContainerId: 'split1' }, day(81)));
});

test('stock_check records ratings and mold; a bare "aired" tick is not a check', () => {
  const { st } = stocked([{ amount: 100, method: 'jar' }]);
  const b = batch(st);
  const base = { batchId: b.id, stockId: b.stock.id, containerId: k0(st).id };
  ev(st, 'stock_check', { ...base, aired: true }, day(65));
  assert.equal(k0(st).checks.length, 0);
  assert.equal(k0(st).lastCheckAt, null);
  assert.equal(k0(st).lastAirAt, day(65));
  ev(st, 'stock_check', { ...base, scent: 4, appearance: 5, rh: 58, mold: false }, day(70));
  assert.equal(k0(st).checks.length, 1);
  assert.equal(k0(st).lastCheckAt, day(70));
  assert.equal(k0(st).moldAt, null);
  ev(st, 'stock_check', { ...base, mold: true }, day(80));
  assert.equal(k0(st).moldAt, day(80));
  assert.throws(() => ev(st, 'stock_check', { ...base, scent: 9 }, day(81)));
  assert.throws(() => ev(st, 'stock_check', { ...base, rh: 140 }, day(81)));
});

test('voiding stock_init or the harvest removes its withdrawals; archived plants can still draw down', () => {
  const { st, id } = stocked([{ amount: 50, method: 'jar' }]);
  useOf(st, 5, day(70));
  const init = st.events.find((e) => e.type === 'stock_init');
  const p = ev(st, 'void', { targetId: init.id }, day(71));
  assert.equal(lastBatch(p).stock, null);
  assert.equal(liveEvents(st.events).some((e) => e.type === 'stock_use'), false);

  const b = stocked([{ amount: 50, method: 'jar' }]);
  ev(b.st, 'archive', {}, day(65));
  const p2 = useOf(b.st, 5, day(70));
  assert.equal(p2.archivedAt, day(65));
  assert.equal(lastBatch(p2).stock.containers[0].amount, 45);
  const harvest = b.st.events.find((e) => e.type === 'harvest');
  const p3 = ev(b.st, 'void', { targetId: harvest.id }, day(71));
  assert.equal(p3.cache.batches.length, 0);
  assert.ok(id);
});

test('undoing a withdrawal (void) puts the amount back', () => {
  const { st } = stocked([{ amount: 50, method: 'jar' }]);
  useOf(st, 5, day(70));
  const use = st.events.at(-1);
  ev(st, 'void', { targetId: use.id }, day(70));
  assert.equal(k0(st).amount, 50);
  assert.equal(batch(st).stock.uses.length, 0);
});

// ---------- quality model ----------

const stateAt = (st, at, env = {}) => containerState(st.p, batch(st), k0(st), at, { cfg: CFG, rules: resolveRules(), ...env });

test('maturing: a jar loses nothing during its maturing days, then decays with its half-life', () => {
  const { st } = stocked([{ amount: 100, method: 'jar' }]);      // jar: maturing 14 d, T½ 180 d (processed)
  assert.equal(stateAt(st, day(61 + 10)).q, 1);
  assert.equal(stateAt(st, day(61 + 10)).maturing, true);
  assert.ok(stateAt(st, day(61 + 10)).maturingUntil.startsWith(day(75).slice(0, 10)));
  const half = stateAt(st, day(61 + 14 + 180));
  assert.ok(Math.abs(half.q - 0.5) < 0.01, `q=${half.q}`);
  assert.equal(half.maturing, false);
});

test('freezer keeps far longer than an open container; fresh produce decays on the fresh clock', () => {
  const a = stocked([{ amount: 100, method: 'freezer' }]);
  const b = stocked([{ amount: 100, method: 'open' }]);
  const t = day(61 + 90);
  assert.ok(stateAt(a.st, t).q > 0.9);
  assert.ok(stateAt(b.st, t).q < 0.35);
  const veg = mk({ category: 'vegetable', stage: 'fruiting' }, opts);
  ev(veg, 'harvest', { totalWeight: 2, processingMethod: 'none' }, day(60));
  const vb = lastBatch(veg.p);
  ev(veg, 'stock_init', { batchId: vb.id, unit: 'kg', containers: [{ id: cid(), amount: 2, method: 'fridge' }], source: 'weighed' }, day(60));
  const fresh = containerState(veg.p, lastBatch(veg.p), lastBatch(veg.p).stock.containers[0], day(60 + 14), { cfg: CFG, rules: resolveRules() });
  assert.ok(Math.abs(fresh.q - 0.5) < 0.01, `fresh fridge T½ 14 d, q=${fresh.q}`);
});

test('opening a container costs freshness, capped; a move resets the open count', () => {
  const { st } = stocked([{ amount: 100, method: 'open' }]);   // open: openCost 0.02
  const before = stateAt(st, day(62)).q;
  for (let i = 0; i < 3; i++) useOf(st, 1, day(62));
  assert.ok(Math.abs(stateAt(st, day(62)).q - before * (1 - 0.06)) < 0.005);
  for (let i = 0; i < 30; i++) useOf(st, 1, day(62));
  const lowest = stateAt(st, day(62)).q;
  assert.ok(lowest >= before * 0.7 - 0.005, 'open loss is capped at 30 %');
});

test('use-by date is where quality reaches the preset threshold; it is null once already below', () => {
  const { st } = stocked([{ amount: 100, method: 'jar' }]);
  const s = stateAt(st, day(62));
  assert.ok(s.useByAt);
  const at = stateAt(st, s.useByAt);
  assert.ok(Math.abs(at.q - 0.5) < 0.01, `q at use-by ${at.q}`);
  const late = stateAt(st, day(61 + 14 + 400));
  assert.equal(late.below, true);
  assert.equal(late.useByAt, null);
});

test('moving to the freezer stretches the half-life from that moment', () => {
  const a = stocked([{ amount: 100, method: 'jar' }]);
  const b = stocked([{ amount: 100, method: 'jar' }]);
  const bb = batch(b.st);
  ev(b.st, 'stock_move', { batchId: bb.id, stockId: bb.stock.id, containerId: k0(b.st).id, method: 'freezer' }, day(61 + 30));
  const t = day(61 + 14 + 180);
  assert.ok(stateAt(b.st, t).q > stateAt(a.st, t).q + 0.2);
  const M = resolveMethods(CFG);
  assert.ok(modelAge(k0(b.st), t, M, 'processed', presetFor(b.st.p, CFG)) < 0.7);
});

test('rated checks teach the decay ratio: poor ratings age the container faster, good ones slower', () => {
  const run = (rating) => {
    const { st } = stocked([{ amount: 100, method: 'jar' }]);
    const b = batch(st);
    const base = { batchId: b.id, stockId: b.stock.id, containerId: k0(st).id };
    ev(st, 'stock_check', { ...base, scent: rating, appearance: rating }, day(61 + 14 + 90));   // x ≈ 0.5 half-lives
    ev(st, 'stock_check', { ...base, scent: rating, appearance: rating }, day(61 + 14 + 150));
    return { st, own: ownRatio(k0(st), resolveMethods(CFG), 'processed', presetFor(st.p, CFG)) };
  };
  const poor = run(2), good = run(5);
  assert.ok(poor.own.r < 1, `poor r=${poor.own.r}`);
  assert.ok(good.own.r > 1, `good r=${good.own.r}`);
  const t = day(61 + 14 + 200);
  assert.ok(stateAt(poor.st, t).q < stateAt(good.st, t).q);
  assert.equal(stateAt(good.st, t).ratio.source, 'own');
  const none = stocked([{ amount: 100, method: 'jar' }]);
  assert.equal(stateAt(none.st, t).ratio.source, 'default');
  assert.equal(ownRatio(k0(none.st), resolveMethods(CFG), 'processed', presetFor(none.st.p, CFG)), null);
});

test('mold checks are not used as decay evidence; priors pool the learned ratio across plants', () => {
  const a = stocked([{ amount: 100, method: 'jar' }], { variety: 'Genovese' });
  const b = batch(a.st);
  const base = { batchId: b.id, stockId: b.stock.id, containerId: k0(a.st).id };
  ev(a.st, 'stock_check', { ...base, scent: 1, appearance: 1, mold: true }, day(61 + 14 + 120));
  assert.equal(ownRatio(k0(a.st), resolveMethods(CFG), 'processed', presetFor(a.st.p, CFG)), null);
  ev(a.st, 'stock_check', { ...base, scent: 5, appearance: 5 }, day(61 + 14 + 120));
  const pri = buildStockPriors([a.st.p], CFG);
  assert.ok(pri.method.jar.r > 1);
  assert.equal(pri.variety['jar|herb|genovese'], undefined, 'variety prior needs 2 containers');
  const fresh = stocked([{ amount: 50, method: 'jar' }], { variety: 'Genovese' });
  const dr = decayRatio(fresh.st.p, k0(fresh.st), null, pri);
  assert.equal(dr.source, 'prior');
  assert.equal(dr.r, pri.method.jar.r);
  const shrunk = decayRatio(fresh.st.p, k0(fresh.st), { r: 0.5, n: 1 }, pri);
  assert.equal(shrunk.source, 'own');
  assert.ok(shrunk.r < pri.method.jar.r && shrunk.r > 0.5, `shrunk r=${shrunk.r}`);
});

// ---------- consumption, tasks, suggestion ----------

test('consumption rate needs a minimum span, then averages the recent window; run-out follows', () => {
  const { st } = stocked([{ amount: 100, method: 'jar' }]);
  const rules = resolveRules();
  useOf(st, 2, day(70));
  assert.equal(consumptionRate(st.p, day(72), rules, 'g'), null);
  for (let d = 71; d <= 84; d++) useOf(st, 2, day(d));
  const r = consumptionRate(st.p, day(85), rules, 'g');
  assert.ok(r.perDay > 1.5 && r.perDay < 2.5, `perDay ${r.perDay}`);
  const ps = plantStock(st.p, day(85), { cfg: CFG, rules, priors: {} });
  assert.equal(ps.remaining, 100 - 2 * 15);
  assert.ok(Math.abs(ps.runOutDays - ps.remaining / ps.rate.perDay) < 1e-9);
  assert.ok(ps.runOutAt > day(85));
});

test('tasks: container check is due after the preset interval, mold in a sibling forces an immediate check', () => {
  const { st } = stocked([{ amount: 50, method: 'jar' }, { amount: 50, method: 'jar' }]);
  const b = batch(st);
  const [a, c] = b.stock.containers;
  const o = { rules: resolveRules(), cfg: CFG, priors: {} };
  let t = stockTasks(st.p, day(61 + 5), o).filter((x) => x.type === 'stockCheck');
  assert.equal(t.length, 2);
  assert.ok(t.every((x) => x.due >= day(61 + 13) && x.due <= day(61 + 15)));      // jar: every 14 d
  ev(st, 'stock_check', { batchId: b.id, stockId: b.stock.id, containerId: a.id, mold: true }, day(61 + 5));
  t = stockTasks(st.p, day(61 + 5), o).filter((x) => x.type === 'stockCheck');
  const other = t.find((x) => x.containerId === c.id);
  assert.equal(other.due, day(61 + 5));        // sibling gets a check right away
  assert.ok(t.find((x) => x.containerId === a.id).due > day(61 + 15));   // the checked one waits a full interval
});

test('tasks: airing only for methods that want it and only in the first days; use-by and low-stock appear', () => {
  const { st } = stocked([{ amount: 100, method: 'jar' }, { amount: 100, method: 'freezer' }]);
  const o = { rules: resolveRules(), cfg: CFG, priors: {} };
  const air = stockTasks(st.p, day(65), o).filter((x) => x.type === 'stockAir');
  assert.equal(air.length, 1);           // jar: airs every 2 d for the first 14 d
  assert.equal(air[0].due, day(61 + 2));
  assert.equal(stockTasks(st.p, day(61 + 30), o).filter((x) => x.type === 'stockAir').length, 0);

  const late = stockTasks(st.p, day(61 + 14 + 400), o);
  assert.ok(late.some((x) => x.type === 'stockUseBy' && x.due === day(61 + 14 + 400)));
  assert.ok(late.every((x) => x.snoozeKey));

  const lowSt = stocked([{ amount: 20, method: 'freezer' }]);
  for (let d = 70; d <= 84; d++) useOf(lowSt.st, 1, day(d));
  const lows = stockTasks(lowSt.st.p, day(85), o).filter((x) => x.type === 'stockLow');
  assert.equal(lows.length, 1);          // 5 g left at 1 g/day = 5 days < stock.lowDays
});

test('getPlantTasks carries stock tasks and honours snoozes; batch-level useBy is replaced by the stock', () => {
  const veg = mk({ category: 'vegetable', stage: 'fruiting' }, opts);
  ev(veg, 'harvest', { totalWeight: 2, processingMethod: 'none' }, day(60));
  const b = lastBatch(veg.p);
  assert.ok(getPlantTasks(veg.p, day(75), opts).some((t) => t.type === 'useBy'));
  ev(veg, 'stock_init', { batchId: b.id, unit: 'kg', containers: [{ id: cid(), amount: 2, method: 'fridge' }], source: 'weighed' }, day(60));
  const tasks = getPlantTasks(veg.p, day(75), opts);
  assert.equal(tasks.some((t) => t.type === 'useBy'), false);
  assert.ok(tasks.some((t) => t.type === 'stockCheck'));
});

test('suggestInitial: processed weight, fresh weight, learned ratio, default quarter', () => {
  const herb = mk({ category: 'herb', stage: 'flowering' }, opts);
  ev(herb, 'harvest', { freshWeight: 400, processedWeight: 90, processingMethod: 'drying' }, day(60));
  assert.deepEqual(suggestInitial(herb.p, lastBatch(herb.p)).basis, 'processed');
  assert.equal(suggestInitial(herb.p, lastBatch(herb.p)).amount, 90);

  const h2 = mk({ category: 'herb', stage: 'flowering' }, opts);
  ev(h2, 'harvest', { freshWeight: 400, processingMethod: 'drying' }, day(60));
  const s = suggestInitial(h2.p, lastBatch(h2.p));
  assert.equal(s.basis, 'default');
  assert.equal(s.amount, 100);
  // a second batch learns from the first one's weighed stock
  const b1 = lastBatch(h2.p);
  ev(h2, 'batch_step', { batchId: b1.id, phase: 'ready' }, day(62));
  ev(h2, 'stock_init', { batchId: b1.id, unit: 'g', containers: [{ id: cid(), amount: 120, method: 'jar' }], source: 'weighed' }, day(62));
  ev(h2, 'harvest', { freshWeight: 200, processingMethod: 'drying' }, day(70));
  const l = suggestInitial(h2.p, lastBatch(h2.p));
  assert.equal(l.basis, 'learned');
  assert.equal(l.amount, 60);

  const veg = mk({ category: 'vegetable', stage: 'fruiting' }, opts);
  ev(veg, 'harvest', { totalWeight: 2, processingMethod: 'none' }, day(60));
  const v = suggestInitial(veg.p, lastBatch(veg.p));
  assert.equal(v.unit, 'kg');
  assert.equal(convertAmount(1500, 'g', 'kg'), 1.5);
  assert.equal(convertAmount(3, 'ks', 'g'), null);
});

test('methodComparison groups rated checks by the method in force', () => {
  const a = stocked([{ amount: 50, method: 'jar' }]);
  const b = batch(a.st);
  const base = { batchId: b.id, stockId: b.stock.id, containerId: k0(a.st).id };
  ev(a.st, 'stock_check', { ...base, scent: 4, appearance: 4 }, day(61 + 30));
  ev(a.st, 'stock_check', { ...base, scent: 2, appearance: 3 }, day(61 + 90));
  ev(a.st, 'stock_move', { ...base, method: 'freezer' }, day(61 + 91));
  ev(a.st, 'stock_check', { ...base, scent: 5, appearance: 5 }, day(61 + 120));
  const cmp = methodComparison([a.st.p]);
  const jar = cmp.find((c) => c.method === 'jar');
  const fr = cmp.find((c) => c.method === 'freezer');
  assert.equal(jar.n, 2);
  assert.equal(jar.avg, 3.25);
  assert.equal(jar.lateN, 1);
  assert.equal(fr.avg, 5);
  assert.equal(cmp[0].method, 'freezer');
});

// ---------- catalogue ----------

test('cleanStock keeps valid overrides, drops defaults and garbage', () => {
  const c = cleanStock({
    methods: { jar: { tHalfProcessed: 200, checkDays: 14, moldRisk: 5 }, xAbc: { label: 'Sklep', tHalfProcessed: 90 }, bad: { label: 'x' }, xNoLabel: { tHalfProcessed: 10 } },
    presets: { tea: { useByPct: 40, kFactor: 1.2 }, pMine: { label: 'Moje', method: 'xAbc', maturingDays: 7 }, pBad: { label: 'x', method: 'nope' } },
    categoryPreset: { herb: 'tea', fruit: 'ghost', zzz: 'tea' },
    varietyPreset: { 'herb|genovese': 'pMine', 'herb|x': 'ghost' }
  });
  assert.deepEqual(c.methods.jar, { tHalfProcessed: 200 });
  assert.equal(c.methods.xAbc.label, 'Sklep');
  assert.equal(c.methods.bad, undefined);
  assert.equal(c.methods.xNoLabel, undefined);
  assert.deepEqual(c.presets.tea, { kFactor: 1.2 });
  assert.equal(c.presets.pMine.method, 'xAbc');
  assert.equal(c.presets.pBad, undefined);
  assert.deepEqual(c.categoryPreset, { herb: 'tea' });
  assert.deepEqual(c.varietyPreset, { 'herb|genovese': 'pMine' });
  assert.deepEqual(cleanStock('junk'), { methods: {}, presets: {}, categoryPreset: {}, varietyPreset: {} });
  assert.deepEqual(cleanStock(c), c);
});

test('resolve and presetFor: plant → variety → category → built-in default', () => {
  const cfg = cleanStock({ methods: { jar: { tHalfProcessed: 300 } }, presets: { pMine: { label: 'Moje', method: 'freezer' } },
    categoryPreset: { herb: 'tea' }, varietyPreset: { 'herb|genovese': 'cure' } });
  assert.equal(resolveMethods(cfg).jar.tHalfProcessed, 300);
  assert.equal(resolveMethods(cfg).jar.checkDays, 14);
  assert.equal(resolvePresets(cfg).pMine.custom, true);
  const herb = { category: 'herb', variety: 'Genovese' };
  assert.equal(presetFor({ ...herb, stockPreset: 'pMine' }, cfg).key, 'pMine');
  assert.equal(presetFor(herb, cfg).key, 'cure');
  assert.equal(presetFor({ category: 'herb', variety: 'Thai' }, cfg).key, 'tea');
  assert.equal(presetFor({ category: 'herb', variety: '', stockPreset: 'ghost' }, cfg).key, 'tea');
  assert.equal(presetFor({ category: 'vegetable', variety: '' }, CFG).key, 'fresh');
  assert.equal(presetFor({ category: 'flower', variety: '' }, CFG).key, 'generic');
});

test('a preset changes the maturing time and use-by threshold of its plant', () => {
  const cfg = cleanStock({ presets: { cure: { maturingDays: 28, useByPct: 70 } } });
  const { st } = stocked([{ amount: 100, method: 'jar' }], { stockPreset: 'cure' }, 'herb');
  const s = containerState(st.p, batch(st), k0(st), day(61 + 20), { cfg, rules: resolveRules() });
  assert.equal(s.maturing, true);
  assert.equal(s.threshold, 0.7);
  const plain = stocked([{ amount: 100, method: 'jar' }], {}, 'herb');
  const sp = containerState(plain.st.p, batch(plain.st), k0(plain.st), day(61 + 20), { cfg: CFG, rules: resolveRules() });
  assert.equal(sp.maturing, false, 'generic preset: jar matures 14 d, so after 20 d it is done');
  assert.equal(sp.threshold, 0.5);
});

test('computeTasks respects dashboard.lookaheadDays (0 = only overdue and today)', async () => {
  const { computeTasks } = await import('../js/calendar.js');
  const { st } = stocked([{ amount: 100, method: 'jar' }]);
  const now = day(61 + 20);
  const wide = computeTasks([st.p], now, { rules: resolveRules({ 'dashboard.lookaheadDays': 14 }), stockCfg: CFG });
  const narrow = computeTasks([st.p], now, { rules: resolveRules({ 'dashboard.lookaheadDays': 0 }), stockCfg: CFG });
  assert.ok(narrow.every((t) => t.daysUntil <= 0));
  assert.ok(wide.length >= narrow.length);
  assert.ok(wide.some((t) => t.daysUntil > 0), 'a wide window shows upcoming tasks');
  assert.ok(!narrow.some((t) => t.daysUntil > 0));
});
