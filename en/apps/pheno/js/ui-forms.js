// Event forms as bottom sheets. Every form has a date field (backdating allowed).
import { CATEGORIES, MOISTURE_ANSWERS, PROBLEM_TYPES, PROCESSING_METHODS, RATING_MAX, STAGE_FLAGS, getStages } from './config-categories.js';
import { dryingInfo } from './calendar.js';
import { ctx, now } from './ctx.js';
import { chipGroup, field, h } from './dom.js';
import { appendEvents, snoozeTask, voidEvent } from './events.js';
import { fromLocalInput, num, relDay, starsText, toLocalInput } from './format.js';
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
  const info = dryingInfo(plant);
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
  const found = h('input', { type: 'checkbox' });
  const note = h('textarea', { rows: 2 });
  const d = dateField();
  openSheet(`${S.ui.pestCheck} – ${plant.name}`, h('div', {},
    h('label', { class: 'check-row' }, found, h('span', {}, S.ui.foundPests)), field(S.ui.note, note), d.el,
    buttons(() => submit(plant.id, [{ type: 'pest_check', occurredAt: d.get(), payload: { found: found.checked, note: note.value } }], 'Kontrola zapsána', done))));
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

// ---------- harvest (spec 5.1) ----------
const terminalStage = (plant) => getStages(plant.category, plant.lifecycle).find((k) => STAGE_FLAGS[k]?.terminal) ?? null;

export function archiveSheet(plant, done) {
  openSheet(`${S.ui.archive} – ${plant.name}`, h('div', { class: 'stack' },
    h('p', { class: 'muted' }, S.ui.archiveAsk),
    h('button', { type: 'button', class: 'btn btn-primary', id: 'btn-do-archive', onclick: async () => {
      try { await appendEvents(ctx.db, plant.id, [{ type: 'archive', payload: {} }]); closeSheet(); toast('Archivováno'); done?.(); } catch (e) { toast(e.message); }
    } }, S.ui.archive),
    h('button', { type: 'button', class: 'btn btn-secondary', onclick: closeSheet }, S.ui.later)));
}

/** After a harvest of a cycle plant: offer next stage / end the cycle. Perennials stay as they are. */
function harvestFollowUp(plant, done) {
  if (plant.lifecycle === 'perennial') return;
  const stages = getStages(plant.category, plant.lifecycle);
  const term = terminalStage(plant);
  const cur = stages.indexOf(plant.cache.stage);
  const next = stages[cur + 1];
  const btn = (label, cls, fn, id) => h('button', { type: 'button', class: `btn ${cls}`, id, onclick: fn }, label);
  const go = async (to, after) => {
    try { await appendEvents(ctx.db, plant.id, [{ type: 'stage_change', payload: { from: plant.cache.stage, to } }]); closeSheet(); done?.(); after?.(); } catch (e) { toast(e.message); }
  };
  const buttons = [];
  if (next && next !== term) buttons.push(btn(`${S.ui.nextStage} „${S.stage[next]}“`, 'btn-secondary', () => go(next), 'btn-next-stage'));
  if (term && plant.cache.stage !== term) {
    buttons.push(btn(S.ui.endCycle, 'btn-primary', () => go(term, () => archiveSheet({ ...plant, cache: { ...plant.cache, stage: term } }, done)), 'btn-end-cycle'));
  }
  buttons.push(btn(S.ui.keepGoing, 'btn-secondary', () => { closeSheet(); done?.(); }, 'btn-keep'));
  openSheet(S.ui.harvestSaved, h('div', { class: 'stack' }, buttons));
}

export function harvestSheet(plant, done) {
  const cfg = CATEGORIES[plant.category];
  const inputs = cfg.harvestFields.map((f) => ({ f, el: h('input', { type: 'number', step: 'any', min: f.min, inputmode: 'decimal', dataset: { key: f.key } }) }));
  const method = chipGroup([['', '—'], ...PROCESSING_METHODS.map((m) => [m, S.processing[m]])], '');
  const days = h('input', { type: 'number', step: '1', min: '0', inputmode: 'numeric' });
  const note = h('textarea', { rows: 2 });
  const d = dateField();
  const save = async () => {
    const payload = {};
    for (const { f, el } of inputs) if (el.value !== '') payload[f.key] = Number(el.value);
    if (!Object.keys(payload).length) return toast(S.ui.fillOne);
    if (method.get()) payload.processingMethod = method.get();
    if (days.value !== '') payload.processingDays = Number(days.value);
    if (note.value.trim()) payload.note = note.value.trim();
    const ok = await submit(plant.id, [{ type: 'harvest', occurredAt: d.get(), payload }], S.ui.harvestSaved, done);
    if (ok) harvestFollowUp(plant, done);
  };
  openSheet(`${S.ui.recordHarvest} – ${plant.name}`, h('div', {},
    d.el,
    inputs.map(({ f, el }) => field(S.harvestField[f.key] || f.key, el)),
    field(S.ui.processing, method.el),
    field(S.ui.processingDays, days),
    field(S.ui.note, note),
    buttons(save)));
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

export async function evaluationSheet(plant, done) {
  const events = await getEvents(ctx.db, plant.id);
  const perennialHarvest = plant.lifecycle === 'perennial' && plant.harvestable;
  const prev = latestEvaluation(events);
  const p = prev?.payload || {};
  const criteria = ['overall', ...CATEGORIES[plant.category].criteria];
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
    const payload = { scores };
    if (grow != null) payload.wouldGrowAgain = grow;
    if (note.value.trim()) payload.note = note.value.trim();
    if (perennialHarvest && season.value !== '') payload.season = Number(season.value);
    submit(plant.id, [{ type: 'evaluation', occurredAt: d.get(), payload }], 'Hodnocení uloženo', done);
  };
  openSheet(`${S.ui.evaluation} – ${plant.name}`, h('div', {},
    criteria.map((k) => field(S.criterion[k], pickers[k].el)),
    field(S.ui.wouldGrowAgain, growChips.el),
    perennialHarvest ? field(S.ui.season, season) : null,
    field(S.ui.note, note),
    d.el,
    buttons(save)));
}
