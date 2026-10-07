import test from 'node:test';
import assert from 'node:assert/strict';
import { liveEvents } from '../js/model.js';
import { harvestTotals } from '../js/stats.js';
import { day } from './harness.js';
import { ev, lastBatch, mk } from './mem.js';

const harvests = (st) => liveEvents(st.events).filter((e) => e.type === 'harvest');

test('harvest_edit corrects fields, method and date; the original event stays in the log', () => {
  const st = mk({ stage: 'flowering' });
  ev(st, 'harvest', { freshWeight: 40, processingMethod: 'drying', estDays: 8 }, day(60));
  const h = st.events.at(-1);
  const p = ev(st, 'harvest_edit', { harvestId: h.id, freshWeight: 55, processingMethod: 'none', note: 'opraveno', date: day(59) }, day(61));
  const live = harvests(st);
  assert.equal(live.length, 1);
  assert.equal(live[0].payload.freshWeight, 55);
  assert.equal(live[0].payload.note, 'opraveno');
  assert.equal(live[0].payload.edited, true);
  assert.equal(live[0].payload.batchId, h.id);
  assert.equal(live[0].occurredAt, day(59));
  assert.equal(lastBatch(p).weightG, 55);
  assert.equal(lastBatch(p).phase, 'ready');
  assert.equal(harvestTotals(st.plant, st.events).freshWeight, 55);
  assert.equal(st.events.find((e) => e.id === h.id).payload.freshWeight, 40);   // append-only
});

test('latest edit wins; undoing an edit restores the previous one', () => {
  const st = mk({ stage: 'flowering' });
  ev(st, 'harvest', { freshWeight: 40, processingMethod: 'drying' }, day(60));
  const h = st.events.at(-1);
  ev(st, 'harvest_edit', { harvestId: h.id, freshWeight: 45, processingMethod: 'drying' }, day(61));
  ev(st, 'harvest_edit', { harvestId: h.id, freshWeight: 50, processingMethod: 'drying' }, day(62));
  assert.equal(harvests(st)[0].payload.freshWeight, 50);
  const last = st.events.at(-1);
  ev(st, 'void', { targetId: last.id }, day(63));
  assert.equal(harvests(st)[0].payload.freshWeight, 45);
});

test('edit validation: unknown harvest, empty fields, bad date, date behind processing', () => {
  const st = mk({ stage: 'flowering' });
  ev(st, 'harvest', { freshWeight: 40, processingMethod: 'drying' }, day(60));
  const h = st.events.at(-1);
  assert.throws(() => ev(st, 'harvest_edit', { harvestId: 'nope', freshWeight: 5 }, day(61)));
  assert.throws(() => ev(st, 'harvest_edit', { harvestId: h.id, freshWeight: -1 }, day(61)));
  assert.throws(() => ev(st, 'harvest_edit', { harvestId: h.id, freshWeight: 5, date: 'zítra' }, day(61)));
  ev(st, 'batch_check', { batchId: h.id, dryness: 2 }, day(63));
  assert.throws(() => ev(st, 'harvest_edit', { harvestId: h.id, freshWeight: 5, date: day(64) }, day(65)));
  ev(st, 'harvest_edit', { harvestId: h.id, freshWeight: 5, date: day(62) }, day(65));
  assert.equal(harvests(st)[0].payload.freshWeight, 5);
});

test('voiding a harvest drops its batch steps and checks, keeps ratings', () => {
  const st = mk({ stage: 'flowering' });
  ev(st, 'harvest', { freshWeight: 40, processingMethod: 'drying' }, day(60));
  const h = st.events.at(-1);
  ev(st, 'batch_check', { batchId: h.id, dryness: 2 }, day(62));
  ev(st, 'evaluation', { scores: { overall: 4 }, batchId: h.id, part: 'vršek' }, day(64));
  const p = ev(st, 'void', { targetId: h.id }, day(65));
  const live = liveEvents(st.events);
  assert.ok(!live.some((e) => e.type === 'batch_check' || e.type === 'harvest'));
  const evl = live.find((e) => e.type === 'evaluation');
  assert.ok(evl && evl.payload.batchId === undefined && evl.payload.scores.overall === 4);
  assert.equal(p.cache.batches.length, 0);
});

test('archived plants cannot be edited', () => {
  const st = mk({ stage: 'flowering' });
  ev(st, 'harvest', { freshWeight: 40, processingMethod: 'none', final: true }, day(60));
  const h = st.events.at(-1);
  ev(st, 'archive', {}, day(61));
  assert.throws(() => ev(st, 'harvest_edit', { harvestId: h.id, freshWeight: 41 }, day(62)));
});
