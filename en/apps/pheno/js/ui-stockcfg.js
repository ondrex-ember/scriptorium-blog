// Nastavení → Skladování: storage methods, stock presets and per-category default preset.
import { CATEGORIES } from './config-categories.js';
import { ctx, refreshPriors } from './ctx.js';
import { chipGroup, clear, field, h, icon, put } from './dom.js';
import { num } from './format.js';
import { guard, navigate } from './router.js';
import { closeSheet, openSheet, toast } from './sheet.js';
import { metaSet } from './storage.js';
import { BUILTIN_METHODS, BUILTIN_PRESETS, METHOD_PARAMS, cleanStock, newKey, resolveMethods, resolvePresets } from './stockcfg.js';
import { S } from './strings.cs.js';

const T = S.stock;
const clone = (o) => JSON.parse(JSON.stringify(o));

/** Persist a new stock configuration (validated), refresh the live copy and the learned priors. */
async function save(next) {
  const clean = cleanStock(next);
  await metaSet(ctx.db, 'stock', clean);
  ctx.stockCfg = clean;
  await refreshPriors();
  return clean;
}

const numInput = (value, def, extra = {}) => h('input', { type: 'number', inputmode: 'decimal', step: 'any', value: value ?? '', placeholder: def != null ? String(def) : '', ...extra });

function methodSheet(key, refresh) {
  const M = resolveMethods(ctx.stockCfg);
  const cur = M[key];
  const builtin = key in BUILTIN_METHODS;
  const label = h('input', { type: 'text', maxlength: 40, value: cur.label, id: 'method-label' });
  const inputs = Object.fromEntries(METHOD_PARAMS.map((p) => [p.key, numInput(cur[p.key], builtin ? BUILTIN_METHODS[key][p.key] : null,
    { min: p.min, max: p.max, id: `mp-${p.key}`, step: p.step ?? (p.int ? 1 : 'any') })]));
  const err = h('div', { class: 'form-error', id: 'method-error' });
  const apply = async (reset) => {
    const methods = clone(ctx.stockCfg.methods);
    if (reset) delete methods[key];
    else {
      const o = { label: label.value.trim() };
      if (!o.label) { err.textContent = T.nameNeeded; return; }
      for (const p of METHOD_PARAMS) {
        const raw = inputs[p.key].value;
        if (raw === '') continue;
        const v = Number(raw);
        if (!Number.isFinite(v) || v < p.min || v > p.max || (p.int && !Number.isInteger(v))) { err.textContent = `${T.param[p.key]}: ${T.invalid}`; return; }
        o[p.key] = v;
      }
      methods[key] = o;
    }
    await save({ ...ctx.stockCfg, methods });
    closeSheet(); toast(T.saved2); refresh();
  };
  openSheet(cur.label, h('div', {},
    field(T.name, label),
    METHOD_PARAMS.map((p) => field(T.param[p.key], inputs[p.key])),
    err,
    h('div', { class: 'form-actions' },
      builtin ? h('button', { type: 'button', class: 'btn btn-secondary', id: 'btn-method-reset', onclick: () => apply(true) }, T.reset)
        : h('button', { type: 'button', class: 'btn btn-danger', id: 'btn-method-delete', onclick: () => apply(true) }, T.delete),
      h('button', { type: 'button', class: 'btn btn-primary', id: 'btn-method-save', onclick: () => apply(false) }, S.ui.save))));
}

function newMethodSheet(refresh) {
  const M = resolveMethods(ctx.stockCfg);
  const name = h('input', { type: 'text', maxlength: 40, id: 'new-method-name' });
  const from = chipGroup(Object.values(M).map((m) => [m.key, m.label]), 'jar');
  const err = h('div', { class: 'form-error' });
  openSheet(T.addMethod, h('div', {},
    field(T.name, name), field(T.cloneOf, from.el), err,
    h('div', { class: 'form-actions' },
      h('button', { type: 'button', class: 'btn btn-secondary', onclick: closeSheet }, S.ui.cancel),
      h('button', { type: 'button', class: 'btn btn-primary', id: 'btn-new-method-save', onclick: async () => {
        const label = name.value.trim();
        if (!label) { err.textContent = T.nameNeeded; return; }
        const src = M[from.get()];
        const key = newKey('x', Object.keys(M));
        const o = { label };
        for (const p of METHOD_PARAMS) o[p.key] = src[p.key];
        await save({ ...ctx.stockCfg, methods: { ...clone(ctx.stockCfg.methods), [key]: o } });
        closeSheet(); toast(T.saved2); refresh();
      } }, S.ui.save))));
}

function presetSheet(key, refresh) {
  const P = resolvePresets(ctx.stockCfg);
  const M = resolveMethods(ctx.stockCfg);
  const cur = key ? P[key] : { method: 'jar', maturingDays: null, useByPct: null, checkDays: null, kFactor: 1, label: '' };
  const builtin = key in BUILTIN_PRESETS;
  const label = h('input', { type: 'text', maxlength: 40, value: cur.label, id: 'preset-label' });
  const method = chipGroup(Object.values(M).map((m) => [m.key, m.label]), cur.method);
  method.el.id = 'preset-method';
  const def = builtin ? BUILTIN_PRESETS[key] : {};
  const fields = [['maturingDays', 0, 365], ['useByPct', 5, 95], ['checkDays', 1, 730], ['kFactor', 0.2, 5]];
  const inputs = Object.fromEntries(fields.map(([f, lo, hi]) => [f, numInput(cur[f], def[f] ?? (f === 'kFactor' ? 1 : null), { min: lo, max: hi, id: `pp-${f}` })]));
  const err = h('div', { class: 'form-error', id: 'preset-error' });
  const apply = async (remove) => {
    const presets = clone(ctx.stockCfg.presets);
    const id = key ?? newKey('p', Object.keys(P));
    if (remove) delete presets[id];
    else {
      const o = { label: label.value.trim(), method: method.get() };
      if (!o.label) { err.textContent = T.nameNeeded; return; }
      for (const [f, lo, hi] of fields) {
        if (inputs[f].value === '') continue;
        const v = Number(inputs[f].value);
        if (!Number.isFinite(v) || v < lo || v > hi) { err.textContent = `${T.presetField[f]}: ${T.invalid}`; return; }
        o[f] = v;
      }
      presets[id] = o;
    }
    await save({ ...ctx.stockCfg, presets });
    closeSheet(); toast(T.saved2); refresh();
  };
  openSheet(key ? cur.label : T.addPreset, h('div', {},
    field(T.name, label), field(T.presetField.method, method.el),
    fields.map(([f]) => field(T.presetField[f], inputs[f])), err,
    h('div', { class: 'form-actions' },
      key ? h('button', { type: 'button', class: builtin ? 'btn btn-secondary' : 'btn btn-danger', id: 'btn-preset-reset', onclick: () => apply(true) }, builtin ? T.reset : T.delete)
        : h('button', { type: 'button', class: 'btn btn-secondary', onclick: closeSheet }, S.ui.cancel),
      h('button', { type: 'button', class: 'btn btn-primary', id: 'btn-preset-save', onclick: () => apply(false) }, S.ui.save))));
}

const methodSummary = (m) => [`T½ ${num(m.tHalfProcessed, 0)} / ${num(m.tHalfFresh, 0)} d`, `kontrola ${m.checkDays} d`, m.airEveryDays ? `větrat ${m.airEveryDays} d` : null,
  m.maturingDays ? `zrání ${m.maturingDays} d` : null].filter(Boolean).join(' · ');

export async function renderStockCfg(root) {
  const alive = guard();
  const refresh = () => renderStockCfg(root);
  const M = resolveMethods(ctx.stockCfg);
  const P = resolvePresets(ctx.stockCfg);
  const catRows = Object.entries(CATEGORIES).filter(([, c]) => c.harvestable).map(([cat]) => {
    const chips = chipGroup([['', T.presetDefault], ...Object.values(P).map((p) => [p.key, p.label])], ctx.stockCfg.categoryPreset[cat] ?? '', async (v) => {
      const categoryPreset = { ...ctx.stockCfg.categoryPreset };
      if (v) categoryPreset[cat] = v; else delete categoryPreset[cat];
      await save({ ...ctx.stockCfg, categoryPreset });
      toast(T.saved2);
    });
    chips.el.id = `catpreset-${cat}`;
    return field(S.category[cat], chips.el);
  });
  if (!alive()) return;
  const row = (title, sub, id, onclick) => h('div', { class: 'item-row profile-row', role: 'button', tabindex: 0, id, onclick },
    h('div', { class: 'item-info' }, h('div', { class: 'item-name' }, title), h('div', { class: 'item-detail' }, h('span', { class: 'item-sub' }, sub))));
  put(clear(root),
    h('div', { class: 'top-bar' },
      h('button', { type: 'button', class: 'btn btn-ghost', id: 'btn-back', 'aria-label': S.ui.back, onclick: () => navigate('/settings') }, icon('back')),
      h('h1', {}, T.settingsTitle), h('span')),
    h('p', { class: 'muted rules-intro' }, T.settingsIntro),
    h('section', { class: 'card pad', id: 'cfg-methods' }, h('h3', {}, T.methods),
      Object.values(M).map((m) => row(`${m.label}${m.custom ? ` (${T.custom})` : ''}`, methodSummary(m), `method-${m.key}`, () => methodSheet(m.key, refresh))),
      h('button', { type: 'button', class: 'btn btn-secondary panel-btn', id: 'btn-add-method', onclick: () => newMethodSheet(refresh) }, icon('plus'), T.addMethod)),
    h('section', { class: 'card pad', id: 'cfg-presets' }, h('h3', {}, T.presets),
      Object.values(P).map((p) => row(`${p.label}${p.custom ? ` (${T.custom})` : ''}`,
        [M[p.method]?.label, p.maturingDays != null ? `zrání ${p.maturingDays} d` : null, p.useByPct != null ? `práh ${p.useByPct} %` : null].filter(Boolean).join(' · '),
        `preset-${p.key}`, () => presetSheet(p.key, refresh))),
      h('button', { type: 'button', class: 'btn btn-secondary panel-btn', id: 'btn-add-preset', onclick: () => presetSheet(null, refresh) }, icon('plus'), T.addPreset)),
    h('section', { class: 'card pad', id: 'cfg-categories' }, h('h3', {}, T.categoryDefaults), catRows),
    h('div', { class: 'pad' }, h('button', { type: 'button', class: 'btn btn-secondary panel-btn', id: 'btn-open-stock', onclick: () => navigate('/stock') }, T.openOverview)));
}
