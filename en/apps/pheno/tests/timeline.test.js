import test from 'node:test';
import assert from 'node:assert/strict';
import { describeEvent, diaryRows, doneToday, latestPhotoId } from '../js/timeline.js';
import { daysWord, num, relDay, toLocalInput, fromLocalInput } from '../js/format.js';

const ev = (id, type, occurredAt, payload = {}) => ({ id, plantId: 'p', type, occurredAt, recordedAt: occurredAt, payload });

test('diaryRows: newest first, voided events and void markers hidden', () => {
  const rows = diaryRows([
    ev('1', 'note', '2026-05-01T08:00:00Z', { text: 'a' }),
    ev('2', 'note', '2026-05-02T08:00:00Z', { text: 'b' }),
    ev('3', 'void', '2026-05-03T08:00:00Z', { targetId: '2' })
  ]);
  assert.deepEqual(rows.map((r) => r.event.id), ['1']);
});

test('doneToday counts only care events on the same local day', () => {
  const now = new Date(2026, 4, 10, 12).toISOString();
  const at = (d, h) => new Date(2026, 4, d, h).toISOString();
  const n = doneToday([ev('1', 'watering', at(10, 8)), ev('2', 'watering', at(9, 8)), ev('3', 'note', at(10, 9))], now);
  assert.equal(n, 1);
});

test('latestPhotoId ignores voided photos', () => {
  const id = latestPhotoId([ev('1', 'photo', '2026-05-01T08:00:00Z', { photoId: 'A' }), ev('2', 'photo', '2026-05-02T08:00:00Z', { photoId: 'B' }), ev('3', 'void', '2026-05-03T08:00:00Z', { targetId: '2' })]);
  assert.equal(id, 'A');
});

test('describeEvent falls back for unknown types', () => {
  assert.equal(describeEvent(ev('1', 'weird', '2026-05-01T08:00:00Z')).title, 'weird');
});

test('format helpers', () => {
  assert.equal(daysWord(1), 'den'); assert.equal(daysWord(3), 'dny'); assert.equal(daysWord(5), 'dní');
  const now = new Date(2026, 4, 10, 12).toISOString();
  assert.equal(relDay(new Date(2026, 4, 11, 1).toISOString(), now), 'zítra');
  assert.equal(relDay(new Date(2026, 4, 7, 23).toISOString(), now), 'před 3 dny');
  assert.equal(num(2.345), (2.3).toLocaleString('cs-CZ'));
  assert.equal(fromLocalInput(toLocalInput(now)), now);
});
