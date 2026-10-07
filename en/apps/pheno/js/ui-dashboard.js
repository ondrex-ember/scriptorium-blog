// Dashboard: care progress, tasks, filters, plant cards.
import { computeTasks, getPlantTasks } from './calendar.js';
import { ctx, engineOpts, loadAll, now } from './ctx.js';
import { chipGroup, clear, h, icon } from './dom.js';
import { relDay } from './format.js';
import { photoUrl } from './photos.js';
import { S } from './strings.cs.js';
import { doneToday, latestPhotoId } from './timeline.js';
import { PROFILES } from './profile.js';
import { liveEvents } from './model.js';
import { aggregateVarieties } from './stats.js';
import { seasonOf, dayDiff, daysBetween } from './utils.js';
import { SEASONAL_ENVIRONMENTS } from './config-engine.js';
import { fmtDate, num, plantsWord } from './format.js';
import { batchCheckSheet, batchEstimate, batchMethodSheet, evaluationSheet, followUpSheet, moistureSheet, snoozeSheet, submit, useBySheet } from './ui-forms.js';
import { navigate, guard } from './router.js';
import { runStockTask } from './ui-stock.js';
import { batchRemaining } from './stock.js';
import { backupReminderDue, dismissBackupReminder } from './backup.js';
import { doExport } from './ui-settings.js';
import { BATCH_ENDED, CATEGORIES } from './config-categories.js';

const filters = { location: 'all', environment: 'all', category: 'all' };
let upcomingOpen = false;   // the "Nadcházející" section starts collapsed on every visit to the app
export const CAT_ICON = { herb: 'leaf', vegetable: 'sprout', fruit: 'pot', flower: 'sun', tree_shrub: 'leaf', houseplant: 'sprout', other: 'pot' };
const DOT = { overdue: 'expired', today: 'missing', upcoming: 'needs_check' };

/** Run a task from the list: moisture opens the sheet, quick tasks write directly. */
export function runTask(task, plant, done) {
  const batch = task.batchId ? (plant.cache.batches || []).find((b) => b.id === task.batchId) : null;
  switch (task.type) {
    case 'moisture': return moistureSheet(plant, done);
    case 'fertilizing': return submit(plant.id, [{ type: 'fertilizing', payload: {} }], 'Přihnojeno', done);
    case 'pestCheck': return submit(plant.id, [{ type: 'pest_check', payload: { found: false } }], 'Kontrola zapsána', done);
    case 'problemFollowUp': return followUpSheet(plant, task, done);
    case 'batchCheck': return batch ? batchCheckSheet(plant, batch, done) : null;
    case 'useBy': return useBySheet(plant, task, done);
    case 'evaluation': case 'evaluationReview': return evaluationSheet(plant, done, { kind: 'final', batchId: task.batchId ?? undefined });
    default: return task.type.startsWith('stock') ? runStockTask(task, plant, done) : null;
  }
}

/** Open batches of every plant (archived ones too): what is still being processed, stored or waiting for use. */
export function afterHarvestRows(plants, nowIso) {
  return plants.flatMap((p) => (p.cache?.batches || [])
    .filter((b) => !b.legacy && !BATCH_ENDED.includes(b.phase))
    .map((b) => ({ plant: p, batch: b, pending: b.phase === 'pending',
      progress: b.phase === 'drying' ? { t: Math.floor(daysBetween(b.phaseSince, nowIso)), est: Math.round(batchEstimate(b, p)) } : null })))
    .sort((a, c) => (a.batch.harvestedAt < c.batch.harvestedAt ? 1 : -1));
}

function afterHarvestSection(plants, nowIso, rerender) {
  const rows = afterHarvestRows(plants, nowIso);
  if (!rows.length) return null;
  return h('section', { class: 'after-harvest', id: 'after-harvest' },
    h('div', { class: 'section-title section-title-row' }, h('span', {}, S.ui.afterHarvest),
      rows.some(({ batch }) => batch.stock) ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: 'btn-stock-overview', onclick: () => navigate('/stock') }, S.stock.overview) : null),
    h('div', { class: 'card task-list' }, rows.map(({ plant, batch, pending, progress }) => h('div', {
      class: 'item-row batch-row', role: 'button', tabindex: 0, dataset: { batch: batch.id, plant: plant.id, phase: batch.phase },
      onclick: () => navigate(`/plant/${plant.id}`) },
    h('span', { class: `badge-dot ${pending ? 'missing' : 'ok'}` }),
    h('div', { class: 'item-info' },
      h('div', { class: 'item-name' }, `${plant.name} – ${S.batchPhase[batch.phase] || batch.phase}`),
      h('div', { class: 'item-detail' }, h('span', { class: 'item-sub' },
        [fmtDate(batch.harvestedAt), progress ? S.ui.dayOf(progress.t + 1, progress.est) : null,
          batch.stock ? `${S.stock.left} ${num(batchRemaining(batch), 2)} ${batch.stock.unit}` : null].filter(Boolean).join(' · ')))),
    pending ? h('div', { class: 'item-actions' },
      h('button', { type: 'button', class: 'btn btn-secondary btn-sm', dataset: { act: 'method' },
        onclick: (e) => { e.stopPropagation(); batchMethodSheet(plant, batch, rerender); } }, S.ui.batchMethod)) : null))));
}

function matches(p) {
  return (filters.location === 'all' || p.location === filters.location)
    && (filters.environment === 'all' || p.cache.environment === filters.environment)
    && (filters.category === 'all' || p.category === filters.category);
}

function filterBar(active, rerender) {
  const groups = [
    ['location', 'Místo', [...new Set(active.map((p) => p.location).filter(Boolean))].map((v) => [v, v])],
    ['environment', S.ui.environment, [...new Set(active.map((p) => p.cache.environment))].map((v) => [v, S.environment[v]])],
    ['category', S.ui.category, [...new Set(active.map((p) => p.category))].map((v) => [v, S.category[v]])]
  ].filter(([, , opts]) => opts.length > 1);
  if (!groups.length) return null;
  return h('div', { class: 'filter-bar' }, groups.map(([key, label, opts]) => {
    const g = chipGroup([['all', `${label}: ${S.ui.all}`], ...opts], filters[key], (v) => { filters[key] = v; rerender(); });
    g.el.classList.add('pill-row');
    return g.el;
  }));
}

function taskRow(task, plant, done) {
  const when = task.urgency === 'overdue' ? `Po termínu · ${relDay(task.dueAt, now())}`
    : task.urgency === 'today' ? 'Dnes' : `Nadcházející · ${relDay(task.dueAt, now())}`;
  return h('div', { class: 'item-row task-row', role: 'button', tabindex: 0, dataset: { task: task.type, plant: task.plantId },
    onclick: () => navigate(`/plant/${task.plantId}`) },
    h('span', { class: `badge-dot ${DOT[task.urgency]}` }),
    h('div', { class: 'item-info' },
      h('div', { class: 'item-name' }, `${task.plantName} – ${S.taskLabel[task.type]}${task.note && task.type.startsWith('stock') && task.type !== 'stockLow' ? ` · ${task.note}` : ''}`),
      h('div', { class: 'item-detail' }, h('span', { class: 'item-sub' }, task.phase ? `${S.batchPhase[task.phase] || task.phase} · ${when}` : when))),
    h('div', { class: 'item-actions qty-stepper' },
      h('button', { type: 'button', class: 'btn-quick', 'aria-label': S.ui.done, dataset: { act: 'do' },
        onclick: (e) => { e.stopPropagation(); runTask(task, plant, done); } }, icon('check')),
      h('button', { type: 'button', class: 'qty-btn', 'aria-label': S.ui.snooze, dataset: { act: 'snooze' },
        onclick: (e) => { e.stopPropagation(); snoozeSheet(task, done); } }, icon('clock'))));
}

async function plantCard(plant, events, nextTask) {
  const cfg = CATEGORIES[plant.category];
  const url = await photoUrl(ctx.db, latestPhotoId(events));
  const stage = S.stage[plant.cache.stage] || plant.cache.stage;
  return h('button', { type: 'button', class: 'plant-card', dataset: { plant: plant.id }, onclick: () => navigate(`/plant/${plant.id}`) },
    h('div', { class: 'plant-photo' }, url ? h('img', { src: url, alt: plant.name }) : icon(CAT_ICON[plant.category] || 'pot', 'plant-photo-icon')),
    h('div', { class: 'plant-card-body' },
      h('div', { class: 'plant-name' }, plant.name),
      h('div', { class: 'plant-sub' }, plant.variety || S.category[plant.category]),
      h('div', { class: 'plant-tags' }, h('span', { class: 'tag' }, stage), h('span', { class: 'tag' }, S.environment[plant.cache.environment])),
      nextTask ? h('div', { class: `plant-next ${nextTask.urgency}` }, `${S.taskLabel[nextTask.type]} · ${relDay(nextTask.dueAt, now())}`) : null),
    cfg ? null : null);
}

export async function renderDashboard(root) {
  const alive = guard();
  const { plants, byPlant } = await loadAll();
  const active = plants.filter((p) => !p.archivedAt);
  const rerender = () => renderDashboard(root);
  const list = active.filter(matches);
  const nowIso = now();
  const opts = engineOpts();
  const remind = active.length ? await backupReminderDue(ctx.db, nowIso) : false;

  const byIdAll = new Map(plants.map((p) => [p.id, p]));
  const tasks = computeTasks(plants.filter((p) => (p.archivedAt ? true : matches(p))), nowIso, opts);
  const count = (u) => tasks.filter((t) => t.urgency === u).length;
  const done = list.reduce((n, p) => n + doneToday(byPlant.get(p.id) || [], nowIso), 0);
  const due = tasks.filter((t) => t.urgency !== 'upcoming');
  const later = tasks.filter((t) => t.urgency === 'upcoming');
  const open = due.length;
  const total = done + open;
  const pct = total ? Math.round((done / total) * 100) : (active.length ? 100 : 0);
  const level = !active.length ? 'empty' : pct >= 100 ? 'done' : pct < 34 ? 'starting' : 'building';

  if (!alive()) return undefined;
  clear(root);
  root.append(
    h('div', { class: 'top-bar' }, h('h1', {}, S.nav.overview),
      h('button', { type: 'button', class: 'btn btn-ghost', id: 'btn-new', 'aria-label': S.ui.newPlant, onclick: () => navigate('/new') }, icon('plus'))),
    h('section', { class: 'readiness-panel', dataset: { level } },
      h('div', { class: 'readiness-mark' }, h('div', { class: 'readiness-ring', style: `--readiness:${pct}%` }, h('span', {}, `${pct} %`))),
      h('div', { class: 'readiness-copy' },
        h('span', { class: 'readiness-eyebrow' }, S.ui.careToday),
        h('strong', {}, total ? `${done} z ${total} úkolů` : 'Dnes nic nečeká'),
        h('span', {}, active.length ? 'Splněné kontroly a zálivky se počítají do dne.' : S.ui.noPlants))),
    h('div', { class: 'summary-grid' },
      tile('ok', 'status-ok', done, S.ui.doneToday),
      tile('expired', 'status-critical', count('overdue'), S.ui.overdue),
      tile('missing', 'status-expiring', count('today'), S.ui.today),
      tile('review', 'status-review', count('upcoming'), S.ui.upcoming)));

  if (remind) {
    root.append(h('div', { class: 'banner backup-banner', id: 'backup-banner' },
      h('span', { class: 'grow' }, S.backup.reminder),
      h('button', { type: 'button', class: 'btn btn-secondary btn-sm', id: 'banner-export', onclick: async () => { await doExport(); rerender(); } }, S.backup.reminderBtn),
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: 'banner-dismiss', onclick: async () => { await dismissBackupReminder(ctx.db); rerender(); } }, S.backup.dismiss)));
  }

  const first = due[0];
  if (first) {
    root.append(h('div', { class: 'next-action', role: 'button', tabindex: 0, id: 'next-action',
      onclick: () => runTask(first, byIdAll.get(first.plantId), rerender) },
      h('div', { class: 'next-action-icon' }, icon(first.type === 'moisture' ? 'drop' : first.type === 'fertilizing' ? 'leaf' : first.type.startsWith('evaluation') ? 'status-ok' : first.type === 'batchCheck' || first.type === 'useBy' || first.type.startsWith('stock') ? 'check' : 'bug')),
      h('div', { class: 'next-action-copy' }, h('span', {}, S.ui.nextStep),
        h('strong', {}, `${first.plantName} – ${S.taskLabel[first.type]}`), h('small', {}, relDay(first.dueAt, nowIso))),
      h('button', { type: 'button', 'aria-label': S.ui.done }, icon('chevron'))));
  }

  const bar = filterBar(active, rerender);
  if (bar) root.append(bar);

  root.append(h('div', { class: 'section-title' }, S.ui.needsAttention));
  root.append(due.length
    ? h('div', { class: 'card task-list', id: 'due-list' }, due.map((t) => taskRow(t, byIdAll.get(t.plantId), rerender)))
    : h('div', { class: 'empty-state', id: 'no-due' }, S.ui.noTasks));
  if (later.length) {
    const body = h('div', { class: 'card task-list', id: 'upcoming-list', hidden: !upcomingOpen }, later.map((t) => taskRow(t, byIdAll.get(t.plantId), rerender)));
    const toggle = h('button', { type: 'button', class: 'upcoming-toggle', id: 'btn-upcoming', 'aria-expanded': String(upcomingOpen),
      onclick: () => { upcomingOpen = !upcomingOpen; body.hidden = !upcomingOpen; toggle.setAttribute('aria-expanded', String(upcomingOpen)); toggle.classList.toggle('open', upcomingOpen); } },
    icon('chevron'), h('span', {}, `${S.ui.upcomingSection} (${later.length})`));
    toggle.classList.toggle('open', upcomingOpen);
    root.append(toggle, body);
  }

  const after = afterHarvestSection(plants, nowIso, rerender);
  if (after) root.append(after);

  for (const key of PROFILES[ctx.profile]?.dashboard || []) {
    const sec = key === 'tasks' ? null : profileSection(key, active, plants, byPlant, nowIso);
    if (sec) root.append(sec);
  }

  root.append(h('div', { class: 'section-title' }, `${S.ui.myPlants} (${list.length})`));
  if (!list.length) {
    root.append(h('div', { class: 'empty-state' }, S.ui.noPlants));
  } else {
    const cards = await Promise.all(list.map((p) => {
      // the card only mentions what is due now; future plans live in the collapsed "Nadcházející" section
      const next = getPlantTasks(p, nowIso, opts).filter((t) => dayDiff(nowIso, t.dueAt) <= 0)
        .sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1))[0];
      const withUrg = next ? { ...next, urgency: dayDiff(nowIso, next.dueAt) < 0 ? 'overdue' : 'today' } : null;
      return plantCard(p, byPlant.get(p.id) || [], withUrg);
    }));
    root.append(h('div', { class: 'plant-grid' }, cards));
  }
  root.append(h('button', { type: 'button', class: 'btn btn-primary add-plant', onclick: () => navigate('/new') }, icon('plus'), S.ui.newPlant));
}

function tile(cls, sym, n, label) {
  return h('div', { class: `summary-tile ${cls}` },
    h('div', { class: 'summary-tile-top' }, icon(sym, 'summary-symbol')),
    h('div', { class: 'num' }, n), h('div', { class: 'lbl' }, label));
}

const secRow = (text, sub, path) => h('div', { class: 'item-row profile-row', role: 'button', tabindex: 0, onclick: path ? () => navigate(path) : null },
  h('div', { class: 'item-info' }, h('div', { class: 'item-name' }, text), sub ? h('div', { class: 'item-detail' }, h('span', { class: 'item-sub' }, sub)) : null));

/** Extra dashboard blocks that depend on the profile (spec 6.2). Order follows PROFILES[x].dashboard. */
function profileSection(key, active, all, byPlant, nowIso) {
  if (!all.length) return null;
  const S_ = S.profile;
  let rows = [];
  if (key === 'season') {
    const outdoor = active.filter((p) => SEASONAL_ENVIRONMENTS.includes(p.cache.environment));
    rows = [secRow(S_.seasonLine(S_[seasonOf(nowIso, ctx.hemisphere)], outdoor.length))];
  } else if (key === 'varieties') {
    rows = aggregateVarieties(all, byPlant).slice(0, 3).map((g) =>
      secRow(g.label, [S.category[g.category], g.avgOverall != null ? `${num(g.avgOverall)} ★` : null, `${g.plantCount} ${plantsWord(g.plantCount)}`].filter(Boolean).join(' · '), `/variety/${g.category}/${encodeURIComponent(g.key)}`));
  } else if (key === 'milestones' || key === 'measurements') {
    const type = key === 'milestones' ? 'milestone' : 'measurement';
    rows = active.flatMap((p) => liveEvents(byPlant.get(p.id) || []).filter((e) => e.type === type).map((e) => ({ p, e })))
      .sort((a, b) => (a.e.occurredAt < b.e.occurredAt ? 1 : -1)).slice(0, 5)
      .map(({ p, e }) => secRow(type === 'milestone' ? `${p.name} – ${e.payload.label}` : `${p.name} – ${e.payload.kind}: ${num(e.payload.value, 2)}${e.payload.unit ? ` ${e.payload.unit}` : ''}`,
        fmtDate(e.occurredAt), `/plant/${p.id}`));
  } else if (key === 'cycles') {
    rows = active.filter((p) => p.lifecycle === 'cycle').sort((a, b) => (a.startDate < b.startDate ? -1 : 1)).slice(0, 5)
      .map((p) => secRow(p.name, `${S.stage[p.cache.stage] || p.cache.stage} · ${S_.dayN(dayDiff(p.startDate, nowIso) + 1)}`, `/plant/${p.id}`));
  }
  return h('section', { class: 'profile-section', dataset: { section: key } },
    h('div', { class: 'section-title' }, S_[key]),
    h('div', { class: 'card task-list' }, rows.length ? rows : h('div', { class: 'empty-state' }, S_.none)));
}
