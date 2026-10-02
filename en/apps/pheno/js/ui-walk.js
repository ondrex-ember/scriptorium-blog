// Obchůzka: one plant per screen, three big moisture buttons, swipe to the next plant (spec 11).
import { getPlantTasks, dryingInfo, isDormant, isTerminal } from './calendar.js';
import { ctx, engineOpts, loadAll, now } from './ctx.js';
import { clear, h, icon, put } from './dom.js';
import { appendEvents, voidEvent } from './events.js';
import { fmtDate, num } from './format.js';
import { MOISTURE_ANSWERS } from './config-categories.js';
import { photoUrl } from './photos.js';
import { guard, navigate } from './router.js';
import { toast } from './sheet.js';
import { S } from './strings.cs.js';
import { latestPhotoId } from './timeline.js';
import { CAT_ICON } from './ui-dashboard.js';
import { daysBetween } from './utils.js';

const cmp = (a, b) => (a || '').localeCompare(b || '', 'cs');

/** Walk order is fixed when the walk starts: by place, then name. Ended, dormant and archived plants are left out. */
export function walkPlants(plants) {
  return plants
    .filter((p) => !p.archivedAt && !isTerminal(p.cache.stage) && !isDormant(p.cache.stage))
    .sort((a, b) => cmp(a.location, b.location) || cmp(a.name, b.name));
}

export async function renderWalk(root) {
  const alive = guard();
  const { plants, byPlant } = await loadAll();
  const list = walkPlants(plants);
  if (!alive()) return undefined;
  if (!list.length) {
    put(clear(root), h('div', { class: 'top-bar' }, h('h1', {}, S.walk.title)), h('div', { class: 'empty-state', id: 'walk-empty' }, S.walk.empty));
    return undefined;
  }
  const opts = engineOpts();
  const nowIso = now();
  const state = { i: 0, written: 0, answers: new Map() };   // plantId -> { answer, eventId }
  const due = new Set(list.filter((p) => getPlantTasks(p, nowIso, opts).some((t) => t.type === 'moisture' && t.dueAt <= nowIso)).map((p) => p.id));

  async function show() {
    if (!alive()) return;
    if (state.i >= list.length) return summary();
    const p = list[state.i];
    const done = state.answers.get(p.id);
    const url = await photoUrl(ctx.db, latestPhotoId(byPlant.get(p.id) || []));
    const info = dryingInfo(p);
    const last = p.cache.lastWateredAt;
    const cb = h('input', { type: 'checkbox', id: 'walk-watered', checked: true });
    let touched = false;
    cb.addEventListener('change', () => { touched = true; });
    const answerBtns = MOISTURE_ANSWERS.map((a) => h('button', {
      type: 'button', class: `moisture-btn walk-btn ${a}${done?.answer === a ? ' selected' : ''}`, dataset: { answer: a }, disabled: !!done,
      onclick: () => write(p, a, touched ? cb.checked : a !== 'wet')
    }, S.moisture[a]));
    cb.addEventListener('change', () => {});
    const card = h('div', { class: 'walk-card', id: 'walk-card' },
      h('div', { class: 'walk-photo' }, url ? h('img', { src: url, alt: p.name }) : icon(CAT_ICON[p.category] || 'pot', 'plant-photo-icon')),
      h('div', { class: 'walk-body' },
        h('div', { class: 'walk-progress' }, S.walk.progress(state.i + 1, list.length),
          due.has(p.id) ? h('span', { class: 'tag walk-due' }, S.walk.dueBadge) : null),
        h('h2', { class: 'walk-name' }, p.name),
        h('div', { class: 'plant-sub' }, [p.variety, p.location].filter(Boolean).join(' · ') || S.category[p.category]),
        h('div', { class: 'muted' }, `${S.walk.lastWatered}: ${last ? `${fmtDate(last)} (${num(daysBetween(last, nowIso))} d)` : S.walk.never} · ${S.walk.expected}: ${num(info.d)} d`),
        done ? h('div', { class: 'banner walk-answered', id: 'walk-answered' }, `${S.walk.answered}: ${S.moisture[done.answer]}`) : null,
        h('div', { class: 'moisture-row walk-row' }, answerBtns),
        done ? null : h('label', { class: 'check-row' }, cb, h('span', {}, S.ui.watered))),
      h('div', { class: 'walk-nav' },
        h('button', { type: 'button', class: 'btn btn-secondary', id: 'walk-prev', disabled: state.i === 0, onclick: () => go(-1) }, S.walk.prev),
        h('button', { type: 'button', class: 'btn btn-secondary', id: 'walk-next', onclick: () => go(1) }, done ? S.walk.next : S.walk.skip)),
      h('p', { class: 'muted walk-hint' }, S.walk.swipe));
    let x0 = null, y0 = null;
    card.addEventListener('touchstart', (e) => { x0 = e.changedTouches[0].clientX; y0 = e.changedTouches[0].clientY; }, { passive: true });
    card.addEventListener('touchend', (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    }, { passive: true });
    put(clear(root), h('div', { class: 'top-bar' }, h('h1', {}, S.walk.title),
      h('button', { type: 'button', class: 'btn btn-ghost', id: 'walk-exit', 'aria-label': S.ui.back, onclick: () => navigate('/') }, icon('close'))), card);
  }

  function go(dir) { state.i = Math.max(0, state.i + dir); show(); }

  async function write(p, answer, watered) {
    try {
      const { events } = await appendEvents(ctx.db, p.id, [{ type: 'moisture_check', payload: { answer, watered } }]);
      state.answers.set(p.id, { answer, eventId: events[0].id });
      state.written += 1;
      toast(`${p.name}: ${S.moisture[answer]}${watered ? ' · zalito' : ''}`, {
        action: S.ui.undo,
        onAction: async () => { await voidEvent(ctx.db, p.id, events[0].id); state.answers.delete(p.id); state.written -= 1; show(); }
      });
      state.i += 1;
      show();
    } catch (e) { toast(e.message || S.err.invalid); }
  }

  function summary() {
    put(clear(root), h('div', { class: 'top-bar' }, h('h1', {}, S.walk.doneTitle)),
      h('div', { class: 'card pad', id: 'walk-summary' }, h('p', {}, S.walk.summary(state.written, list.length - state.answers.size)),
        h('div', { class: 'form-actions' },
          h('button', { type: 'button', class: 'btn btn-secondary', id: 'walk-back', onclick: () => { state.i = list.length - 1; show(); } }, S.walk.prev),
          h('button', { type: 'button', class: 'btn btn-primary', id: 'walk-home', onclick: () => navigate('/') }, S.walk.backHome))));
  }

  await show();
  return undefined;
}
