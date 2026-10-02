// Shared app context and small services.
import { getProfile } from './profile.js';
import { getAllEvents, listPlants, metaGet, metaSet } from './storage.js';

export const ctx = { db: null, hemisphere: 'north', profile: null };
export const now = () => new Date().toISOString();

export async function initCtx(db) {
  ctx.db = db;
  ctx.hemisphere = (await metaGet(db, 'hemisphere')) === 'south' ? 'south' : 'north';
  ctx.profile = await getProfile(db);
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
  return { plants, byPlant, events };
}

export const engineOpts = () => ({ hemisphere: ctx.hemisphere });

const THEME_KEY = 'pheno.theme';
export function getTheme() {
  try { return localStorage.getItem(THEME_KEY) === 'svetle' ? 'svetle' : 'tmave'; } catch { return 'tmave'; }
}
export function setTheme(name) {
  document.documentElement.dataset.theme = name;
  try { localStorage.setItem(THEME_KEY, name); } catch { /* private mode: theme just is not remembered */ }
}
