// ZIP export/import (spec 7.3). Imported content is untrusted: everything is validated and copied through whitelists.
import { CATEGORIES, ENVIRONMENTS, SOURCES } from './config-categories.js';
import { cleanRules } from './config-rules.js';
import { cleanCriteria } from './criteria.js';
import { EVENT_TYPES, rebuildAll } from './events.js';
import { emptyCache, optionalPot } from './model.js';
import { PROFILE_KEYS, PROFILE_SOURCES, UTM_KEYS } from './profile.js';
import { getAllEvents, getPhoto, listPhotoKeys, listPlants, metaGet, metaSet, putPhoto, withTx } from './storage.js';
import { normalizeKey, nowIso } from './utils.js';
import { VERSION } from './version.js';

/** 2 = RCv0.191: batch_step / batch_check / care events and meta.rules. Version-1 archives still import. */
export const SCHEMA_VERSION = 2;
/** Meta keys that travel with a backup; device-specific ones (persistGranted, backup bookkeeping) do not. */
export const PORTABLE_META = ['hemisphere', 'profile', 'profileSource', 'acquisition', 'rules', 'criteria'];
const MAX_TEXT = 20000;

const jszip = (JSZip) => JSZip || globalThis.JSZip || (() => { throw new Error('JSZip není načtený'); })();
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isDate = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const isId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 80 && /^[\w.-]+$/.test(v);

/** Build the backup archive. Photos are read one at a time. Returns a Uint8Array. */
export async function exportBackup(db, { JSZip, now = nowIso() } = {}) {
  const Z = jszip(JSZip);
  const zip = new Z();
  const plants = await listPlants(db);
  const events = await getAllEvents(db);
  const meta = {};
  for (const k of PORTABLE_META) { const v = await metaGet(db, k); if (v !== undefined) meta[k] = v; }
  const photoIds = await listPhotoKeys(db);
  const photos = [];
  for (const id of photoIds) {
    const rec = await getPhoto(db, id);
    if (!rec) continue;
    photos.push({ id: rec.id, plantId: rec.plantId, createdAt: rec.createdAt });
    zip.file(`photos/${rec.id}.jpg`, new Uint8Array(await rec.blob.arrayBuffer()), { binary: true });
  }
  zip.file('manifest.json', JSON.stringify({
    schemaVersion: SCHEMA_VERSION, exportedAt: now, appVersion: VERSION,
    counts: { plants: plants.length, events: events.length, photos: photos.length }
  }, null, 2));
  zip.file('data.json', JSON.stringify({ plants, events, meta, photos }));
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', streamFiles: true });
  await metaSet(db, 'lastExportAt', now);
  await metaSet(db, 'eventsAtExport', events.length);
  return bytes;
}

// ---------- validation (untrusted input) ----------
const txt = (v, max = 200) => String(v ?? '').slice(0, max);

function cleanPlant(p) {
  if (!isObj(p) || !isId(p.id) || typeof p.name !== 'string' || !p.name.trim()) return null;
  if (!CATEGORIES[p.category] || !ENVIRONMENTS.includes(p.environment) || !isDate(p.startDate)) return null;
  const lifecycle = p.lifecycle === 'perennial' ? 'perennial' : 'cycle';
  const learned = isObj(p.learnedBase)
    ? Object.fromEntries(Object.entries(p.learnedBase).filter(([, v]) => Number.isFinite(v) && v > 0)) : null;
  const variety = txt(p.variety).trim();
  return {
    id: p.id, name: txt(p.name).trim(), variety, varietyKey: normalizeKey(variety),
    category: p.category, lifecycle, environment: p.environment,
    harvestable: !!p.harvestable, location: txt(p.location).trim(),
    source: SOURCES.includes(p.source) ? p.source : 'other',
    baseOverride: Number.isFinite(p.baseOverride) && p.baseOverride > 0 ? p.baseOverride : null,
    learnedBase: learned && Object.keys(learned).length ? learned : null,
    startDate: p.startDate, createdAt: isDate(p.createdAt) ? p.createdAt : p.startDate,
    ...(p.reminders === false ? { reminders: false } : {}), ...optionalPot(p),
    archivedAt: null, cache: emptyCache()
  };
}

function cleanEvent(e) {
  if (!isObj(e) || !isId(e.id) || !isId(e.plantId) || !EVENT_TYPES.includes(e.type)) return null;
  if (!isDate(e.occurredAt) || !isDate(e.recordedAt) || !isObj(e.payload)) return null;
  if (JSON.stringify(e.payload).length > MAX_TEXT) return null;
  if (['batch_step', 'batch_check'].includes(e.type) && !isId(e.payload.batchId)) return null;
  return { id: e.id, plantId: e.plantId, type: e.type, occurredAt: e.occurredAt, recordedAt: e.recordedAt, payload: e.payload };
}

/** Read and validate an archive without touching the database. Throws Error with a Czech message. */
export async function readBackup(input, { JSZip } = {}) {
  const Z = jszip(JSZip);
  let zip;
  try { zip = await Z.loadAsync(input); } catch { throw new Error('Soubor není platná záloha (ZIP).'); }
  const mf = zip.file('manifest.json'), df = zip.file('data.json');
  if (!mf || !df) throw new Error('V záloze chybí manifest.json nebo data.json.');
  let manifest, data;
  try { manifest = JSON.parse(await mf.async('string')); data = JSON.parse(await df.async('string')); } catch { throw new Error('Záloha je poškozená (JSON).'); }
  if (!Number.isInteger(manifest?.schemaVersion) || manifest.schemaVersion < 1) throw new Error('Záloha nemá platnou verzi schématu.');
  if (manifest.schemaVersion > SCHEMA_VERSION) throw new Error(`Záloha je z novější verze aplikace (schéma ${manifest.schemaVersion}). Aktualizuj aplikaci.`);
  if (!isObj(data) || !Array.isArray(data.plants) || !Array.isArray(data.events)) throw new Error('Záloha je poškozená (data).');
  const plants = data.plants.map(cleanPlant).filter(Boolean);
  const ids = new Set(plants.map((p) => p.id));
  const events = data.events.map(cleanEvent).filter(Boolean);
  const skipped = (data.plants.length - plants.length) + (data.events.length - events.length);
  const photoList = Array.isArray(data.photos) ? data.photos.filter((p) => isObj(p) && isId(p.id) && isId(p.plantId)) : [];
  const meta = {};
  for (const k of PORTABLE_META) if (isObj(data.meta) && k in data.meta) meta[k] = data.meta[k];
  if (meta.hemisphere && !['north', 'south'].includes(meta.hemisphere)) delete meta.hemisphere;
  if (meta.profile && !PROFILE_KEYS.includes(meta.profile)) { delete meta.profile; delete meta.profileSource; }
  if (meta.profileSource && !PROFILE_SOURCES.includes(meta.profileSource)) delete meta.profileSource;
  if ('rules' in meta) { meta.rules = cleanRules(meta.rules); if (!Object.keys(meta.rules).length) delete meta.rules; }
  if ('criteria' in meta) { meta.criteria = cleanCriteria(meta.criteria); if (!Object.keys(meta.criteria).length) delete meta.criteria; }
  if ('acquisition' in meta) meta.acquisition = cleanAcquisition(meta.acquisition);
  if (meta.acquisition == null) delete meta.acquisition;
  return { zip, manifest, plants, events, photoList, meta, skipped, archivePlantIds: ids };
}

function cleanAcquisition(a) {
  if (!isObj(a)) return null;
  const out = {};
  for (const k of UTM_KEYS) if (typeof a[k] === 'string' && a[k].trim()) out[k] = a[k].replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 100);
  if (typeof a.capturedAt === 'string' && !Number.isNaN(Date.parse(a.capturedAt))) out.capturedAt = a.capturedAt;
  return Object.keys(out).length ? out : null;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Merge an archive into the database. Returns a report. */
export async function importBackup(db, input, { JSZip } = {}) {
  const parsed = await readBackup(input, { JSZip });
  const localPlants = new Map((await listPlants(db)).map((p) => [p.id, p]));
  const localEvents = new Map((await getAllEvents(db)).map((e) => [e.id, e]));
  const report = { plantsAdded: 0, plantsExisting: 0, eventsAdded: 0, eventsExisting: 0, photosAdded: 0, skipped: parsed.skipped, conflicts: [] };

  const plantsToPut = [];
  for (const p of parsed.plants) {
    const cur = localPlants.get(p.id);
    if (!cur) { plantsToPut.push(p); localPlants.set(p.id, p); report.plantsAdded += 1; continue; }
    report.plantsExisting += 1;
    const keys = ['name', 'variety', 'category', 'lifecycle', 'harvestable', 'location', 'startDate'];
    if (keys.some((k) => cur[k] !== p[k])) report.conflicts.push({ kind: 'plant', id: p.id, name: cur.name });
  }
  const eventsToPut = [];
  for (const e of parsed.events) {
    if (!localPlants.has(e.plantId)) { report.skipped += 1; continue; }   // orphan
    const cur = localEvents.get(e.id);
    if (!cur) { eventsToPut.push(e); localEvents.set(e.id, e); report.eventsAdded += 1; continue; }
    report.eventsExisting += 1;
    if (cur.plantId !== e.plantId || cur.type !== e.type || cur.occurredAt !== e.occurredAt || !same(cur.payload, e.payload)) {
      report.conflicts.push({ kind: 'event', id: e.id, type: e.type });
    }
  }

  // Photos first: an orphaned photo is harmless, a missing one is not.
  const have = new Set(await listPhotoKeys(db));
  for (const ph of parsed.photoList) {
    if (have.has(ph.id) || !localPlants.has(ph.plantId)) continue;
    const f = parsed.zip.file(`photos/${ph.id}.jpg`);
    if (!f) continue;
    const bytes = await f.async('uint8array');
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) { report.skipped += 1; continue; }   // not a JPEG
    await putPhoto(db, { id: ph.id, plantId: ph.plantId, blob: new Blob([bytes], { type: 'image/jpeg' }), createdAt: isDate(ph.createdAt) ? ph.createdAt : nowIso() });
    report.photosAdded += 1;
  }

  await withTx(db, ['plants', 'events', 'meta'], 'readwrite', async (s) => {
    for (const p of plantsToPut) s.plants.put(p);
    for (const e of eventsToPut) s.events.put(e);
    for (const [k, v] of Object.entries(parsed.meta)) {
      const exists = await new Promise((res, rej) => { const r = s.meta.get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      if (!exists) s.meta.put({ key: k, value: v });
    }
    return null;
  });
  await metaSet(db, 'schemaVersion', SCHEMA_VERSION);
  await rebuildAll(db);
  return report;
}

/** Backup reminder (spec 7.2): 30 days since the last export and at least 10 new events. Dismissal hides it for 7 days. */
export async function backupReminderDue(db, now = nowIso()) {
  const [last, atExport, dismissed] = await Promise.all([metaGet(db, 'lastExportAt'), metaGet(db, 'eventsAtExport'), metaGet(db, 'backupDismissedAt')]);
  const events = await getAllEvents(db);
  if (!events.length) return false;
  const since = last ?? events.reduce((m, e) => (e.recordedAt < m ? e.recordedAt : m), events[0].recordedAt);
  const days = (Date.parse(now) - Date.parse(since)) / 864e5;
  const fresh = events.length - (atExport ?? 0);
  if (days < 30 || fresh < 10) return false;
  if (dismissed && (Date.parse(now) - Date.parse(dismissed)) / 864e5 < 7) return false;
  return true;
}
export const dismissBackupReminder = (db, now = nowIso()) => metaSet(db, 'backupDismissedAt', now);
