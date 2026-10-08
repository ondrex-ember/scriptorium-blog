// User-editable rules (RCv0.191). Every number the engine uses for intervals lives here with its default and limits.
// Overrides are stored flat in meta.rules as { key: value }; invalid entries are ignored, never trusted.
import { CATEGORIES, ENVIRONMENTS } from './config-categories.js';

const num = (key, group, def, min, max, unit, step = 1) => ({ key, group, kind: 'num', def, min, max, unit, step });
const bool = (key, group, def) => ({ key, group, kind: 'bool', def });
const choice = (key, group, def, options) => ({ key, group, kind: 'choice', def, options });

export const AFTER_FINAL_HARVEST = ['ask', 'auto', 'manual'];
export const SUBSTRATES = ['soil', 'coco', 'hydro'];
export const SEASON_NAMES = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_DEFAULTS = { spring: 1.0, summer: 0.85, autumn: 1.0, winter: 1.3 };
const SEASON_ON = { outdoor: true, greenhouse: true, indoor: false, controlled: false };

const categoryDefs = Object.entries(CATEGORIES).flatMap(([c, cfg]) => [
  num(`cat.${c}.soilDays`, 'category', cfg.baseDryingDays, 0.5, 60, 'dní', 0.5),
  num(`cat.${c}.fertilizingDays`, 'category', cfg.fertilizingDays, 1, 180, 'dní'),
  num(`cat.${c}.pestCheckDays`, 'category', cfg.pestCheckDays, 1, 90, 'dní')
]);

export const RULE_DEFS = [
  ...categoryDefs,
  num('fertilizing.firstFeedDays', 'fertilizing', 14, 0, 90, 'dní'),
  num('fertilizing.fruitingFactor', 'fertilizing', 0.8, 0.3, 1.5, '×', 0.05),
  num('fertilizing.stopBeforeHarvestDays', 'fertilizing', 0, 0, 60, 'dní'),
  num('batch.drying.minDays', 'batch', 1, 1, 14, 'dní'),
  num('batch.drying.maxDays', 'batch', 7, 1, 30, 'dní'),
  num('batch.drying.fraction', 'batch', 0.3, 0.1, 0.6, 'zbývající doby', 0.05),
  num('batch.drying.nearDays', 'batch', 1, 1, 7, 'dní'),
  num('batch.curing.firstWeekDays', 'batch', 1, 1, 14, 'dní'),
  num('batch.curing.monthDays', 'batch', 3, 1, 30, 'dní'),
  num('batch.curing.laterDays', 'batch', 7, 1, 60, 'dní'),
  num('batch.fermenting.days', 'batch', 2, 1, 30, 'dní'),
  num('batch.storing.freshDays', 'batch', 7, 1, 90, 'dní'),
  num('batch.storing.driedDays', 'batch', 30, 1, 365, 'dní'),
  num('batch.pickling.days', 'batch', 30, 1, 365, 'dní'),
  num('useBy.vegetable', 'batch', 10, 1, 365, 'dní od sklizně'),
  num('useBy.fruit', 'batch', 14, 1, 365, 'dní od sklizně'),
  num('useBy.tree_shrub', 'batch', 60, 1, 365, 'dní od sklizně'),
  num('eval.remind1Days', 'eval', 30, 0, 730, 'dní od „k použití“'),
  num('eval.remind2Days', 'eval', 90, 0, 730, 'dní od „k použití“'),
  num('eval.remind3Days', 'eval', 365, 0, 1460, 'dní od „k použití“'),
  num('eval.freshRemind1Days', 'eval', 0, 0, 365, 'dní (čerstvé plody)'),
  num('eval.freshRemind2Days', 'eval', 14, 0, 365, 'dní (čerstvé plody)'),
  num('eval.reviewDays', 'eval', 90, 7, 730, 'dní po prvním hodnocení'),
  num('drying.refDays', 'drying', 7, 1, 60, 'dní'),
  num('drying.refWeightG', 'drying', 50, 1, 5000, 'g'),
  num('drying.sizeExponent', 'drying', 0.4, 0, 1, '', 0.05),
  num('drying.minFactor', 'drying', 0.5, 0.1, 1, '×', 0.05),
  num('drying.maxFactor', 'drying', 8, 1, 20, '×', 0.5),
  num('drying.refHeightCm', 'drying', 30, 5, 300, 'cm'),
  num('drying.blendOld', 'drying', 0.6, 0.1, 0.95, '', 0.05),
  ...ENVIRONMENTS.map((e) => num(`drying.env.${e}`, 'drying', e === 'outdoor' || e === 'greenhouse' ? 0.9 : 1, 0.5, 2, '×', 0.05)),
  num('pot.refVolumeL', 'pot', 5, 0.1, 500, 'l', 0.5),
  num('pot.volumeExponent', 'pot', 0.5, 0, 1, '', 0.05),
  num('pot.minFactor', 'pot', 0.4, 0.1, 1, '×', 0.05),
  num('pot.maxFactor', 'pot', 3, 1, 10, '×', 0.5),
  ...SUBSTRATES.map((s) => num(`pot.substrate.${s}`, 'pot', { soil: 1, coco: 0.7, hydro: 0.5 }[s], 0.2, 3, '×', 0.05)),
  ...SEASON_NAMES.map((s) => num(`season.${s}`, 'season', SEASON_DEFAULTS[s], 0.3, 3, '×', 0.05)),
  ...ENVIRONMENTS.map((e) => bool(`season.on.${e}`, 'season', SEASON_ON[e])),
  choice('afterFinalHarvest', 'afterHarvest', 'ask', AFTER_FINAL_HARVEST),
  num('dashboard.lookaheadDays', 'dashboard', 3, 0, 14, 'dní'),
  num('stock.lowDays', 'stock', 10, 1, 120, 'dní do vyčerpání'),
  num('stock.rateWindowDays', 'stock', 28, 7, 180, 'dní'),
  num('stock.useByPct', 'stock', 50, 5, 95, '% čerstvosti'),
  num('stock.lowQualityPct', 'stock', 30, 5, 90, '% čerstvosti'),
  num('stock.minRateDays', 'stock', 7, 1, 60, 'dní od prvního odběru')
];

export const RULE_GROUPS = [...new Set(RULE_DEFS.map((d) => d.group))];
const BY_KEY = new Map(RULE_DEFS.map((d) => [d.key, d]));
export const ruleDef = (key) => BY_KEY.get(key);
export const DEFAULT_RULES = Object.fromEntries(RULE_DEFS.map((d) => [d.key, d.def]));

/**
 * Custom categories (R17) get their own category rules and a use-by rule like their base. Called by the category registry
 * after every change; mutates the shared tables in place so every importer sees them.
 */
export function syncCategoryRules(custom) {
  const isCustomKey = (k) => /^(cat|useBy)\.u_/.test(k);
  for (let i = RULE_DEFS.length - 1; i >= 0; i--) if (isCustomKey(RULE_DEFS[i].key)) { BY_KEY.delete(RULE_DEFS[i].key); delete DEFAULT_RULES[RULE_DEFS[i].key]; RULE_DEFS.splice(i, 1); }
  const add = [];
  for (const [c, cfg] of Object.entries(custom)) {
    add.push(num(`cat.${c}.soilDays`, 'category', cfg.baseDryingDays, 0.5, 60, 'dní', 0.5),
      num(`cat.${c}.fertilizingDays`, 'category', cfg.fertilizingDays, 1, 180, 'dní'),
      num(`cat.${c}.pestCheckDays`, 'category', cfg.pestCheckDays, 1, 90, 'dní'));
    const useBy = BY_KEY.get(`useBy.${cfg.base}`);
    if (useBy) add.push(num(`useBy.${c}`, useBy.group, useBy.def, useBy.min, useBy.max, useBy.unit));
  }
  const firstOther = RULE_DEFS.findIndex((d) => !d.key.startsWith('cat.'));
  RULE_DEFS.splice(firstOther < 0 ? RULE_DEFS.length : firstOther, 0, ...add.filter((d) => d.key.startsWith('cat.')));
  RULE_DEFS.push(...add.filter((d) => !d.key.startsWith('cat.')));
  for (const d of add) { BY_KEY.set(d.key, d); DEFAULT_RULES[d.key] = d.def; }
}

/** True when `value` is acceptable for the rule `key`. */
export function validRule(key, value) {
  const d = BY_KEY.get(key);
  if (!d) return false;
  if (d.kind === 'num') return typeof value === 'number' && Number.isFinite(value) && value >= d.min && value <= d.max;
  if (d.kind === 'bool') return typeof value === 'boolean';
  return d.options.includes(value);
}

/** Keep only valid, non-default overrides (what gets stored and exported). */
export function cleanRules(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) if (validRule(k, v) && v !== DEFAULT_RULES[k]) out[k] = v;
  return out;
}

/** Full rule map: defaults with valid overrides applied. */
export const resolveRules = (overrides) => ({ ...DEFAULT_RULES, ...cleanRules(overrides) });

/** Value of one rule from a resolved map (or defaults when rules are absent). */
export const rv = (rules, key) => rules?.[key] ?? DEFAULT_RULES[key];
