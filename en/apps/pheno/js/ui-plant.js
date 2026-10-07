// Plant detail: header, stage, drying info, tasks, action bar, diary.
import { batchRatio, dryingInfo, getPlantTasks, isCaredFor, isDormant } from './calendar.js';
import { ctx, engineOpts, now, refreshPriors } from './ctx.js';
import { activeCriteria, criterionLabel } from './criteria.js';
import { clear, h, icon, put } from './dom.js';
import { appendEvents, voidEvent } from './events.js';
import { fmtDate, fmtDateTime, num, relDay, starsText } from './format.js';
import { BATCH_ENDED, CATEGORIES, getStages } from './config-categories.js';
import { evaluationHistory, harvestTotals } from './stats.js';
import { liveEvents } from './model.js';
import { getEvents, getPlant } from './storage.js';
import { photoUrl } from './photos.js';
import { PROFILES } from './profile.js';
import { navigate, guard } from './router.js';
import { closeSheet, openSheet, toast } from './sheet.js';
import { S } from './strings.cs.js';
import { diaryRows, latestPhotoId } from './timeline.js';
import { CAT_ICON, runTask } from './ui-dashboard.js';
import {
  archiveSheet, batchCheckSheet, batchEstimate, batchMethodSheet, batchStepSheet, careSheet, evaluationSheet, harvestSheet, environmentSheet,
  fertilizeSheet, measurementSheet, milestoneSheet, moistureSheet, noteSheet, pestCheckSheet, photoSheet, problemSheet, quickWatered,
  snoozeSheet, submit
} from './ui-forms.js';
import { askHemisphere } from './ui-plant-form.js';
import { hasStockTab, stockEligible, stockInitSheet, stockPanel, tabRequest } from './ui-stock.js';

let tab = 'diary';
let tabPlant = null;
const DOT = { overdue: 'expired', today: 'missing', upcoming: 'needs_check' };

export async function renderPlant(root, id) {
  const alive = guard();
  const plant = await getPlant(ctx.db, id);
  if (!plant) return navigate('/');
  await refreshPriors();
  const events = await getEvents(ctx.db, id);
  const refresh = () => renderPlant(root, id);
  const nowIso = now();
  const url = await photoUrl(ctx.db, latestPhotoId(events));
  const stages = getStages(plant.category, plant.lifecycle);
  const info = dryingInfo(plant, ctx.rules);
  const tasks = getPlantTasks(plant, nowIso, engineOpts()).sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1));
  const locked = !!plant.archivedAt;
  const pendingBatches = (plant.cache.batches || []).filter((b) => b.phase === 'pending');

  const stageSel = h('select', { id: 'stage-select', disabled: locked,
    onchange: async (e) => {
      const to = e.target.value;
      if (to === plant.cache.stage) return;
      await submit(id, [{ type: 'stage_change', payload: { from: plant.cache.stage, to } }], `Fáze: ${S.stage[to]}`, refresh);
    } }, stages.map((s) => h('option', { value: s, selected: s === plant.cache.stage }, S.stage[s])));

  const act = (key, ic, label, fn) => h('button', { type: 'button', class: 'action-btn', dataset: { act: key }, onclick: fn },
    icon(ic), h('span', {}, label));
  const caring = !locked && isCaredFor(plant.cache.stage);
  const feeding = caring && !isDormant(plant.cache.stage);
  const actionList = [
    caring ? act('water', 'drop', S.ui.wateredNow, () => quickWatered(plant, refresh)) : null,
    caring ? act('moisture', 'drop', S.ui.moistureCheck, () => moistureSheet(plant, refresh)) : null,
    feeding ? act('fertilize', 'leaf', S.ui.fertilize, () => fertilizeSheet(plant, refresh)) : null,
    caring ? act('pest', 'bug', S.ui.pestCheck, () => pestCheckSheet(plant, refresh)) : null,
    caring ? act('problem', 'status-critical', S.ui.problem, () => problemSheet(plant, refresh)) : null,
    act('note', 'note', S.ui.addNote, () => noteSheet(plant, refresh)),
    act('photo', 'camera', S.ui.addPhoto, () => photoSheet(plant, refresh)),
    act('measure', 'thermo', S.ui.measurement, () => measurementSheet(plant, refresh)),
    act('milestone', 'flag', S.ui.milestone, () => milestoneSheet(plant, refresh)),
    act('care', 'leaf', S.ui.care, () => careSheet(plant, refresh)),
    plant.harvestable ? act('harvest', 'leaf', S.ui.harvest, () => harvestSheet(plant, refresh)) : null,
    plant.harvestable ? act('taste', 'check', S.ui.tasting, () => evaluationSheet(plant, refresh, { kind: 'tasting' })) : null,
    act('env', 'swap', S.ui.changeEnv, async () => { await askHemisphere(); environmentSheet(plant, refresh); })].filter(Boolean);
  if (PROFILES[ctx.profile]?.preselect.measurementsFirst) actionList.sort((a, b) => (b.dataset.act === 'measure') - (a.dataset.act === 'measure'));
  const actions = locked ? null : h('div', { class: 'action-grid' }, actionList);

  const taskRows = tasks.map((t) => h('div', { class: 'item-row task-row', dataset: { task: t.type } },
    h('span', { class: `badge-dot ${DOT[t.urgency]}` }),
    h('div', { class: 'item-info' }, h('div', { class: 'item-name' }, S.taskLabel[t.type] + (t.note && t.type !== 'stockLow' ? ` – ${t.note}` : '')),
      h('div', { class: 'item-detail' }, h('span', { class: 'item-sub' }, `${t.phase ? `${S.batchPhase[t.phase] || t.phase} · ` : ''}${relDay(t.dueAt, nowIso)}`))),
    h('div', { class: 'item-actions qty-stepper' },
      h('button', { type: 'button', class: 'btn-quick', 'aria-label': S.ui.done, onclick: () => runTask(t, plant, refresh) }, icon('check')),
      h('button', { type: 'button', class: 'qty-btn', 'aria-label': S.ui.snooze, onclick: () => snoozeSheet(t, refresh) }, icon('clock')))));

  const live = liveEvents(events);
  const canEval = plant.harvestable || plant.lifecycle === 'perennial';
  const tabs = [['diary', S.ui.timeline],
    plant.harvestable ? ['harvests', S.ui.harvests] : ['milestones', S.ui.milestones],
    hasStockTab(plant) ? ['stock', S.stock.tab] : null,
    canEval ? ['evaluation', S.ui.evaluation] : null, ['care', S.ui.careTab]].filter(Boolean);
  if (tabRequest.id === id && tabs.some(([k]) => k === tabRequest.tab)) { tab = tabRequest.tab; tabPlant = id; }
  tabRequest.id = null;
  if (tabPlant !== id || !tabs.some(([k]) => k === tab)) { tab = 'diary'; tabPlant = id; }

  const panel = h('div', { id: 'tab-panel' });
  const showTab = async () => { put(panel.replaceChildren() ?? panel, await buildPanel()); };
  async function buildPanel() {
    if (tab === 'harvests') return harvestsPanel();
    if (tab === 'stock') return stockPanel(plant, refresh, nowIso);
    if (tab === 'milestones') return milestonesPanel();
    if (tab === 'evaluation') return evaluationPanel();
    if (tab === 'care') return carePanel();
    return diaryPanel();
  }

  async function diaryPanel() {
    const rows = diaryRows(events);
    const items = await Promise.all(rows.map(async (r) => {
      const src = r.photoId ? await photoUrl(ctx.db, r.photoId) : null;
      const canVoid = !locked || ['note', 'photo', 'evaluation', 'batch_step', 'batch_check', 'stock_init', 'stock_use', 'stock_adjust', 'stock_move', 'stock_check'].includes(r.event.type);
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
              const doVoid = async () => {
                try { await voidEvent(ctx.db, id, r.event.id); closeSheet(); toast('Záznam zrušen'); refresh(); } catch (e) { toast(e.message); }
              };
              if (r.event.type !== 'harvest') return doVoid();
              openSheet(S.ui.voidConfirm, h('div', { class: 'stack' },
                h('p', { class: 'muted' }, S.ui.voidHarvestAsk),
                h('button', { type: 'button', class: 'btn btn-danger', id: 'btn-void-harvest', onclick: doVoid }, S.ui.voidConfirm),
                h('button', { type: 'button', class: 'btn btn-secondary', onclick: closeSheet }, S.ui.cancel)));
            } }, icon('trash')));
    }));
    return h('div', { class: 'card timeline' }, items);
  }

  const batchOf = (e) => (plant.cache.batches || []).find((b) => b.id === (e.payload.batchId ?? e.id)) ?? null;

  function batchBlock(b) {
    if (!b || b.legacy) return null;
    const open = !BATCH_ENDED.includes(b.phase);
    const t = b.phase === 'drying' ? Math.floor((Date.parse(nowIso) - Date.parse(b.phaseSince)) / 864e5) : null;
    const lastCheck = b.checks.at(-1);
    const bits = [S.batchPhase[b.phase] || b.phase,
      t != null ? S.ui.dayOf(t + 1, Math.round(batchEstimate(b, plant))) : null,
      b.dryDays != null ? S.ui.dryMeasured(num(b.dryDays, 1)) : null,
      lastCheck?.dryness != null ? `${S.ui.dryness}: ${lastCheck.dryness}/5` : null,
      lastCheck?.mold ? S.ui.moldFound : null,
      b.evals.length ? `${S.ui.evaluation}: ${b.evals.length}×` : null].filter(Boolean);
    return h('div', { class: 'batch-block', dataset: { batch: b.id, phase: b.phase } },
      h('div', { class: 'timeline-detail batch-state' }, bits.join(' · ')),
      h('div', { class: 'batch-actions' },
        b.phase === 'pending' ? h('button', { type: 'button', class: 'btn btn-primary btn-sm', dataset: { act: 'method' }, onclick: () => batchMethodSheet(plant, b, refresh) }, S.ui.batchMethod) : null,
        open && b.phase !== 'pending' ? h('button', { type: 'button', class: 'btn btn-secondary btn-sm', dataset: { act: 'check' }, onclick: () => batchCheckSheet(plant, b, refresh) }, S.ui.batchCheck) : null,
        open && b.phase !== 'pending' ? h('button', { type: 'button', class: 'btn btn-secondary btn-sm', dataset: { act: 'move' }, onclick: () => batchStepSheet(plant, b, refresh) }, S.ui.batchMove) : null,
        stockEligible(b) ? h('button', { type: 'button', class: 'btn btn-secondary btn-sm', dataset: { act: 'stock' }, onclick: () => stockInitSheet(plant, b, refresh) }, S.stock.init) : null,
        plant.harvestable && b.phase !== 'discarded' ? h('button', { type: 'button', class: 'btn btn-secondary btn-sm', dataset: { act: 'eval' }, onclick: () => evaluationSheet(plant, refresh, { batchId: b.id }) }, S.ui.evaluate) : null));
  }

  /** Learned (own) or inherited (variety/category) drying ratio, shown once there is something to show. */
  function learnNote() {
    const own = plant.cache.dryLearn;
    if (own?.ratio != null) return h('div', { class: 'muted drying-learn', id: 'drying-learn' }, S.ui.dryLearned(num(own.ratio, 2), own.n));
    const r = batchRatio(plant, { ratio: null }, ctx.priors);
    return r !== 1 ? h('div', { class: 'muted drying-learn', id: 'drying-prior' }, S.ui.dryPrior(num(r, 2))) : null;
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
          h('div', { class: 'timeline-title' }, `${fmtDate(e.occurredAt)}${e.payload.final ? ` · ${S.ui.lastHarvestTag}` : ''}${e.payload.edited ? ` · ${S.ui.editedTag}` : ''}`),
          h('div', { class: 'timeline-detail' }, line(e.payload)),
          e.payload.processingDays != null ? h('div', { class: 'timeline-detail' }, `${S.ui.processingDays}: ${e.payload.processingDays}`) : null,
          e.payload.note ? h('div', { class: 'timeline-detail' }, e.payload.note) : null,
          batchBlock(batchOf(e))),
        locked ? null : h('button', { type: 'button', class: 'btn btn-ghost btn-sm', dataset: { act: 'edit-harvest' }, 'aria-label': S.ui.editHarvest, title: S.ui.editHarvest,
          onclick: () => harvestSheet(plant, refresh, e) }, icon('edit'))))) : h('div', { class: 'empty-state' }, S.ui.noHarvests),
      learnNote(),
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
    const cur = hist.find((r) => r.kind === 'final');
    const taste = hist.filter((r) => r.kind === 'tasting');
    const current = ['overall', ...activeCriteria(plant.category, ctx.criteria).map((c) => c.key)];
    const stored = Object.keys(cur?.event.payload.scores || {});
    const criteria = [...current, ...stored.filter((k) => !current.includes(k))];   // removed criteria stay visible in history
    const rows = (list) => list.map((r) => h('div', { class: 'timeline-row muted-row', dataset: { kind: r.kind } },
      h('div', { class: 'timeline-body' },
        h('div', { class: 'timeline-title' }, h('span', { class: 'stars' }, starsText(r.overall)),
          [r.season ? ` · ${r.season}` : '', r.part ? ` · ${r.part}` : ''].join('')),
        r.note ? h('div', { class: 'timeline-detail' }, r.note) : null,
        h('div', { class: 'timeline-date' }, `${fmtDate(r.at)}${r.daysAfterHarvest != null ? ` · ${r.daysAfterHarvest} ${S.ui.daysAfter}` : ''}`))));
    return h('div', {},
      cur ? h('div', { class: 'card pad', id: 'eval-current' },
        h('div', { class: 'eval-head' }, h('strong', {}, S.ui.current), cur.season ? h('span', { class: 'tag' }, `${S.ui.seasonWord} ${cur.season}`) : null,
          cur.part ? h('span', { class: 'tag' }, cur.part) : null),
        criteria.filter((k) => cur.event.payload.scores[k]).map((k) => h('div', { class: 'eval-line' },
          h('span', {}, criterionLabel(k, ctx.criteria, plant.category) ?? k), h('span', { class: 'stars' }, starsText(cur.event.payload.scores[k])))),
        cur.event.payload.wouldGrowAgain != null ? h('div', { class: 'eval-line' }, h('span', {}, S.ui.wouldGrowAgain), h('strong', {}, cur.event.payload.wouldGrowAgain ? S.ui.yes : S.ui.no)) : null,
        cur.note ? h('div', { class: 'muted' }, `„${cur.note}“`) : null)
        : h('div', { class: 'empty-state' }, S.ui.noEval),
      h('button', { type: 'button', class: 'btn btn-primary panel-btn', id: 'btn-evaluate', onclick: () => evaluationSheet(plant, refresh, { kind: 'final' }) },
        icon('check'), cur ? S.ui.updateEval : S.ui.evaluate),
      plant.harvestable ? h('button', { type: 'button', class: 'btn btn-secondary panel-btn', id: 'btn-taste', onclick: () => evaluationSheet(plant, refresh, { kind: 'tasting' }) },
        icon('check'), S.ui.tasting) : null,
      taste.length ? h('div', { class: 'section-title flush' }, S.ui.kindTasting) : null,
      taste.length ? h('div', { class: 'card timeline', id: 'eval-tastings' }, rows(taste)) : null,
      hist.filter((r) => r.kind === 'final').length > 1 ? h('div', { class: 'section-title flush' }, S.ui.history) : null,
      hist.filter((r) => r.kind === 'final').length > 1 ? h('div', { class: 'card timeline', id: 'eval-history' }, rows(hist.filter((r) => r.kind === 'final'))) : null);
  }

  function carePanel() {
    return h('div', {},
      caring ? h('div', { class: 'card drying-info', id: 'drying-info' },
        h('div', {}, `${S.ui.base}: `, h('strong', {}, `${num(info.base)} ${S.ui.days}`)),
        h('div', {}, `${S.ui.learned}: `, h('strong', {}, info.learned == null ? '—' : `${num(info.learned)} ${S.ui.days}`)),
        h('div', {}, `${S.ui.confidence}: `, h('strong', {}, `${Math.round((info.confidence || 0) * 100)} %`)),
        plant.baseOverride ? h('div', {}, `${S.ui.baseOverride}: `, h('strong', {}, num(plant.baseOverride))) : null)
        : (locked ? null : h('div', { class: 'empty-state', id: 'no-care-tasks' }, S.ui.noCareTasks)),
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
    pendingBatches.length
      ? h('div', { class: 'banner pending-banner', id: 'pending-banner' },
        h('span', { class: 'grow' }, S.ui.batchPending),
        pendingBatches.map((b) => h('button', { type: 'button', class: 'btn btn-primary btn-sm', dataset: { act: 'method' },
          onclick: () => batchMethodSheet(plant, b, refresh) }, `${S.ui.batchMethod} ${fmtDate(b.harvestedAt)}`)))
      : null,
    actions,
    tabBar, panel, bottom);
  return undefined;
}
