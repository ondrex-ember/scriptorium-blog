// Custom categories by cloning (RCv0.193, R17). meta.categories = { u_abc: { label, icon, base, overrides, deleted? } }.
// A custom category inherits everything from one built-in category and overrides a few fields. The registry mutates the
// shared CATEGORIES / CYCLE_STAGES / FRESH_CATEGORIES / S.category tables in place, because those are imported
// statically all over the pure modules; applyCategories() therefore runs before anything else reads them (initCtx, import).
// Deleting is soft when plants still use the category (they keep the key and keep working); stages and harvest fields
// come from the fixed vocabulary, there are no free-form fields in v1.
import { CATEGORIES, CATEGORY_ICON, CATEGORY_ICON_CHOICES, CYCLE_STAGES, FRESH_CATEGORIES } from './config-categories.js';
import { syncCategoryRules } from './config-rules.js';
import { S } from './strings.cs.js';

export const MAX_CUSTOM_CATEGORIES = 12;
const ID_RE = /^u_[a-z0-9]{3,20}$/;
/** Stage vocabulary of a custom cycle category, in canonical order. 'done' is always the last stage. */
export const STAGE_VOCAB = ['seedling', 'planted', 'growing', 'vegetative', 'budding', 'flowering', 'fruiting', 'harvested', 'done'];
export const HARVEST_FIELD_VOCAB = ['freshWeight', 'processedWeight', 'totalWeight', 'pieceCount', 'avgSize', 'brix', 'bloomCount', 'bloomDurationDays', 'quantity'];
export const CATEGORY_LIMITS = { fertilizingDays: [1, 180], pestCheckDays: [1, 90], baseDryingDays: [0.5, 60] };

const BUILTIN = new Set(Object.keys(CATEGORIES));
const BUILTIN_FRESH = [...FRESH_CATEGORIES];

export const isCategoryId = (v) => typeof v === 'string' && ID_RE.test(v);
export const newCategoryId = () => `u_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
export const isBuiltinCategory = (key) => BUILTIN.has(key);
export const builtinKeys = () => [...BUILTIN];
const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max);

function cleanOverrides(o, base) {
  const out = {};
  if (!o || typeof o !== 'object') return out;
  const b = CATEGORIES[base];
  if (o.lifecycle === 'cycle' || o.lifecycle === 'perennial') { if (o.lifecycle !== b.lifecycle) out.lifecycle = o.lifecycle; }
  if (typeof o.harvestable === 'boolean' && o.harvestable !== b.harvestable) out.harvestable = o.harvestable;
  if (Array.isArray(o.stages)) {
    const picked = STAGE_VOCAB.filter((k) => k !== 'done' && o.stages.includes(k));
    const stages = [...picked, 'done'];
    if (picked.length >= 1 && JSON.stringify(stages) !== JSON.stringify(CYCLE_STAGES[base])) out.stages = stages;
  }
  if (Array.isArray(o.harvestFields)) {
    const keys = HARVEST_FIELD_VOCAB.filter((k) => o.harvestFields.includes(k));
    if (keys.length && JSON.stringify(keys) !== JSON.stringify(b.harvestFields.map((f) => f.key))) out.harvestFields = keys;
  }
  for (const [k, [lo, hi]] of Object.entries(CATEGORY_LIMITS)) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi && v !== b[k]) out[k] = v;
  }
  return out;
}

/** Whitelist stored or imported categories. Unknown base, bad id or empty label → dropped. */
export function cleanCategories(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, c] of Object.entries(raw)) {
    if (Object.keys(out).length >= MAX_CUSTOM_CATEGORIES) break;
    if (!isCategoryId(id) || !c || typeof c !== 'object' || !BUILTIN.has(c.base)) continue;
    const label = text(c.label, 40);
    if (!label) continue;
    out[id] = {
      label, icon: CATEGORY_ICON_CHOICES.includes(c.icon) ? c.icon : CATEGORY_ICON[c.base] ?? 'leaf', base: c.base,
      overrides: cleanOverrides(c.overrides, c.base), ...(c.deleted === true ? { deleted: true } : {})
    };
  }
  return out;
}

/** Union by id; the local copy wins. */
export const mergeCategories = (local, incoming) => cleanCategories({ ...incoming, ...local });

/** Full configs of the custom categories: {id: config with custom, base, label, icon, stages}. */
export function resolveCategories(raw) {
  const out = {};
  for (const [id, c] of Object.entries(cleanCategories(raw))) {
    const b = CATEGORIES[c.base], o = c.overrides;
    out[id] = {
      ...b, ...(o.lifecycle ? { lifecycle: o.lifecycle } : {}), ...(o.harvestable != null ? { harvestable: o.harvestable } : {}),
      ...(o.fertilizingDays ? { fertilizingDays: o.fertilizingDays } : {}), ...(o.pestCheckDays ? { pestCheckDays: o.pestCheckDays } : {}),
      ...(o.baseDryingDays ? { baseDryingDays: o.baseDryingDays } : {}),
      harvestFields: (o.harvestFields ? o.harvestFields.map((key) => ({ key, type: 'number', min: 0 })) : b.harvestFields.map((f) => ({ ...f }))),
      criteria: [...b.criteria], custom: true, base: c.base, label: c.label, icon: c.icon, deleted: !!c.deleted,
      stages: o.stages ? [...o.stages] : [...CYCLE_STAGES[c.base]]
    };
  }
  return out;
}

let current = {};
/** The custom categories currently registered (cleaned). */
export const currentCategories = () => current;

/**
 * Register custom categories in the shared tables; returns the cleaned map. Built-ins are never touched.
 * Call with null to remove all custom categories.
 */
export function applyCategories(raw) {
  const resolved = resolveCategories(raw);
  for (const k of Object.keys(CATEGORIES)) if (!BUILTIN.has(k)) delete CATEGORIES[k];
  for (const k of Object.keys(CYCLE_STAGES)) if (!BUILTIN.has(k)) delete CYCLE_STAGES[k];
  for (const k of Object.keys(CATEGORY_ICON)) if (!BUILTIN.has(k)) delete CATEGORY_ICON[k];
  for (const k of Object.keys(S.category)) if (!BUILTIN.has(k)) delete S.category[k];
  FRESH_CATEGORIES.length = 0; FRESH_CATEGORIES.push(...BUILTIN_FRESH);
  for (const [id, cfg] of Object.entries(resolved)) {
    CATEGORIES[id] = cfg; CYCLE_STAGES[id] = cfg.stages; CATEGORY_ICON[id] = cfg.icon; S.category[id] = cfg.label;
    if (BUILTIN_FRESH.includes(cfg.base)) FRESH_CATEGORIES.push(id);
  }
  syncCategoryRules(resolved);
  current = cleanCategories(raw);
  return current;
}

/** Run `fn` with extra categories registered, then restore the previous registry (validating untrusted input). */
export function withCategories(extra, fn) {
  const before = current;
  applyCategories(mergeCategories(before, cleanCategories(extra)));
  try { return fn(); } finally { applyCategories(before); }
}

/** Category keys offered when creating a plant: built-ins and live custom ones; `keep` is always included (editing). */
export const categoryChoices = (keep) => Object.keys(CATEGORIES).filter((k) => !CATEGORIES[k].deleted || k === keep);

/** Label of the base category, for the settings list. */
export const baseLabel = (id) => S.category[current[id]?.base] ?? '';
