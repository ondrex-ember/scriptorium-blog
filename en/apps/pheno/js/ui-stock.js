// Stock after harvest (RCv0.192): the "Zásoba" tab under a plant, its sheets, stock tasks and the cross-plant overview.
import { BATCH_ENDED } from './config-categories.js';
import { ctx, loadAll, now } from './ctx.js';
import { chipGroup, clear, field, h, icon, put } from './dom.js';
import { appendEvents, snoozeTask } from './events.js';
import { fmtDate, num, relDay } from './format.js';
import { getPlant } from './storage.js';
import { navigate, guard } from './router.js';
import { closeSheet, openSheet, toast } from './sheet.js';
import { STOCK_UNITS, MAX_CONTAINERS, batchRemaining, convertAmount, methodComparison, plantStock, suggestInitial } from './stock.js';
import { presetFor, resolveMethods } from './stockcfg.js';
import { S } from './strings.cs.js';
import { uid } from './utils.js';
import { batchLabel, buttons, dateField, evaluationSheet, setStockOffer, starPicker, submit } from './ui-forms.js';

const T = S.stock;
const DIGITS = { g: 1, kg: 2, ks: 0 };
export const fmtAmt = (a, unit) => `${num(a, DIGITS[unit] ?? 1)} ${unit}`;
const env = () => ({ cfg: ctx.stockCfg, rules: ctx.rules, priors: ctx.priors });
const methodChips = (value, onChange) => chipGroup(Object.values(resolveMethods(ctx.stockCfg)).map((m) => [m.key, m.label]), value, onChange);
const methodLabel = (key) => resolveMethods(ctx.stockCfg)[key]?.label ?? T.method.other;
const qClass = (pct) => (pct >= 70 ? 'q-ok' : pct >= 40 ? 'q-mid' : 'q-low');

/** Plant tab requested from outside (a task on the dashboard): ui-plant consumes it on render. */
export const tabRequest = { id: null, tab: null };

/** Batches that may get a stock now: processed or stored, not yet weighed, not finished. */
export const stockEligible = (b) => !b.legacy && !b.stock && !['pending', 'drying'].includes(b.phase) && !BATCH_ENDED.includes(b.phase);

const findContainer = (plant, containerId) => {
  for (const b of plant.cache.batches || []) {
    const k = b.stock?.containers.find((x) => x.id === containerId);
    if (k) return { batch: b, k };
  }
  return { batch: null, k: null };
};

// ---------- sheets ----------

/** Weigh what is left after processing and spread it over containers with their storage method. */
export function stockInitSheet(plant, batch, done) {
  const sug = suggestInitial(plant, batch);
  let unit = sug.unit;
  const preset = presetFor(plant, ctx.stockCfg);
  const rows = [];
  const list = h('div', { class: 'stack', id: 'stock-rows' });
  const addBtn = h('button', { type: 'button', class: 'btn btn-secondary btn-sm', id: 'btn-add-container', onclick: () => addRow(null) }, icon('plus'), T.addContainer);

  function addRow(amount) {
    if (rows.length >= MAX_CONTAINERS) return toast(T.tooMany);
    const amt = h('input', { type: 'number', step: 'any', min: '0', inputmode: 'decimal', class: 'stock-amount', value: amount ?? '' });
    const method = methodChips(preset.method);
    const label = h('input', { type: 'text', maxlength: 40, placeholder: T.labelPh });
    const rm = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': T.removeContainer, onclick: () => {
      rows.splice(rows.indexOf(row), 1); row.el.remove(); renumber();
    } }, icon('trash'));
    const title = h('strong', {});
    const row = { amt, method, label, title, rm, el: h('div', { class: 'card pad stock-row' },
      h('div', { class: 'stock-row-head' }, title, rm), field(T.amount, amt), field(T.storedIn, method.el), field(T.label, label)) };
    rows.push(row); list.append(row.el); renumber();
  }
  function renumber() {
    rows.forEach((r, i) => { r.title.textContent = T.containerN(i + 1); r.rm.style.display = rows.length > 1 ? '' : 'none'; });
    addBtn.disabled = rows.length >= MAX_CONTAINERS;
  }
  addRow(sug.amount != null ? Math.round(sug.amount * 1000) / 1000 : null);

  const unitChips = chipGroup(STOCK_UNITS.map((u) => [u, u]), unit, (u) => {
    for (const r of rows) {
      const v = Number(r.amt.value);
      const c = r.amt.value !== '' && Number.isFinite(v) ? convertAmount(v, unit, u) : null;
      if (c != null) r.amt.value = String(Math.round(c * 1000) / 1000);
    }
    unit = u;
  });
  unitChips.el.id = 'stock-unit';
  const est = h('input', { type: 'checkbox', id: 'stock-estimate', checked: sug.basis === 'default' || sug.basis === 'none' });
  const d = dateField();
  const hint = sug.basis === 'learned' ? T.suggest.learned(num(sug.ratio, 2)) : T.suggest[sug.basis];

  openSheet(`${T.initTitle} – ${plant.name}`, h('div', {},
    h('p', { class: 'muted' }, `${batchLabel(batch)} · ${T.initHint}`),
    h('div', { class: 'field-hint', id: 'stock-suggest' }, hint),
    field(T.unit, unitChips.el),
    list, addBtn,
    h('label', { class: 'check-row' }, est, h('span', {}, T.estimate)),
    d.el,
    buttons(() => {
      const containers = rows.map((r) => ({ id: uid(), amount: Number(r.amt.value), method: r.method.get(), ...(r.label.value.trim() ? { label: r.label.value.trim() } : {}) }));
      if (containers.some((c) => !(c.amount > 0))) return toast(T.needAmount);
      submit(plant.id, [{ type: 'stock_init', occurredAt: d.get(), payload: { batchId: batch.id, unit, containers, source: est.checked ? 'estimate' : 'weighed' } }], T.saved, done);
    })));
}

const QUICK = { g: [1, 2, 3, 5, 10], kg: [0.1, 0.25, 0.5, 1], ks: [1, 2, 3, 5] };

/** Take an amount out of a container. First withdrawal from a batch offers a tasting rating. */
export function stockUseSheet(plant, batch, k, done) {
  const unit = batch.stock.unit;
  const d = dateField();
  const first = !batch.stock.uses.length && !batch.evals.some((e) => e.kind === 'tasting');
  const use = async (amount) => {
    if (!(amount > 0)) return toast(T.needAmount);
    const amt = Math.min(amount, k.amount);
    const ok = await submit(plant.id, [{ type: 'stock_use', occurredAt: d.get(), payload: { batchId: batch.id, stockId: batch.stock.id, containerId: k.id, amount: amt } }],
      amt >= k.amount - 1e-9 ? T.usedAll : T.used, done);
    if (ok && first && plant.harvestable) tastePrompt(plant, batch, done);
  };
  const custom = h('input', { type: 'number', step: 'any', min: '0', inputmode: 'decimal', id: 'use-custom' });
  const quick = (QUICK[unit] || []).filter((a) => a < k.amount - 1e-9);
  openSheet(`${T.useTitle} – ${plant.name}`, h('div', { class: 'stack' },
    h('p', { class: 'muted' }, `${k.label || methodLabel(k.method)} · ${T.left} ${fmtAmt(k.amount, unit)}`),
    h('div', { class: 'quick-row' }, quick.map((a) => h('button', { type: 'button', class: 'btn btn-secondary', dataset: { amount: a }, onclick: () => use(a) }, fmtAmt(a, unit))),
      h('button', { type: 'button', class: 'btn btn-secondary', id: 'btn-use-all', onclick: () => use(k.amount) }, T.useAll)),
    field(T.useCustom, custom),
    d.el,
    h('div', { class: 'form-actions' },
      h('button', { type: 'button', class: 'btn btn-secondary', onclick: closeSheet }, S.ui.cancel),
      h('button', { type: 'button', class: 'btn btn-primary', id: 'btn-use-custom', onclick: () => use(Number(custom.value)) }, T.use))));
}

function tastePrompt(plant, batch, done) {
  openSheet(T.firstUse, h('div', { class: 'stack' },
    h('p', { class: 'muted' }, T.tasteAsk),
    h('button', { type: 'button', class: 'btn btn-primary', id: 'btn-taste-now', onclick: () => { closeSheet(); evaluationSheet(plant, done, { kind: 'tasting', batchId: batch.id }); } }, T.tasteNow),
    h('button', { type: 'button', class: 'btn btn-secondary', onclick: closeSheet }, T.tasteSkip)));
}

/** "Roughly this much is left": the difference is booked as consumption. */
export function stockAdjustSheet(plant, batch, k, done) {
  const unit = batch.stock.unit;
  const rem = h('input', { type: 'number', step: 'any', min: '0', inputmode: 'decimal', id: 'adjust-remaining', value: k.amount });
  const d = dateField();
  openSheet(`${T.adjustTitle} – ${plant.name}`, h('div', {},
    h('p', { class: 'muted' }, `${k.label || methodLabel(k.method)} · ${T.adjustHint}`),
    field(`${T.left} (${unit})`, rem), d.el,
    buttons(() => {
      const v = Number(rem.value);
      if (rem.value === '' || !(v >= 0)) return toast(T.needAmount);
      submit(plant.id, [{ type: 'stock_adjust', occurredAt: d.get(), payload: { batchId: batch.id, stockId: batch.stock.id, containerId: k.id, remaining: v } }], T.adjusted, done);
    })));
}

/** Change the storage method of a whole container, or split a part of it into a new one. */
export function stockMoveSheet(plant, batch, k, done) {
  const unit = batch.stock.unit;
  let scope = 'whole';
  const scopeChips = chipGroup([['whole', T.moveWhole], ['part', T.movePart]], scope, (v) => { scope = v; amtField.style.display = v === 'part' ? '' : 'none'; });
  scopeChips.el.id = 'move-scope';
  const amt = h('input', { type: 'number', step: 'any', min: '0', inputmode: 'decimal', id: 'move-amount', value: Math.round((k.amount / 2) * 1000) / 1000 });
  const amtField = field(`${T.moveAmount} (${unit})`, amt);
  amtField.style.display = 'none';
  const method = methodChips(k.method);
  method.el.id = 'move-method';
  const label = h('input', { type: 'text', maxlength: 40, placeholder: T.labelPh });
  const d = dateField();
  openSheet(`${T.moveTitle} – ${plant.name}`, h('div', {},
    h('p', { class: 'muted' }, `${k.label || methodLabel(k.method)} · ${T.left} ${fmtAmt(k.amount, unit)}`),
    field(T.scope, scopeChips.el), amtField,
    field(T.moveTo, method.el), field(T.label, label), d.el,
    buttons(() => {
      const payload = { batchId: batch.id, stockId: batch.stock.id, containerId: k.id, method: method.get() };
      const v = Number(amt.value);
      const partial = scope === 'part' && v > 0 && v < k.amount - 1e-9;
      if (scope === 'part' && !(v > 0)) return toast(T.needAmount);
      if (!partial && payload.method === k.method) return toast(T.moveNeed);
      if (partial) { payload.amount = v; payload.newContainerId = uid(); }
      if (label.value.trim()) payload.label = label.value.trim();
      submit(plant.id, [{ type: 'stock_move', occurredAt: d.get(), payload }], T.moved, done);
    })));
}

/** Rate scent and look, note mold and humidity; the ratings train the decay model of this storage method. */
export function stockCheckSheet(plant, batch, k, done) {
  const m = resolveMethods(ctx.stockCfg)[k.method];
  const scent = starPicker(0), look = starPicker(0);
  const mold = chipGroup([['no', T.moldNo], ['yes', T.moldYes]], 'no');
  mold.el.id = 'stock-mold';
  const rh = h('input', { type: 'number', step: '1', min: '0', max: '100', inputmode: 'decimal', id: 'stock-rh' });
  const aired = h('input', { type: 'checkbox', id: 'stock-aired' });
  const note = h('textarea', { rows: 2 });
  const d = dateField();
  openSheet(`${T.checkTitle} – ${plant.name}`, h('div', {},
    h('p', { class: 'muted' }, `${k.label || methodLabel(k.method)} · ${T.checkHint}`),
    field(T.scent, scent.el), field(T.look, look.el), field(T.mold, mold.el), field(T.rh, rh),
    m?.airEveryDays > 0 ? h('label', { class: 'check-row' }, aired, h('span', {}, T.aired)) : null,
    field(S.ui.note, note), d.el,
    buttons(async () => {
      const payload = { batchId: batch.id, stockId: batch.stock.id, containerId: k.id, mold: mold.get() === 'yes' };
      if (scent.get()) payload.scent = scent.get();
      if (look.get()) payload.appearance = look.get();
      if (rh.value !== '') payload.rh = Number(rh.value);
      if (aired.checked) payload.aired = true;
      if (note.value.trim()) payload.note = note.value.trim();
      const ok = await submit(plant.id, [{ type: 'stock_check', occurredAt: d.get(), payload }], T.checked, done);
      if (ok && payload.mold) moldPrompt(plant, batch, k, done);
    })));
}

function moldPrompt(plant, batch, k, done) {
  openSheet(T.moldYes, h('div', { class: 'stack' },
    h('p', { class: 'muted' }, T.moldAsk),
    h('button', { type: 'button', class: 'btn btn-danger', id: 'btn-mold-discard', onclick: () => { closeSheet(); stockDiscardSheet(plant, batch, k, done, 'mold'); } }, T.discard),
    h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => { closeSheet(); done?.(); } }, T.moldKeep)));
}

/** Throw away what is left in a container. */
export function stockDiscardSheet(plant, batch, k, done, reason = '') {
  const why = h('input', { type: 'text', maxlength: 80, id: 'discard-reason', value: reason === 'mold' ? T.moldYes : '' });
  const d = dateField();
  openSheet(`${T.discardTitle} – ${plant.name}`, h('div', {},
    h('p', { class: 'muted' }, T.discardAsk(fmtAmt(k.amount, batch.stock.unit))),
    field(T.reason, why), d.el,
    h('div', { class: 'form-actions' },
      h('button', { type: 'button', class: 'btn btn-secondary', onclick: closeSheet }, S.ui.cancel),
      h('button', { type: 'button', class: 'btn btn-danger', id: 'btn-discard', onclick: () => submit(plant.id, [{ type: 'stock_use', occurredAt: d.get(),
        payload: { batchId: batch.id, stockId: batch.stock.id, containerId: k.id, amount: k.amount, kind: 'discard', ...(why.value.trim() ? { reason: why.value.trim() } : {}) } }], T.discarded, done) }, T.discard))));
}

// ---------- tasks ----------

/** Run a stock task from the dashboard or the plant. */
export function runStockTask(task, plant, done) {
  const { batch, k } = findContainer(plant, task.containerId);
  const snooze = async (days) => {
    const t = new Date(); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() + days);
    await snoozeTask(ctx.db, plant.id, task.snoozeKey, t.toISOString());
    closeSheet(); toast(`Odloženo do ${relDay(t.toISOString(), now())}`); done?.();
  };
  const open = () => { tabRequest.id = plant.id; tabRequest.tab = 'stock'; closeSheet(); navigate(`/plant/${plant.id}`); done?.(); };
  switch (task.type) {
    case 'stockCheck': return batch && k ? stockCheckSheet(plant, batch, k, done) : null;
    case 'stockAir':
      return batch && k ? submit(plant.id, [{ type: 'stock_check', payload: { batchId: batch.id, stockId: batch.stock.id, containerId: k.id, aired: true } }], T.checked, done) : null;
    case 'stockUseBy':
      if (!batch || !k) return null;
      return openSheet(`${S.taskLabel.stockUseBy} – ${plant.name}`, h('div', { class: 'stack' },
        h('p', { class: 'muted' }, `${k.label || methodLabel(k.method)} · ${T.useByTask}`),
        h('button', { type: 'button', class: 'btn btn-primary', id: 'btn-useby-use', onclick: () => { closeSheet(); stockUseSheet(plant, batch, k, done); } }, T.use),
        h('button', { type: 'button', class: 'btn btn-secondary', id: 'btn-useby-check', onclick: () => { closeSheet(); stockCheckSheet(plant, batch, k, done); } }, T.check),
        h('button', { type: 'button', class: 'btn btn-secondary', id: 'btn-useby-discard', onclick: () => { closeSheet(); stockDiscardSheet(plant, batch, k, done); } }, T.discard),
        h('button', { type: 'button', class: 'btn btn-secondary', id: 'btn-useby-keep', onclick: () => snooze(3) }, S.ui.stillHave)));
    case 'stockLow':
      return openSheet(`${S.taskLabel.stockLow} – ${plant.name}`, h('div', { class: 'stack' },
        h('p', { class: 'muted' }, T.lowTask(task.note ?? '?')),
        h('button', { type: 'button', class: 'btn btn-primary', id: 'btn-low-open', onclick: open }, T.fromTasks),
        h('button', { type: 'button', class: 'btn btn-secondary', id: 'btn-low-snooze', onclick: () => snooze(7) }, S.ui.later)));
    default: return null;
  }
}

/** Dashboard/plant detail line for a stock task. */
export const stockTaskDetail = (task) => ({
  stockCheck: T.checkTask, stockAir: T.airTask, stockUseBy: T.useByTask, stockLow: T.lowTask(task.note ?? '?')
}[task.type] ?? '');

// ---------- offer after processing ----------

/** After a batch is ready/stored: ask to weigh it (once; the batch panel keeps the button afterwards). */
export async function offerStock(plantId, batchId, done) {
  const plant = await getPlant(ctx.db, plantId);
  const batch = plant?.cache.batches?.find((b) => b.id === batchId);
  if (!plant?.harvestable || !batch || !stockEligible(batch)) return;
  openSheet(T.init, h('div', { class: 'stack' },
    h('p', { class: 'muted' }, T.weighPrompt),
    h('button', { type: 'button', class: 'btn btn-primary', id: 'btn-weigh-now', onclick: () => { closeSheet(); stockInitSheet(plant, batch, done); } }, T.weighNow),
    h('button', { type: 'button', class: 'btn btn-secondary', id: 'btn-weigh-later', onclick: closeSheet }, T.weighLater)));
}
setStockOffer(offerStock);

// ---------- plant tab ----------

/** Plant-level summary lines: total, consumption rate, run-out. */
export function stockSummaryNode(ps, nowIso) {
  const bits = [];
  if (ps.rate) bits.push(T.rate(fmtAmt(ps.rate.perDay, ps.unit), Math.round(ps.rate.windowDays)));
  else if (ps.remaining > 0) bits.push(T.noRate);
  if (ps.runOutDays != null) bits.push(T.runOut(Math.max(1, Math.round(ps.runOutDays)), fmtDate(ps.runOutAt)));
  return h('div', { class: 'card pad', id: 'stock-summary' },
    h('div', { class: 'eval-line' }, h('span', {}, T.summary), h('strong', { id: 'stock-total' }, fmtAmt(ps.remaining, ps.unit))),
    bits.map((x) => h('div', { class: 'muted' }, x)),
    h('div', { class: 'muted' }, `${T.presetLabel}: ${ps.preset.label}`));
}

function containerRow(plant, batch, entry, done) {
  const { k, state } = entry;
  const unit = batch.stock.unit;
  const m = state.method;
  const bits = [
    `${T.left} ${fmtAmt(k.amount, unit)} ${T.of} ${fmtAmt(k.initial, unit)}`,
    state.maturing ? T.maturing(fmtDate(state.maturingUntil)) : `${T.fresh} ${state.pct} %`,
    !state.maturing && state.below ? T.belowUseBy : (!state.maturing && state.useByAt ? T.useBy(fmtDate(state.useByAt)) : null),
    k.opens ? T.opened(k.opens) : null,
    state.ratio.source === 'own' ? T.learnedTag(num(state.ratio.r, 2), state.ratio.n) : state.ratio.source === 'prior' ? T.priorTag(num(state.ratio.r, 2)) : null
  ].filter(Boolean);
  const act = (key, label, fn, cls = 'btn-secondary') => h('button', { type: 'button', class: `btn ${cls} btn-sm`, dataset: { act: key }, onclick: fn }, label);
  return h('div', { class: 'stock-container', dataset: { container: k.id, method: k.method } },
    h('div', { class: 'stock-head' },
      h('strong', {}, k.label || m.label), h('span', { class: 'tag' }, methodLabel(k.method)),
      k.moldAt ? h('span', { class: 'tag q-low' }, T.moldTag) : null,
      state.maturing ? null : h('span', { class: `tag stock-q ${qClass(state.pct)}`, dataset: { q: state.pct } }, `${state.pct} %`)),
    h('div', { class: 'stock-bar' }, h('span', { style: `width:${Math.max(2, Math.round((k.amount / Math.max(k.initial, k.amount)) * 100))}%` })),
    h('div', { class: 'timeline-detail' }, bits.join(' · ')),
    h('div', { class: 'batch-actions' }, [
      act('use', T.use, () => stockUseSheet(plant, batch, k, done), 'btn-primary'),
      act('adjust', T.adjust, () => stockAdjustSheet(plant, batch, k, done)),
      act('move', T.move, () => stockMoveSheet(plant, batch, k, done)),
      act('check', T.check, () => stockCheckSheet(plant, batch, k, done)),
      act('discard', T.discard, () => stockDiscardSheet(plant, batch, k, done), 'btn-ghost')]));
}

/** Content of the "Zásoba" tab. Works for archived plants as well: the stock outlives the growing. */
export function stockPanel(plant, done, nowIso = now()) {
  const ps = plantStock(plant, nowIso, env());
  const batches = (plant.cache.batches || []).filter((b) => !b.legacy);
  const eligible = batches.filter(stockEligible);
  const out = [];
  if (ps) out.push(stockSummaryNode(ps, nowIso));
  for (const entry of ps ? [...ps.batches].reverse() : []) {
    const { batch, containers } = entry;
    const open = containers.filter(({ k }) => k.status === 'open');
    const closed = containers.length - open.length;
    out.push(h('div', { class: 'card pad stock-batch', dataset: { batch: batch.id } },
      h('div', { class: 'eval-line' }, h('strong', {}, `${fmtDate(batch.harvestedAt)} · ${S.batchPhase[batch.phase] || batch.phase}`),
        h('span', { class: 'muted' }, `${fmtAmt(entry.remaining, batch.stock.unit)} ${T.of} ${fmtAmt(batch.stock.initial, batch.stock.unit)}`)),
      h('div', { class: 'muted' }, `${T.source[batch.stock.source]} · ${T.since} ${fmtDate(batch.stock.at)}`),
      open.map((c) => containerRow(plant, batch, c, done)),
      closed ? h('div', { class: 'muted' }, T.emptied(closed)) : null));
  }
  for (const b of eligible) {
    const sug = suggestInitial(plant, b);
    out.push(h('div', { class: 'card pad stock-batch', dataset: { batch: b.id } },
      h('div', { class: 'eval-line' }, h('strong', {}, batchLabel(b)),
        sug.amount != null ? h('span', { class: 'muted' }, `~${fmtAmt(sug.amount, sug.unit)}`) : null),
      h('button', { type: 'button', class: 'btn btn-primary panel-btn', dataset: { act: 'init' }, onclick: () => stockInitSheet(plant, b, done) }, icon('plus'), T.init)));
  }
  if (!out.length) out.push(h('div', { class: 'empty-state', id: 'stock-empty' }, T.empty));
  return h('div', { id: 'stock-panel' }, out);
}

/** Does the plant get a Zásoba tab? Harvestable plants once a batch is past the "pending" state, and anything with stock. */
export const hasStockTab = (plant) => plant.harvestable
  && (plant.cache.batches || []).some((b) => !b.legacy && (b.stock || b.phase !== 'pending'));

// ---------- overview across plants ----------

export async function renderStockOverview(root) {
  const alive = guard();
  const { plants } = await loadAll();
  const nowIso = now();
  const rows = plants.map((p) => ({ p, ps: plantStock(p, nowIso, env()) }))
    .filter(({ ps }) => ps && ps.remaining > 0)
    .sort((a, b) => (a.ps.runOutDays ?? 1e9) - (b.ps.runOutDays ?? 1e9));
  const cmp = methodComparison(plants);
  if (!alive()) return;
  put(clear(root),
    h('div', { class: 'top-bar' },
      h('button', { type: 'button', class: 'btn btn-ghost', id: 'btn-back', 'aria-label': S.ui.back, onclick: () => navigate('/') }, icon('back')),
      h('h2', { class: 'page-title' }, T.overview)),
    h('p', { class: 'muted pad' }, T.overviewIntro),
    rows.length ? h('div', { class: 'card task-list', id: 'stock-overview' }, rows.map(({ p, ps }) => {
      const worst = ps.batches.flatMap((b) => b.containers).filter((c) => c.state).sort((a, b) => a.state.q - b.state.q)[0];
      return h('div', { class: 'item-row', role: 'button', tabindex: 0, dataset: { plant: p.id }, onclick: () => { tabRequest.id = p.id; tabRequest.tab = 'stock'; navigate(`/plant/${p.id}`); } },
        h('span', { class: `badge-dot ${worst && worst.state.pct < 40 ? 'expired' : worst && worst.state.pct < 70 ? 'missing' : 'ok'}` }),
        h('div', { class: 'item-info' },
          h('div', { class: 'item-name' }, `${p.name} · ${fmtAmt(ps.remaining, ps.unit)}`),
          h('div', { class: 'item-detail' }, h('span', { class: 'item-sub' },
            [ps.runOutDays != null ? T.runOut(Math.max(1, Math.round(ps.runOutDays)), fmtDate(ps.runOutAt)) : T.noRate,
              worst ? `${T.fresh} ${worst.state.pct} %` : null].filter(Boolean).join(' · ')))));
    })) : h('div', { class: 'empty-state', id: 'stock-none' }, T.none),
    h('div', { class: 'section-title' }, T.comparison),
    h('p', { class: 'muted pad' }, T.comparisonHint),
    cmp.length ? h('div', { class: 'card pad', id: 'stock-comparison' }, cmp.map((c) => h('div', { class: 'eval-line', dataset: { method: c.method } },
      h('span', {}, methodLabel(c.method)),
      h('span', { class: 'muted' }, [T.comparisonRow(c.n, num(c.avg, 1), c.avgAge), c.lateN ? T.lateAvg(c.lateN, num(c.lateAvg, 1)) : null].filter(Boolean).join(' · ')))))
      : h('div', { class: 'empty-state' }, T.comparisonNone),
    h('div', { class: 'pad' }, h('button', { type: 'button', class: 'btn btn-secondary panel-btn', id: 'btn-stock-settings', onclick: () => navigate('/settings/stock') }, icon('settings'), T.settingsTitle)));
}
