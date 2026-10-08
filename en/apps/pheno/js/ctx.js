// Shared app context and small services.
import { buildDryingPriors } from './calendar.js';
import { applyCategories } from './categories.js';
import { cleanRules, resolveRules } from './config-rules.js';
import { cleanCriteria } from './criteria.js';
import { cleanTemplates } from './customtasks.js';
import { cleanGroups } from './groups.js';
import { buildStockPriors } from './stock.js';
import { cleanStock } from './stockcfg.js';
import { getProfile } from './profile.js';
import { getAllEvents, listPlants, metaGet, metaSet } from './storage.js';

export const ctx = { db: null, categories: {}, hemisphere: 'north', profile: null, overrides: {}, rules: resolveRules(), criteria: {}, groups: [], taskTemplates: [], stockCfg: cleanStock(null), priors: { category: {}, variety: {}, stock: { method: {}, variety: {} } } };
export const now = () => new Date().toISOString();

export async function initCtx(db) {
  ctx.db = db;
  ctx.categories = applyCategories(await metaGet(db, 'categories'));   // first: rules, criteria, stock and templates are validated against it
  ctx.hemisphere = (await metaGet(db, 'hemisphere')) === 'south' ? 'south' : 'north';
  ctx.profile = await getProfile(db);
  ctx.overrides = cleanRules(await metaGet(db, 'rules'));
  ctx.rules = resolveRules(ctx.overrides);
  ctx.criteria = cleanCriteria(await metaGet(db, 'criteria'));
  ctx.stockCfg = cleanStock(await metaGet(db, 'stock'));
  ctx.groups = cleanGroups(await metaGet(db, 'groups'));
  ctx.taskTemplates = cleanTemplates(await metaGet(db, 'taskTemplates'));
  return ctx;
}
/** Re-read the group list after it changed (groups page, import). */
export async function refreshGroups() { ctx.groups = cleanGroups(await metaGet(ctx.db, 'groups')); return ctx.groups; }
/** Re-register the custom categories after they changed (categories page, import). */
export async function refreshCategories() {
  ctx.categories = applyCategories(await metaGet(ctx.db, 'categories'));
  ctx.rules = resolveRules(ctx.overrides);
  return ctx.categories;
}
/** Re-read the custom task templates after they changed (templates page, import). */
export async function refreshTemplates() { ctx.taskTemplates = cleanTemplates(await metaGet(ctx.db, 'taskTemplates')); return ctx.taskTemplates; }
export const hemisphereKnown = () => metaGet(ctx.db, 'hemisphere').then((v) => v === 'north' || v === 'south');
export async function setHemisphere(v) { ctx.hemisphere = v; await metaSet(ctx.db, 'hemisphere', v); }

/** All plants plus their events grouped by plant id. */
export async function loadAll() {
  const [plants, events] = await Promise.all([listPlants(ctx.db), getAllEvents(ctx.db)]);
  const byPlant = new Map();
  for (const e of events) {
    if (!byPlant.has(e.plantId)) byPlant.set(e.plantId, []);
    byPlant.get(e.plantId).push(e);
  }
  ctx.priors = buildPriors(plants);
  return { plants, byPlant, events };
}

/** Recompute cross-plant drying priors from the stored caches (cheap: no events read). */
export async function refreshPriors() {
  ctx.priors = buildPriors(await listPlants(ctx.db));
  return ctx.priors;
}

const buildPriors = (plants) => ({ ...buildDryingPriors(plants), stock: buildStockPriors(plants, ctx.stockCfg) });

export const engineOpts = () => ({ hemisphere: ctx.hemisphere, rules: ctx.rules, priors: ctx.priors, criteria: ctx.criteria, stockCfg: ctx.stockCfg, taskTemplates: ctx.taskTemplates });

const THEME_KEY = 'pheno.theme';
export function getTheme() {
  try { return localStorage.getItem(THEME_KEY) === 'svetle' ? 'svetle' : 'tmave'; } catch { return 'tmave'; }
}
export function setTheme(name) {
  document.documentElement.dataset.theme = name;
  try { localStorage.setItem(THEME_KEY, name); } catch { /* private mode: theme just is not remembered */ }
}
