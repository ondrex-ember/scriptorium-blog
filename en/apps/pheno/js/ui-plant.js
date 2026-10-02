// Plant detail: header, stage, drying info, tasks, action bar, diary.
import { dryingInfo, getPlantTasks } from './calendar.js';
import { ctx, engineOpts, now } from './ctx.js';
import { clear, h, icon, put } from './dom.js';
import { appendEvents, voidEvent } from './events.js';
import { fmtDate, fmtDateTime, num, relDay, starsText } from './format.js';
import { CATEGORIES, getStages } from './config-categories.js';
import { evaluationHistory, harvestTotals } from './stats.js';
import { liveEvents } from './model.js';
import { getEvents, getPlant } from './storage.js';
import { photoUrl } from './photos.js';
import { PROFILES } from './profile.js';
import { navigate, guard } from './router.js';
import { toast } from './sheet.js';
import { S } from './strings.cs.js';
import { diaryRows, latestPhotoId } from './timeline.js';
import { CAT_ICON, runTask } from './ui-dashboard.js';
import {
  archiveSheet, evaluationSheet, harvestSheet, environmentSheet, fertilizeSheet, measurementSheet, milestoneSheet, moistureSheet, noteSheet,
  pestCheckSheet, photoSheet, problemSheet, quickWatered, snoozeSheet, submit
} from './ui-forms.js';
import { askHemisphere } from './ui-plant-form.js';

let tab = 'diary';
let tabPlant = null;
const DOT = { overdue: 'expired', today: 'missing', upcoming: 'needs_check' };

export async function renderPlant(root, id) {
  const alive = guard();
  const plant = await getPlant(ctx.db, id);
  if (!plant) return navigate('/');
  const events = await getEvents(ctx.db, id);
  const refresh = () => renderPlant(root, id);
  const nowIso = now();
  const url = await photoUrl(ctx.db, latestPhotoId(events));
  const stages = getStages(plant.category, plant.lifecycle);
  const info = dryingInfo(plant);
  const tasks = getPlantTasks(plant, nowIso, engineOpts()).sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1));
  const locked = !!plant.archivedAt;

  const stageSel = h('select', { id: 'stage-select', disabled: locked,
    onchange: async (e) => {
      const to = e.target.value;
      if (to === plant.cache.stage) return;
      await submit(id, [{ type: 'stage_change', payload: { from: plant.cache.stage, to } }], `Fáze: ${S.stage[to]}`, refresh);
    } }, stages.map((s) => h('option', { value: s, selected: s === plant.cache.stage }, S.stage[s])));

  const act = (key, ic, label, fn) => h('button', { type: 'button', class: 'action-btn', dataset: { act: key }, onclick: fn },
    icon(ic), h('span', {}, label));
  const actionList = [
    act('water', 'drop', S.ui.wateredNow, () => quickWatered(plant, refresh)),
    act('moisture', 'drop', S.ui.moistureCheck, () => moistureSheet(plant, refresh)),
    act('fertilize', 'leaf', S.ui.fertilize, () => fertilizeSheet(plant, refresh)),
    act('pest', 'bug', S.ui.pestCheck, () => pestCheckSheet(plant, refresh)),
    act('problem', 'status-critical', S.ui.problem, () => problemSheet(plant, refresh)),
    act('note', 'note', S.ui.addNote, () => noteSheet(plant, refresh)),
    act('photo', 'camera', S.ui.addPhoto, () => photoSheet(plant, refresh)),
    act('measure', 'thermo', S.ui.measurement, () => measurementSheet(plant, refresh)),
    act('milestone', 'flag', S.ui.milestone, () => milestoneSheet(plant, refresh)),
    plant.harvestable ? act('harvest', 'leaf', S.ui.harvest, () => harvestSheet(plant, refresh)) : null,
    act('env', 'swap', S.ui.changeEnv, async () => { await askHemisphere(); environmentSheet(plant, refresh); })].filter(Boolean);
  if (PROFILES[ctx.profile]?.preselect.measurementsFirst) actionList.sort((a, b) => (b.dataset.act === 'measure') - (a.dataset.act === 'measure'));
  const actions = locked ? null : h('div', { class: 'action-grid' }, actionList);

  const taskRows = tasks.map((t) => h('div', { class: 'item-row task-row', dataset: { task: t.type } },
    h('span', { class: `badge-dot ${DOT[t.urgency]}` }),
    h('div', { class: 'item-info' }, h('div', { class: 'item-name' }, S.taskLabel[t.type]),
      h('div', { class: 'item-detail' }, h('span', { class: 'item-sub' }, relDay(t.dueAt, nowIso)))),
    h('div', { class: 'item-actions qty-stepper' },
      h('button', { type: 'button', class: 'btn-quick', 'aria-label': S.ui.done, onclick: () => runTask(t, plant, refresh) }, icon('check')),
      h('button', { type: 'button', class: 'qty-btn', 'aria-label': S.ui.snooze, onclick: () => snoozeSheet(t, refresh) }, icon('clock')))));

  const live = liveEvents(events);
  const canEval = plant.harvestable || plant.lifecycle === 'perennial';
  const tabs = [['diary', S.ui.timeline],
    plant.harvestable ? ['harvests', S.ui.harvests] : ['milestones', S.ui.milestones],
    canEval ? ['evaluation', S.ui.evaluation] : null, ['care', S.ui.careTab]].filter(Boolean);
  if (tabPlant !== id || !tabs.some(([k]) => k === tab)) { tab = 'diary'; tabPlant = id; }

  const panel = h('div', { id: 'tab-panel' });
  const showTab = async () => { put(panel.replaceChildren() ?? panel, await buildPanel()); };
  async function buildPanel() {
    if (tab === 'harvests') return harvestsPanel();
    if (tab === 'milestones') return milestonesPanel();
    if (tab === 'evaluation') return evaluationPanel();
    if (tab === 'care') return carePanel();
    return diaryPanel();
  }

  async function diaryPanel() {
    const rows = diaryRows(events);
    const items = await Promise.all(rows.map(async (r) => {
      const src = r.photoId ? await photoUrl(ctx.db, r.photoId) : null;
      const canVoid = !locked || ['note', 'photo', 'evaluation'].includes(r.event.type);
      return h('div', { class: 'timeline-row', dataset: { event: r.event.type } },
        h('div', { class: 'timeline-icon' }, icon(r.icon)),
        h('div', { class: 'timeline-body' },
          h('div', { class: 'timeline-title' }, r.title),
          r.detail ? h('div', { class: 'timeline-detail' }, r.detail) : null,
          src ? h('img', { class: 'timeline-photo', src, alt: r.detail || 'Fotka' }) : null,
          h('div', { class: 'timeline-date' }, fmtDateTime(r.event.occurredAt))),
        r.event.type === 'created' || !canVoid ? null
          : h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': S.ui.voidIt, title: S.ui.voidIt,
            onclick: async () => {
              try { await voidEvent(ctx.db, id, r.event.id); toast('Záznam zrušen'); refresh(); } catch (e) { toast(e.message); }
            } }, icon('trash')));
    }));
    return h('div', { class: 'card timeline' }, items);
  }

  function harvestsPanel() {
    const cfg = CATEGORIES[plant.category];
    const hv = live.filter((e) => e.type === 'harvest').reverse();
    const totals = harvestTotals(plant, events);
    const line = (p) => cfg.harvestFields.filter((f) => Number.isFinite(p[f.key]))
      .map((f) => `${S.harvestField[f.key]}: ${num(p[f.key], 2)}`).join(' · ');
    return h('div', {},
      locked ? null : h('button', { type: 'button', class: 'btn btn-primary panel-btn', id: 'btn-harvest', onclick: () => harvestSheet(plant, refresh) }, icon('plus'), S.ui.recordHarvest),
      hv.length ? h('div', { class: 'card timeline' }, hv.map((e) => h('div', { class: 'timeline-row', dataset: { event: 'harvest' } },
        h('div', { class: 'timeline-icon' }, icon('leaf')),
        h('div', { class: 'timeline-body' },
          h('div', { class: 'timeline-title' }, fmtDate(e.occurredAt)),
          h('div', { class: 'timeline-detail' }, line(e.payload)),
          e.payload.processingMethod ? h('div', { class: 'timeline-detail' }, `${S.processing[e.payload.processingMethod]}${e.payload.processingDays != null ? ` · ${e.payload.processingDays} ${S.ui.days}` : ''}`) : null,
          e.payload.note ? h('div', { class: 'timeline-detail' }, e.payload.note) : null)))) : h('div', { class: 'empty-state' }, S.ui.noHarvests),
      hv.length ? h('div', { class: 'card pad', id: 'harvest-total' }, h('strong', {}, `${S.ui.total}: `), line(totals)) : null);
  }

  function milestonesPanel() {
    const ms = live.filter((e) => e.type === 'milestone').reverse();
    return h('div', {}, ms.length ? h('div', { class: 'card timeline' }, ms.map((e) => h('div', { class: 'timeline-row' },
      h('div', { class: 'timeline-icon' }, icon('flag')),
      h('div', { class: 'timeline-body' }, h('div', { class: 'timeline-title' }, e.payload.label),
        h('div', { class: 'timeline-date' }, fmtDate(e.occurredAt)))))) : h('div', { class: 'empty-state' }, S.ui.noMilestones),
    locked ? null : h('button', { type: 'button', class: 'btn btn-secondary panel-btn', onclick: () => milestoneSheet(plant, refresh) }, icon('flag'), S.ui.milestone));
  }

  function evaluationPanel() {
    const hist = evaluationHistory(events);
    const cur = hist[0];
    const criteria = ['overall', ...cfgCriteria()];
    return h('div', {},
      cur ? h('div', { class: 'card pad', id: 'eval-current' },
        h('div', { class: 'eval-head' }, h('strong', {}, S.ui.current), cur.season ? h('span', { class: 'tag' }, `${S.ui.seasonWord} ${cur.season}`) : null),
        criteria.filter((k) => cur.event.payload.scores[k]).map((k) => h('div', { class: 'eval-line' },
          h('span', {}, S.criterion[k]), h('span', { class: 'stars' }, starsText(cur.event.payload.scores[k])))),
        cur.event.payload.wouldGrowAgain != null ? h('div', { class: 'eval-line' }, h('span', {}, S.ui.wouldGrowAgain), h('strong', {}, cur.event.payload.wouldGrowAgain ? S.ui.yes : S.ui.no)) : null,
        cur.note ? h('div', { class: 'muted' }, `„${cur.note}“`) : null)
        : h('div', { class: 'empty-state' }, S.ui.noEval),
      h('button', { type: 'button', class: 'btn btn-primary panel-btn', id: 'btn-evaluate', onclick: () => evaluationSheet(plant, refresh) },
        icon('check'), cur ? S.ui.updateEval : S.ui.evaluate),
      hist.length > 1 ? h('div', { class: 'section-title flush' }, S.ui.history) : null,
      hist.length > 1 ? h('div', { class: 'card timeline', id: 'eval-history' }, hist.map((r) => h('div', { class: 'timeline-row muted-row' },
        h('div', { class: 'timeline-body' },
          h('div', { class: 'timeline-title' }, h('span', { class: 'stars' }, starsText(r.overall)), r.season ? ` · ${r.season}` : ''),
          r.note ? h('div', { class: 'timeline-detail' }, r.note) : null,
          h('div', { class: 'timeline-date' }, `${fmtDate(r.at)}${r.daysAfterHarvest != null ? ` · ${r.daysAfterHarvest} ${S.ui.daysAfter}` : ''}`))))) : null);
  }
  function cfgCriteria() { return CATEGORIES[plant.category].criteria; }

  function carePanel() {
    return h('div', {},
      h('div', { class: 'card drying-info', id: 'drying-info' },
        h('div', {}, `${S.ui.base}: `, h('strong', {}, `${num(info.base)} ${S.ui.days}`)),
        h('div', {}, `${S.ui.learned}: `, h('strong', {}, info.learned == null ? '—' : `${num(info.learned)} ${S.ui.days}`)),
        h('div', {}, `${S.ui.confidence}: `, h('strong', {}, `${Math.round((info.confidence || 0) * 100)} %`)),
        plant.baseOverride ? h('div', {}, `${S.ui.baseOverride}: `, h('strong', {}, num(plant.baseOverride))) : null),
      tasks.length ? h('div', { class: 'card task-list' }, taskRows) : h('div', { class: 'empty-state' }, S.ui.noTasks));
  }

  const tabBar = h('div', { class: 'tab-bar', role: 'tablist' }, tabs.map(([k, label]) => h('button', {
    type: 'button', class: 'tab-btn' + (k === tab ? ' active' : ''), dataset: { tab: k }, role: 'tab',
    onclick: async (e) => {
      tab = k;
      tabBar.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === e.currentTarget));
      await showTab();
    } }, label)));
  await showTab();

  const bottom = locked
    ? h('button', { type: 'button', class: 'btn btn-secondary panel-btn', id: 'btn-unarchive', onclick: async () => {
      try { await appendEvents(ctx.db, id, [{ type: 'unarchive', payload: {} }]); toast('Obnoveno'); refresh(); } catch (e) { toast(e.message); }
    } }, S.ui.unarchive)
    : h('button', { type: 'button', class: 'btn btn-secondary panel-btn', id: 'btn-archive', onclick: () => archiveSheet(plant, () => navigate('/')) }, icon('pot'), S.ui.archive);

  if (!alive()) return undefined;
  put(clear(root),
    h('div', { class: 'top-bar' },
      h('button', { type: 'button', class: 'btn btn-ghost', id: 'btn-back', 'aria-label': S.ui.back, onclick: () => navigate('/') }, icon('back')),
      h('div', { class: 'top-actions' },
        h('button', { type: 'button', class: 'btn btn-ghost', 'aria-label': S.ui.clone, title: S.ui.clone, id: 'btn-clone',
          onclick: () => navigate(`/new?clone=${id}`) }, icon('sprout')),
        h('button', { type: 'button', class: 'btn btn-ghost', 'aria-label': S.ui.edit, id: 'btn-edit',
          onclick: () => navigate(`/plant/${id}/edit`) }, icon('edit')))),
    h('div', { class: 'plant-hero' },
      url ? h('img', { src: url, alt: plant.name }) : icon(CAT_ICON[plant.category] || 'pot', 'plant-photo-icon')),
    h('h2', { class: 'plant-title' }, plant.name),
    h('div', { class: 'plant-tags' },
      plant.variety ? h('span', { class: 'tag' }, plant.variety) : null,
      h('span', { class: 'tag' }, S.category[plant.category]),
      h('span', { class: 'tag' }, S.environment[plant.cache.environment]),
      plant.location ? h('span', { class: 'tag' }, plant.location) : null,
      locked ? h('span', { class: 'tag' }, S.ui.archived) : null),
    h('div', { class: 'field' }, h('label', {}, S.ui.stageLabel), stageSel),
    plant.cache.openProblems.length
      ? h('div', { class: 'problem-banner' }, icon('status-critical'),
        plant.cache.openProblems.map((p) => S.problem[p.problemType]).join(', '))
      : null,
    actions,
    tabBar, panel, bottom);
  return undefined;
}
