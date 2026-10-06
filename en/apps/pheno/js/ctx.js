// Shared app context and small services.
import { buildDryingPriors } from './calendar.js';
import { cleanRules, resolveRules } from './config-rules.js';
import { cleanCriteria } from './criteria.js';
import { getProfile } from './profile.js';
import { getAllEvents, listPlants, metaGet, metaSet } from './storage.js';

export const ctx = { db: null, hemisphere: 'north', profile: null, overrides: {}, rules: resolveRules(), criteria: {}, priors: { category: {}, variety: {} } };
export const now = () => new Date().toISOString();

export async function initCtx(db) {
  ctx.db = db;
  ctx.hemisphere = (await metaGet(db, 'hemisphere')) === 'south' ? 'south' : 'north';
  ctx.profile = await getProfile(db);
  ctx.overrides = cleanRules(await metaGet(db, 'rules'));
  ctx.rules = resolveRules(ctx.overrides);
  ctx.criteria = cleanCriteria(await metaGet(db, 'criteria'));
  return ctx;
}
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
  ctx.priors = buildDryingPriors(plants);
  return { plants, byPlant, events };
}

/** Recompute cross-plant drying priors from the stored caches (cheap: no events read). */
export async function refreshPriors() {
  ctx.priors = buildDryingPriors(await listPlants(ctx.db));
  return ctx.priors;
}

export const engineOpts = () => ({ hemisphere: ctx.hemisphere, rules: ctx.rules, priors: ctx.priors, criteria: ctx.criteria });

const THEME_KEY = 'pheno.theme';
export function getTheme() {
  try { return localStorage.getItem(THEME_KEY) === 'svetle' ? 'svetle' : 'tmave'; } catch { return 'tmave'; }
}
export function setTheme(name) {
  document.documentElement.dataset.theme = name;
  try { localStorage.setItem(THEME_KEY, name); } catch { /* private mode: theme just is not remembered */ }
}
