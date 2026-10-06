// Event forms as bottom sheets. Every form has a date field (backdating allowed).
import { BATCH_PHASES, CARE_KINDS, CATEGORIES, DRYNESS_MAX, FRESH_CATEGORIES, MOISTURE_ANSWERS, PROBLEM_TYPES, PROCESSING_METHODS, PROCESSING_PHASES, RATING_MAX, STAGE_FLAGS, getStages } from './config-categories.js';
import { batchRatio, dryingInfo, effectiveDryingDays } from './calendar.js';
import { ctx, now } from './ctx.js';
import { activeCriteria } from './criteria.js';
import { chipGroup, field, h } from './dom.js';
import { appendEvents, snoozeTask, voidEvent } from './events.js';
import { fmtDate, fromLocalInput, num, relDay, toLocalInput } from './format.js';
import { getEvents } from './storage.js';
import { latestEvaluation } from './stats.js';
import { savePhotoFile } from './photos.js';
import { closeSheet, openSheet, toast } from './sheet.js';
import { S } from './strings.cs.js';
import { daysBetween } from './utils.js';

/** Write events; on success close the sheet, show an undo toast and refresh the view. */
export async function submit(plantId, inputs, message, done) {
  try {
    const { events } = await appendEvents(ctx.db, plantId, inputs);
    closeSheet();
    toast(message, {
      action: S.ui.undo,
      onAction: async () => {
        for (const e of events) await voidEvent(ctx.db, plantId, e.id);
        done?.();
      }
    });
    done?.();
    return events;
  } catch (err) {
    toast(err.message || S.err.invalid);
    return null;
  }
}

function dateField() {
  const input = h('input', { type: 'datetime-local', value: toLocalInput(now()) });
  return { el: field(S.ui.date, input), get: () => fromLocalInput(input.value) };
}

const buttons = (onSave, label = S.ui.save) =>
  h('div', { class: 'form-actions' },
    h('button', { type: 'button', class: 'btn btn-secondary', onclick: closeSheet }, S.ui.cancel),
    h('button', { type: 'button', class: 'btn btn-primary', onclick: onSave }, label));

// ---------- moisture check (spec 4.1) ----------
export function moistureSheet(plant, done) {
  const info = dryingInfo(plant, ctx.rules);
  const last = plant.cache.lastWateredAt ?? plant.startDate;
  const t = daysBetween(last, now());
  let answer = null, touched = false;
  const cb = h('input', { type: 'checkbox', checked: true });
  cb.addEventListener('change', () => { touched = true; });
  const d = dateField();
  const opts = MOISTURE_ANSWERS.map((a) => h('button', {
    type: 'button', class: `moisture-btn ${a}`, dataset: { answer: a },
    onclick: () => {
      answer = a;
      opts.forEach((o) => o.classList.toggle('selected', o.dataset.answer === a));
      if (!touched) cb.checked = a !== 'wet';
      save.disabled = false;
    }
  }, S.moisture[a]));
  const save = h('button', { type: 'button', class: 'btn btn-primary', disabled: true, onclick: () => {
    if (!answer) return;
    submit(plant.id, [{ type: 'moisture_check', occurredAt: d.get(), payload: { answer, watered: cb.checked } }],
      `${S.moisture[answer]}${cb.checked ? ' · zalito' : ''}`, done);
  } }, S.ui.save);
  openSheet(`${S.ui.moistureCheck} – ${plant.name}`, h('div', {},
    h('p', { class: 'muted' }, `Od poslední zálivky uplynulo ${num(t)} dne. Očekávané schnutí: ${num(info.d)} dne.`),
    h('div', { class: 'moisture-row' }, opts),
    h('label', { class: 'check-row' }, cb, h('span', {}, S.ui.watered)),
    d.el,
    h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn btn-secondary', onclick: closeSheet }, S.ui.cancel), save)));
}

// ---------- simple care forms ----------
export function fertilizeSheet(plant, done) {
  const product = h('input', { type: 'text', placeholder: 'nepovinné' });
  const d = dateField();
  openSheet(`${S.ui.fertilize} – ${plant.name}`, h('div', {}, field('Přípravek', product), d.el,
    buttons(() => submit(plant.id, [{ type: 'fertilizing', occurredAt: d.get(), payload: { product: product.value } }], 'Přihnojeno', done))));
}

export function pestCheckSheet(plant, done) {
  const result = chipGroup([['clean', S.ui.pestClean], ['found', S.ui.pestFound]], 'clean');
  result.el.id = 'pest-result';
  const note = h('textarea', { rows: 2 });
  const d = dateField();
  openSheet(`${S.ui.pestCheck} – ${plant.name}`, h('div', {},
    field(S.ui.pestCheck, result.el), field(S.ui.note, note), d.el,
    buttons(() => submit(plant.id, [{ type: 'pest_check', occurredAt: d.get(), payload: { found: result.get() === 'found', note: note.value } }], 'Kontrola zapsána', done))));
}

export function problemSheet(plant, done) {
  const type = chipGroup(PROBLEM_TYPES.map((k) => [k, S.problem[k]]), 'pest');
  const sev = chipGroup([[1, '1 – lehké'], [2, '2 – střední'], [3, '3 – vážné']], 1);
  const note = h('textarea', { rows: 2 });
  const d = dateField();
  openSheet(`${S.ui.problem} – ${plant.name}`, h('div', {},
    field('Typ', type.el), field(S.ui.severity, sev.el), field(S.ui.note, note), d.el,
    buttons(() => submit(plant.id, [{ type: 'problem', occurredAt: d.get(), payload: { problemType: type.get(), severity: sev.get(), note: note.value } }], 'Problém zapsán', done))));
}

export function followUpSheet(plant, task, done) {
  const btn = (label, cls, fn) => h('button', { type: 'button', class: `btn ${cls}`, onclick: fn }, label);
  openSheet(`${S.taskLabel.problemFollowUp} – ${plant.name}`, h('div', { class: 'stack' },
    btn(S.ui.stillProblem, 'btn-secondary', () => submit(plant.id, [{ type: 'pest_check', payload: { found: true } }], 'Kontrola zapsána', done)),
    btn(S.ui.resolved, 'btn-primary', () => submit(plant.id, [
      { type: 'pest_check', payload: { found: false } },
      { type: 'problem_resolved', payload: { problemId: task.problemId } }
    ], 'Problém vyřešen', done))));
}

export function noteSheet(plant, done) {
  const text = h('textarea', { rows: 4 });
  const d = dateField();
  openSheet(`${S.ui.addNote} – ${plant.name}`, h('div', {}, field(S.ui.note, text), d.el,
    buttons(() => submit(plant.id, [{ type: 'note', occurredAt: d.get(), payload: { text: text.value } }], 'Poznámka uložena', done))));
}

export function photoSheet(plant, done) {
  const file = h('input', { type: 'file', accept: 'image/*', capture: 'environment' });
  const caption = h('input', { type: 'text', placeholder: 'nepovinné' });
  const d = dateField();
  openSheet(`${S.ui.addPhoto} – ${plant.name}`, h('div', {}, field(S.ui.photo, file), field('Popisek', caption), d.el,
    buttons(async () => {
      if (!file.files[0]) return toast(S.err.invalid);
      try {
        const photoId = await savePhotoFile(ctx.db, plant.id, file.files[0]);
        await submit(plant.id, [{ type: 'photo', occurredAt: d.get(), payload: { photoId, caption: caption.value } }], 'Fotka uložena', done);
      } catch (e) { toast(e.message); }
    })));
}

const MEASURES = [['výška', 'cm'], ['teplota', '°C'], ['pH', ''], ['EC', 'mS/cm'], ['vlhkost vzduchu', '%'], ['jiné', '']];
export function measurementSheet(plant, done) {
  const kind = chipGroup(MEASURES.map(([k]) => [k, k]), 'výška');
  const value = h('input', { type: 'number', step: 'any', inputmode: 'decimal' });
  const d = dateField();
  openSheet(`${S.ui.measurement} – ${plant.name}`, h('div', {}, field('Veličina', kind.el), field('Hodnota', value), d.el,
    buttons(() => {
      const unit = MEASURES.find(([k]) => k === kind.get())[1];
      submit(plant.id, [{ type: 'measurement', occurredAt: d.get(), payload: { kind: kind.get(), value: value.value === '' ? NaN : Number(value.value), unit } }], 'Měření uloženo', done);
    })));
}

const MILESTONES = ['Přesazení', 'Řez', 'Zakořenění', 'Výsev', 'Přenesení ven'];
export function milestoneSheet(plant, done) {
  const label = h('input', { type: 'text', placeholder: 'např. Přesazení' });
  const chips = chipGroup(MILESTONES.map((m) => [m, m]), null, (v) => { label.value = v; });
  const d = dateField();
  openSheet(`${S.ui.milestone} – ${plant.name}`, h('div', {}, chips.el, field('Název', label), d.el,
    buttons(() => submit(plant.id, [{ type: 'milestone', occurredAt: d.get(), payload: { label: label.value } }], 'Milník uložen', done))));
}

export function environmentSheet(plant, done) {
  const env = chipGroup(Object.entries(S.environment), plant.cache.environment);
  const d = dateField();
  openSheet(`${S.ui.changeEnv} – ${plant.name}`, h('div', {}, field(S.ui.environment, env.el), d.el,
    buttons(() => {
      if (env.get() === plant.cache.environment) return closeSheet();
      submit(plant.id, [{ type: 'environment_change', occurredAt: d.get(), payload: { environment: env.get() } }], 'Prostředí změněno', done);
    })));
}

// ---------- quick actions ----------
export const quickWatered = (plant, done) =>
  submit(plant.id, [{ type: 'watering', payload: {} }], 'Zalito', done);

export async function snoozeSheet(task, done) {
  const btn = (n) => h('button', { type: 'button', class: 'btn btn-secondary', onclick: async () => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n);
    await snoozeTask(ctx.db, task.plantId, task.snoozeKey, d.toISOString());
    closeSheet(); toast(`Odloženo do ${relDay(d.toISOString(), now())}`); done?.();
  } }, n === 1 ? 'Na zítra' : `Na ${n} dny`);
  openSheet(`${S.ui.snooze} – ${task.plantName}`, h('div', { class: 'stack' }, [1, 2, 3].map(btn)));
}

// ---------- harvest (spec 5.1, RCv0.191: every harvest is a batch with its own processing) ----------
const terminalStage = (plant) => getStages(plant.category, plant.lifecycle).find((k) => STAGE_FLAGS[k]?.terminal) ?? null;
const batchLabel = (b) => `${fmtDate(b.harvestedAt)} · ${S.batchPhase[b.phase] || b.phase}`;
const btn = (label, cls, fn, id) => h('button', { type: 'button', class: `btn ${cls}`, id, onclick: fn }, label);

export function archiveSheet(plant, done) {
  openSheet(`${S.ui.archive} – ${plant.name}`, h('div', { class: 'stack' },
    h('p', { class: 'muted' }, S.ui.archiveAsk),
    h('button', { type: 'button', class: 'btn btn-primary', id: 'btn-do-archive', onclick: async () => {
      try { await appendEvents(ctx.db, plant.id, [{ type: 'archive', payload: {} }]); closeSheet(); toast('Archivováno'); done?.(); } catch (e) { toast(e.message); }
    } }, S.ui.archive),
    h('button', { type: 'button', class: 'btn btn-secondary', onclick: closeSheet }, S.ui.later)));
}

/** State a plant moves to after its final harvest: dormancy for perennials, "Sklizeno" (or the end) for cycles. */
export function finalTarget(plant) {
  if (plant.lifecycle === 'perennial') return 'dormant';
  const stages = getStages(plant.category, plant.lifecycle);
  return stages.includes('harvested') ? 'harvested' : terminalStage(plant);
}

/** Setting "Po poslední sklizni" = ask: offer the move once. */
function afterFinalSheet(plant, target, done) {
  const go = async () => {
    try {
      await appendEvents(ctx.db, plant.id, [{ type: 'stage_change', payload: { from: plant.cache.stage, to: target } }]);
      closeSheet(); toast(S.ui.switched); done?.();
    } catch (e) { toast(e.message); }
  };
  openSheet(S.ui.harvestSaved, h('div', { class: 'stack' },
    h('p', { class: 'muted' }, S.ui.afterFinalAsk),
    btn(`${S.ui.switchTo} „${S.stage[target]}“`, 'btn-primary', go, 'btn-final-switch'),
    btn(S.ui.notYet, 'btn-secondary', () => { closeSheet(); done?.(); }, 'btn-final-keep')));
}

const defaultMethod = (plant) => (FRESH_CATEGORIES.includes(plant.category) ? 'none' : 'drying');

/** Processing method chips plus the optional drying estimate (shown only for drying). */
function methodPicker(plant, value = defaultMethod(plant)) {
  const est = h('input', { type: 'number', step: '0.5', min: '0.5', max: '120', inputmode: 'decimal', id: 'est-days' });
  const estField = field(S.ui.estDays, est);
  const toggle = (v) => { estField.style.display = v === 'drying' ? '' : 'none'; };
  const method = chipGroup(PROCESSING_METHODS.map((m) => [m, S.processing[m]]), value, toggle);
  method.el.id = 'processing-method';
  toggle(value);
  return { method, estField, est: () => (est.value === '' ? null : Number(est.value)) };
}

export function harvestSheet(plant, done) {
  const cfg = CATEGORIES[plant.category];
  const inputs = cfg.harvestFields.map((f) => ({ f, el: h('input', { type: 'number', step: 'any', min: f.min, inputmode: 'decimal', dataset: { key: f.key } }) }));
  const mp = methodPicker(plant);
  const note = h('textarea', { rows: 2 });
  const fin = h('input', { type: 'checkbox', id: 'harvest-final' });
  const d = dateField();
  const save = async () => {
    const payload = {};
    for (const { f, el } of inputs) if (el.value !== '') payload[f.key] = Number(el.value);
    if (!Object.keys(payload).length) return toast(S.ui.fillOne);
    payload.processingMethod = mp.method.get();
    if (payload.processingMethod === 'drying' && mp.est() != null) payload.estDays = mp.est();
    if (note.value.trim()) payload.note = note.value.trim();
    if (fin.checked) payload.final = true;
    const rule = ctx.rules.afterFinalHarvest;
    const target = fin.checked ? finalTarget(plant) : null;
    const move = !!target && target !== plant.cache.stage;
    const events = [{ type: 'harvest', occurredAt: d.get(), payload }];
    if (move && rule === 'auto') events.push({ type: 'stage_change', payload: { from: plant.cache.stage, to: target } });
    const ok = await submit(plant.id, events, S.ui.harvestSaved, done);
    if (ok && move && rule === 'ask') afterFinalSheet(plant, target, done);
  };
  openSheet(`${S.ui.recordHarvest} – ${plant.name}`, h('div', {},
    d.el,
    inputs.map(({ f, el }) => field(S.harvestField[f.key] || f.key, el)),
    field(S.ui.processing, mp.method.el),
    mp.estField,
    h('label', { class: 'check-row' }, fin, h('span', {}, S.ui.finalHarvest)),
    h('div', { class: 'field-hint' }, S.ui.finalHint),
    field(S.ui.note, note),
    buttons(save)));
}

// ---------- batches ----------

/** First answer for a harvest that has no processing yet ("pending"). */
export function batchMethodSheet(plant, batch, done) {
  const mp = methodPicker(plant);
  openSheet(`${S.ui.batchMethod} – ${plant.name}`, h('div', {},
    h('p', { class: 'muted' }, `${S.ui.batchPending}: ${fmtDate(batch.harvestedAt)}`),
    field(S.ui.processing, mp.method.el), mp.estField,
    buttons(() => {
      const m = mp.method.get();
      const payload = { batchId: batch.id, phase: m === 'none' ? 'ready' : m, method: m };
      if (m === 'drying' && mp.est() != null) payload.estDays = mp.est();
      submit(plant.id, [{ type: 'batch_step', payload }], S.ui.batchSaved, done);
    })));
}

/** Move a batch to another phase (processing phases, ready, used, discarded). */
export function batchStepSheet(plant, batch, done, heading) {
  const fresh = FRESH_CATEGORIES.includes(plant.category);
  const order = fresh ? ['storing', 'ready', 'used', 'discarded', ...PROCESSING_PHASES.filter((x) => x !== 'storing')] : BATCH_PHASES;
  const options = order.filter((x) => x !== batch.phase);
  const start = batch.phase === 'ready' ? 'used' : options.includes('ready') ? 'ready' : options[0];
  const est = h('input', { type: 'number', step: '0.5', min: '0.5', max: '120', inputmode: 'decimal', id: 'est-days' });
  const estField = field(S.ui.estDays, est);
  const toggle = (v) => { estField.style.display = v === 'drying' ? '' : 'none'; };
  const phase = chipGroup(options.map((x) => [x, S.batchPhase[x]]), start, toggle);
  phase.el.id = 'batch-phase';
  toggle(start);
  const note = h('textarea', { rows: 2 });
  const d = dateField();
  openSheet(`${S.ui.movePhase} – ${plant.name}`, h('div', {},
    h('p', { class: 'muted' }, heading || batchLabel(batch)),
    field(S.ui.movePhase, phase.el), estField, field(S.ui.note, note), d.el,
    buttons(() => {
      const payload = { batchId: batch.id, phase: phase.get() };
      if (payload.phase === 'drying' && est.value !== '') payload.estDays = Number(est.value);
      if (note.value.trim()) payload.note = note.value.trim();
      submit(plant.id, [{ type: 'batch_step', occurredAt: d.get(), payload }], S.ui.batchSaved, done);
    })));
}

/** Check of a batch: dryness (while drying), mold, scent, appearance. */
export function batchCheckSheet(plant, batch, done) {
  const drying = batch.phase === 'drying';
  const lastDry = batch.checks.filter((c) => c.dryness != null).at(-1)?.dryness ?? null;
  const dry = chipGroup(Array.from({ length: DRYNESS_MAX + 1 }, (_, i) => [i, `${i} · ${S.dryness[i]}`]), lastDry);
  dry.el.id = 'batch-dryness';
  const mold = chipGroup([['no', S.ui.moldNone], ['yes', S.ui.moldFound]], 'no');
  mold.el.id = 'batch-mold';
  const scent = starPicker(0), look = starPicker(0);
  const note = h('textarea', { rows: 2 });
  const d = dateField();
  openSheet(`${S.ui.batchCheck} – ${plant.name}`, h('div', {},
    h('p', { class: 'muted' }, batchLabel(batch)),
    drying ? field(S.ui.dryness, dry.el) : null,
    field(S.ui.mold, mold.el),
    field(S.ui.scent, scent.el), field(S.ui.batchLook, look.el),
    field(S.ui.note, note), d.el,
    buttons(async () => {
      if (drying && dry.get() == null) return toast(S.ui.dryness);
      const payload = { batchId: batch.id, mold: mold.get() === 'yes' };
      if (drying) payload.dryness = Number(dry.get());
      if (scent.get()) payload.scent = scent.get();
      if (look.get()) payload.appearance = look.get();
      if (note.value.trim()) payload.note = note.value.trim();
      const ok = await submit(plant.id, [{ type: 'batch_check', occurredAt: d.get(), payload }], 'Kontrola zapsána', done);
      if (ok && drying && payload.dryness === DRYNESS_MAX) batchStepSheet(plant, batch, done, S.ui.dryDone);
    })));
}

/** "Use by" reminder of fresh produce: used / discarded / still have it. */
export function useBySheet(plant, task, done) {
  const batch = (plant.cache.batches || []).find((b) => b.id === task.batchId);
  if (!batch) return;
  const step = (phase) => () => submit(plant.id, [{ type: 'batch_step', payload: { batchId: batch.id, phase } }], S.batchPhase[phase], done);
  openSheet(`${S.taskLabel.useBy} – ${plant.name}`, h('div', { class: 'stack' },
    h('p', { class: 'muted' }, `${S.ui.useAsk} ${batchLabel(batch)}`),
    btn(S.ui.markUsed, 'btn-primary', step('used'), 'btn-batch-used'),
    btn(S.ui.markDiscarded, 'btn-secondary', step('discarded'), 'btn-batch-discarded'),
    btn(S.ui.stillHave, 'btn-secondary', async () => {
      const t = new Date(); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() + 3);
      await snoozeTask(ctx.db, plant.id, task.snoozeKey, t.toISOString());
      closeSheet(); done?.();
    }, 'btn-batch-keep')));
}

/** Estimated drying time of a batch, in days (for the panel). */
export const batchEstimate = (batch, plant) => effectiveDryingDays(batch, ctx.rules, plant ? batchRatio(plant, batch, ctx.priors) : (batch.ratio ?? 1));

// ---------- other care (pruning, repotting, misting, custom) ----------
export function careSheet(plant, done) {
  const kind = chipGroup(CARE_KINDS.map((k) => [k, S.care[k]]), 'pruning', (v) => { label.style.display = v === 'custom' ? '' : 'none'; pot.style.display = v === 'repotting' ? '' : 'none'; });
  kind.el.id = 'care-kind';
  const labelInput = h('input', { type: 'text', placeholder: S.ui.careLabel, id: 'care-label' });
  const label = field(S.ui.careLabel, labelInput);
  const potInput = h('input', { type: 'number', step: 'any', min: '0.1', inputmode: 'decimal', id: 'care-pot', value: plant.cache.pot?.volumeL ?? '' });
  const pot = field(S.ui.potVolume, potInput);
  label.style.display = 'none'; pot.style.display = 'none';
  const note = h('textarea', { rows: 2 });
  const d = dateField();
  openSheet(`${S.ui.care} – ${plant.name}`, h('div', {},
    field(S.ui.careKind, kind.el), label, pot, field(S.ui.note, note), d.el,
    buttons(() => {
      const payload = { kind: kind.get() };
      if (payload.kind === 'custom') payload.label = labelInput.value;
      if (payload.kind === 'repotting' && potInput.value !== '') payload.potVolumeL = Number(potInput.value);
      if (note.value.trim()) payload.note = note.value.trim();
      submit(plant.id, [{ type: 'care', occurredAt: d.get(), payload }], S.care[payload.kind], done);
    })));
}

// ---------- evaluation (spec 5.2): each save appends a version ----------
function starPicker(value, onChange) {
  let cur = value || 0;
  const el = h('div', { class: 'star-row', role: 'radiogroup' });
  const btns = [];
  const paint = () => btns.forEach((b, i) => { b.textContent = i < cur ? '★' : '☆'; b.classList.toggle('on', i < cur); });
  for (let i = 1; i <= RATING_MAX; i++) {
    btns.push(h('button', { type: 'button', class: 'star-btn', dataset: { star: i }, 'aria-label': `${i}`,
      onclick: () => { cur = cur === i ? 0 : i; paint(); onChange?.(cur); } }));
  }
  el.append(...btns); paint();
  return { el, get: () => cur };
}

/** opts: { kind: 'tasting' | 'final', batchId } to open the form preselected. */
export async function evaluationSheet(plant, done, opts = {}) {
  const events = await getEvents(ctx.db, plant.id);
  const c = plant.cache;
  const batches = c.batches || [];
  const perennialHarvest = plant.lifecycle === 'perennial' && plant.harvestable;
  const afterHarvest = !!c.finalHarvestAt || ['harvested', 'done', 'dormant'].includes(c.stage) || batches.some((b) => b.readyAt || b.phase === 'used');
  let kind = opts.kind ?? (afterHarvest || !plant.harvestable ? 'final' : 'tasting');
  const kindChips = chipGroup([['tasting', S.ui.tasting], ['final', S.ui.finalEval]], kind, (v) => { kind = v; hint.style.display = v === 'tasting' ? '' : 'none'; });
  kindChips.el.id = 'eval-kind';
  const hint = h('div', { class: 'field-hint' }, S.ui.tastingHint);
  hint.style.display = kind === 'tasting' ? '' : 'none';
  let batchId = opts.batchId ?? '';
  const batchChips = batches.length
    ? chipGroup([['', S.ui.wholePlant], ...batches.map((b) => [b.id, batchLabel(b)])], batchId, (v) => { batchId = v; }) : null;
  if (batchChips) batchChips.el.id = 'eval-batch';
  const part = h('input', { type: 'text', id: 'eval-part', placeholder: S.ui.evalPartHint });
  const prev = kind === 'final' ? latestEvaluation(events, undefined, opts.batchId === undefined ? undefined : opts.batchId || null) : null;
  const p = prev?.payload || {};
  if (p.part) part.value = p.part;
  const criteriaList = [{ key: 'overall', label: S.criterion.overall }, ...activeCriteria(plant.category, ctx.criteria)];
  const criteria = criteriaList.map((c) => c.key);
  const pickers = Object.fromEntries(criteria.map((k) => [k, starPicker(p.scores?.[k])]));
  let grow = p.wouldGrowAgain ?? null;
  const growChips = chipGroup([['yes', S.ui.yes], ['no', S.ui.no]], grow == null ? null : (grow ? 'yes' : 'no'), (v) => { grow = v === 'yes'; });
  growChips.el.id = 'eval-grow';
  const note = h('textarea', { rows: 3 }); note.value = p.note || '';
  const season = h('input', { type: 'number', step: '1', min: '2000', max: '2100', value: p.season ?? new Date().getFullYear() });
  const d = dateField();
  const save = () => {
    if (!pickers.overall.get()) return toast(S.ui.overallRequired);
    const scores = {};
    for (const k of criteria) if (pickers[k].get()) scores[k] = pickers[k].get();
    const payload = { scores, kind };
    if (grow != null) payload.wouldGrowAgain = grow;
    if (note.value.trim()) payload.note = note.value.trim();
    if (perennialHarvest && season.value !== '') payload.season = Number(season.value);
    if (batchId) payload.batchId = batchId;
    if (part.value.trim()) payload.part = part.value.trim();
    submit(plant.id, [{ type: 'evaluation', occurredAt: d.get(), payload }], kind === 'tasting' ? 'Ochutnávka uložena' : 'Hodnocení uloženo', done);
  };
  openSheet(`${S.ui.evaluation} – ${plant.name}`, h('div', {},
    plant.harvestable ? field(S.ui.evalKind, kindChips.el) : null,
    plant.harvestable ? hint : null,
    batchChips ? field(S.ui.evalBatch, batchChips.el) : null,
    plant.harvestable ? field(S.ui.evalPart, part) : null,
    criteriaList.map((c) => field(c.label, pickers[c.key].el)),
    field(S.ui.wouldGrowAgain, growChips.el),
    perennialHarvest ? field(S.ui.season, season) : null,
    field(S.ui.note, note),
    d.el,
    buttons(save)));
}
