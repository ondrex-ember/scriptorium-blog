import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTasks, dryingInfo } from '../js/calendar.js';
import { buildEvents } from '../js/events.js';
import { buildPlant, projectPlant } from '../js/model.js';
import { addDays } from '../js/utils.js';
import { T0, basePlant } from './harness.js';

/** A user whose plant really dries in `trueD` days; answers honestly at every scheduled check. */
function simulate(trueD, { env = 'indoor', category = 'herb', checks = 60 } = {}) {
  const { plant, stage } = buildPlant({ ...basePlant({ category, environment: env, stage: 'vegetative' }) }, T0);
  let events = buildEvents(plant, [], [
    { type: 'created', payload: { environment: env }, occurredAt: T0 },
    { type: 'stage_change', payload: { from: null, to: stage }, occurredAt: T0 }
  ], T0);
  let p = projectPlant(plant, events);
  const history = [];
  for (let i = 0; i < checks; i++) {
    const task = computeTasks([p], addDays(T0, 1000)).concat([]).find((t) => t.type === 'moisture');
    const at = task.dueAt;
    const last = p.cache.lastWateredAt ?? T0;
    const t = (new Date(at) - new Date(last)) / 86400000;
    const r = t / trueD;
    const answer = r < 0.9 ? 'wet' : r > 1.1 ? 'dry' : 'ok';
    events = events.concat(buildEvents(plant, events, [
      { type: 'moisture_check', payload: { answer, watered: answer !== 'wet' }, occurredAt: at }
    ], at));
    p = projectPlant(plant, events);
    history.push({ answer, d: dryingInfo(p).d, conf: dryingInfo(p).confidence });
  }
  return { p, history, base: dryingInfo(p).base };
}

for (const factor of [0.5, 0.7, 1.0, 1.5, 2.2]) {
  test(`convergence: honest user, true drying time = ${factor} × base`, () => {
    const probe = simulate(1, { checks: 1 });
    const trueD = probe.base * factor;
    const { history, base } = simulate(trueD);
    const tail = history.slice(-10).map((h) => h.d);
    const avg = tail.reduce((a, b) => a + b, 0) / tail.length;
    assert.ok(avg > trueD * 0.85 && avg < trueD * 1.15, `avg ${avg.toFixed(2)} vs true ${trueD.toFixed(2)}`);
    assert.ok(history.every((h) => h.d >= Math.max(1, 0.4 * base) - 0.01 && h.d <= 3 * base + 0.01));
    assert.ok(history.at(-1).conf > 0.3, `confidence ${history.at(-1).conf}`);
  });
}

test('convergence within 12 checks for a 1.5 × base plant', () => {
  const probe = simulate(1, { checks: 1 });
  const trueD = probe.base * 1.5;
  const { history } = simulate(trueD, { checks: 12 });
  const last = history.at(-1).d;
  assert.ok(Math.abs(last - trueD) / trueD < 0.2, `${last} vs ${trueD}`);
});
