// Profiles (spec 6): defaults and copy only. A profile never hides or unlocks features.
import { metaGet, metaSet } from './storage.js';

export const PROFILE_KEYS = ['garden', 'houseplants', 'controlled', 'mixed'];
export const PROFILE_SOURCES = ['url', 'onboarding', 'settings'];
export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];

export const PROFILES = {
  garden: {
    preselect: { environment: 'outdoor', lifecycle: 'cycle' },
    dashboard: ['tasks', 'season', 'varieties'],
    examples: [['Rajče #1', 'San Marzano'], ['Jahodník', 'Elsanta'], ['Chilli', 'Habanero']]
  },
  houseplants: {
    preselect: { environment: 'indoor', lifecycle: 'perennial', harvestable: false },
    dashboard: ['tasks', 'milestones'],
    examples: [['Monstera', 'Deliciosa'], ['Fíkus', 'Benjamin'], ['Orchidej', 'Phalaenopsis']]
  },
  controlled: {
    preselect: { environment: 'controlled', measurementsFirst: true },
    dashboard: ['tasks', 'measurements', 'cycles'],
    examples: [['Salát', 'Lollo rosso'], ['Bazalka #1', 'Genovese'], ['Jahodník', 'Albion']]
  },
  mixed: { preselect: {}, dashboard: ['tasks'], examples: null }
};
PROFILES.mixed.examples = [...PROFILES.garden.examples, ...PROFILES.houseplants.examples, ...PROFILES.controlled.examples];

export const isProfile = (v) => PROFILE_KEYS.includes(v);

/** Example placeholder [name, variety]; mixed rotates across all profiles by `index`. */
export function example(profile, index = 0) {
  const list = (PROFILES[profile] || PROFILES.mixed).examples;
  return list[Math.abs(index) % list.length];
}

const clean = (v) => String(v).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 100);

/** Parse ?profile=… and utm_* from a query string. Unknown or invalid values are dropped. */
export function parseAcquisition(search) {
  const q = new URLSearchParams(search || '');
  const profile = isProfile(q.get('profile')) ? q.get('profile') : null;
  const utm = {};
  for (const k of UTM_KEYS) { const v = q.get(k); if (v != null && clean(v)) utm[k] = clean(v); }
  return { profile, utm: Object.keys(utm).length ? utm : null };
}

/** Query string without the acquisition parameters (URL cleanup). */
export function stripAcquisition(search) {
  const q = new URLSearchParams(search || '');
  for (const k of ['profile', ...UTM_KEYS]) q.delete(k);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const getProfile = async (db) => { const v = await metaGet(db, 'profile'); return isProfile(v) ? v : null; };

export async function setProfile(db, profile, source) {
  if (!isProfile(profile) || !PROFILE_SOURCES.includes(source)) throw new Error('Neplatný profil.');
  await metaSet(db, 'profile', profile);
  await metaSet(db, 'profileSource', source);
}

/**
 * First-load handling: profile from the URL only when none is stored; UTM stored once.
 * Returns the effective profile (null = onboarding needed).
 */
export async function applyAcquisition(db, search, now = new Date().toISOString()) {
  const { profile, utm } = parseAcquisition(search);
  if (utm && (await metaGet(db, 'acquisition')) == null) await metaSet(db, 'acquisition', { ...utm, capturedAt: now });
  let current = await getProfile(db);
  if (!current && profile) { await setProfile(db, profile, 'url'); current = profile; }
  return current;
}
