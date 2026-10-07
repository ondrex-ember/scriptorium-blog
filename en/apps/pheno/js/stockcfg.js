// Storage catalogue and stock presets (RCv0.192). Method-neutral: nothing here knows what the material is.
// Built-in storage methods and presets carry defaults; the user may override numbers, add own methods/presets and
// assign a preset to a category, a variety or a single plant. Overrides live in meta.stock and are validated on every read.
import { CATEGORIES, FRESH_CATEGORIES } from './config-categories.js';
import { S } from './strings.cs.js';

export const LABEL_MAX = 40;
const clean = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, LABEL_MAX);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Numeric parameters of a storage method. tHalf* are half-lives of quality in days (quality halves after that long). */
export const METHOD_PARAMS = [
  { key: 'tHalfProcessed', min: 1, max: 20000, unit: 'dní' },
  { key: 'tHalfFresh', min: 0.5, max: 3650, unit: 'dní' },
  { key: 'checkDays', min: 1, max: 730, unit: 'dní' },
  { key: 'moldRisk', min: 0, max: 2, unit: '0–2', int: true },
  { key: 'airEveryDays', min: 0, max: 30, unit: 'dní' },
  { key: 'airForDays', min: 0, max: 365, unit: 'dní' },
  { key: 'maturingDays', min: 0, max: 365, unit: 'dní' },
  { key: 'openCost', min: 0, max: 0.2, unit: 'podíl', step: 0.005 }
];
const PARAM = Object.fromEntries(METHOD_PARAMS.map((p) => [p.key, p]));

const m = (tHalfProcessed, tHalfFresh, checkDays, moldRisk, airEveryDays, airForDays, maturingDays, openCost) =>
  ({ tHalfProcessed, tHalfFresh, checkDays, moldRisk, airEveryDays, airForDays, maturingDays, openCost });

/** Rough starting points, not facts: they are meant to be tuned and are learned from the user's own checks. */
export const BUILTIN_METHODS = {
  freezer: m(1000, 120, 90, 0, 0, 0, 0, 0.01),
  vacuum: m(365, 7, 30, 0, 0, 0, 0, 0.03),
  jar: m(180, 5, 14, 1, 2, 14, 14, 0.01),
  fridge: m(240, 14, 30, 1, 0, 0, 0, 0.01),
  soil: m(120, 60, 14, 2, 0, 0, 14, 0.01),
  hanging: m(20, 3, 5, 1, 0, 0, 0, 0),
  open: m(45, 4, 7, 1, 0, 0, 0, 0.02),
  light: m(30, 2, 7, 1, 0, 0, 0, 0.02),
  other: m(90, 7, 14, 1, 0, 0, 0, 0.01)
};
export const METHOD_ORDER = Object.keys(BUILTIN_METHODS);

export const BUILTIN_PRESETS = {
  generic: { method: 'jar', maturingDays: null, useByPct: null, checkDays: null, kFactor: 1 },
  tea: { method: 'jar', maturingDays: 0, useByPct: 40, checkDays: null, kFactor: 1 },
  cure: { method: 'jar', maturingDays: 28, useByPct: 50, checkDays: null, kFactor: 1 },
  fresh: { method: 'fridge', maturingDays: 0, useByPct: 40, checkDays: null, kFactor: 1 }
};
export const PRESET_ORDER = Object.keys(BUILTIN_PRESETS);

const METHOD_KEY = /^x[a-zA-Z0-9]{1,30}$/;
const PRESET_KEY = /^p[a-zA-Z0-9]{1,30}$/;
const VARIETY_KEY = /^[a-z_]+\|.{0,100}$/;

const validParam = (key, v) => {
  const d = PARAM[key];
  return d && isNum(v) && v >= d.min && v <= d.max && (!d.int || Number.isInteger(v));
};

/** Validate stored overrides; anything invalid or equal to its default is dropped. */
export function cleanStock(raw) {
  const out = { methods: {}, presets: {}, categoryPreset: {}, varietyPreset: {} };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;

  for (const [key, v] of Object.entries(raw.methods || {})) {
    const builtin = key in BUILTIN_METHODS;
    if (!builtin && !METHOD_KEY.test(key)) continue;
    if (!v || typeof v !== 'object') continue;
    const o = {};
    const label = clean(v.label);
    if (label) o.label = label;
    if (!builtin && !label) continue;
    for (const p of METHOD_PARAMS) {
      if (v[p.key] == null) continue;
      if (validParam(p.key, v[p.key]) && (!builtin || v[p.key] !== BUILTIN_METHODS[key][p.key])) o[p.key] = v[p.key];
    }
    if (builtin && label && label === S.stock.method[key]) delete o.label;
    if (Object.keys(o).length) out.methods[key] = o;
  }
  const methodKeys = new Set([...METHOD_ORDER, ...Object.keys(out.methods).filter((k) => !(k in BUILTIN_METHODS))]);

  for (const [key, v] of Object.entries(raw.presets || {})) {
    const builtin = key in BUILTIN_PRESETS;
    if (!builtin && !PRESET_KEY.test(key)) continue;
    if (!v || typeof v !== 'object') continue;
    const o = {};
    const label = clean(v.label);
    if (label && !(builtin && label === S.stock.preset[key])) o.label = label;
    if (!builtin && !label) continue;
    if (typeof v.method === 'string' && methodKeys.has(v.method)) o.method = v.method;
    else if (!builtin) continue;
    for (const [f, lo, hi] of [['maturingDays', 0, 365], ['useByPct', 5, 95], ['checkDays', 1, 730], ['kFactor', 0.2, 5]]) {
      if (isNum(v[f]) && v[f] >= lo && v[f] <= hi) o[f] = v[f];
    }
    if (builtin) for (const f of Object.keys(o)) if (o[f] === BUILTIN_PRESETS[key][f]) delete o[f];
    if (Object.keys(o).length) out.presets[key] = o;
  }
  const presetKeys = new Set([...PRESET_ORDER, ...Object.keys(out.presets).filter((k) => !(k in BUILTIN_PRESETS))]);

  for (const [cat, key] of Object.entries(raw.categoryPreset || {})) {
    if (CATEGORIES[cat] && presetKeys.has(key)) out.categoryPreset[cat] = key;
  }
  for (const [vk, key] of Object.entries(raw.varietyPreset || {})) {
    if (VARIETY_KEY.test(vk) && presetKeys.has(key) && Object.keys(out.varietyPreset).length < 500) out.varietyPreset[vk] = key;
  }
  return out;
}

/** Every method with defaults and overrides applied: { key: { key, label, custom, ...params } }. */
export function resolveMethods(cfg) {
  const out = {};
  const ov = cfg?.methods || {};
  for (const k of METHOD_ORDER) out[k] = { key: k, label: ov[k]?.label ?? S.stock.method[k], custom: false, ...BUILTIN_METHODS[k], ...pick(ov[k]) };
  for (const [k, v] of Object.entries(ov)) {
    if (k in BUILTIN_METHODS) continue;
    out[k] = { key: k, label: v.label, custom: true, ...BUILTIN_METHODS.other, ...pick(v) };
  }
  return out;
}
const pick = (o) => Object.fromEntries(METHOD_PARAMS.filter((p) => o && o[p.key] != null).map((p) => [p.key, o[p.key]]));

/** Every preset resolved: { key: { key, label, custom, method, maturingDays|null, useByPct|null, checkDays|null, kFactor } }. */
export function resolvePresets(cfg) {
  const out = {};
  const ov = cfg?.presets || {};
  for (const k of PRESET_ORDER) out[k] = { key: k, label: ov[k]?.label ?? S.stock.preset[k], custom: false, ...BUILTIN_PRESETS[k], ...ov[k] };
  for (const [k, v] of Object.entries(ov)) {
    if (k in BUILTIN_PRESETS) continue;
    out[k] = { key: k, custom: true, maturingDays: null, useByPct: null, checkDays: null, kFactor: 1, ...v };
  }
  return out;
}

export const varietyKey = (plant) => `${plant.category}|${(plant.variety || '').trim().toLowerCase()}`;
const defaultPresetKey = (plant) => (FRESH_CATEGORIES.includes(plant.category) ? 'fresh' : 'generic');

/** Preset that applies to a plant: its own choice, else the variety's, else the category's, else the built-in default. */
export function presetFor(plant, cfg) {
  const presets = resolvePresets(cfg);
  const key = [plant.stockPreset, plant.variety ? cfg?.varietyPreset?.[varietyKey(plant)] : null, cfg?.categoryPreset?.[plant.category], defaultPresetKey(plant)]
    .find((k) => k && presets[k]);
  return presets[key];
}

/** Fresh unique key for an own method or preset. */
export function newKey(prefix, taken) {
  let key;
  do key = prefix + Math.random().toString(36).slice(2, 8); while (taken.includes(key));
  return key;
}
