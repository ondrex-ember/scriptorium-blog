// IndexedDB layer. Schema v1: plants, events, photos, meta.
export const DB_NAME = 'pheno';
export const DB_VERSION = 1;

const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export function openDb(name = DB_NAME, factory = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    const r = factory.open(name, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      const plants = db.createObjectStore('plants', { keyPath: 'id' });
      plants.createIndex('archivedAt', 'archivedAt');
      plants.createIndex('varietyKey', 'varietyKey');
      const events = db.createObjectStore('events', { keyPath: 'id' });
      events.createIndex('plantId', 'plantId');
      events.createIndex('plantType', ['plantId', 'type']);
      events.createIndex('occurredAt', 'occurredAt');
      const photos = db.createObjectStore('photos', { keyPath: 'id' });
      photos.createIndex('plantId', 'plantId');
      db.createObjectStore('meta', { keyPath: 'key' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** Run fn(stores) inside one transaction; resolves after commit. Only await IDB requests inside fn. */
export function withTx(db, storeNames, mode, fn) {
  return new Promise((resolve, reject) => {
    const names = [].concat(storeNames);
    const tx = db.transaction(names, mode);
    const stores = {};
    for (const n of names) stores[n] = tx.objectStore(n);
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    Promise.resolve().then(() => fn(stores)).then(
      (r) => { result = r; },
      (e) => { try { tx.abort(); } catch { /* already finished */ } reject(e); }
    );
  });
}

export const idbReq = req;

export const getPlant = (db, id) => withTx(db, 'plants', 'readonly', (s) => req(s.plants.get(id)));
export const listPlants = (db) => withTx(db, 'plants', 'readonly', (s) => req(s.plants.getAll()));
export const putPlant = (db, plant) => withTx(db, 'plants', 'readwrite', (s) => req(s.plants.put(plant)));

export const getEvents = (db, plantId) =>
  withTx(db, 'events', 'readonly', (s) => req(s.events.index('plantId').getAll(plantId)));
export const getAllEvents = (db) => withTx(db, 'events', 'readonly', (s) => req(s.events.getAll()));

export const putPhoto = (db, photo) => withTx(db, 'photos', 'readwrite', (s) => req(s.photos.put(photo)));
export const getPhoto = (db, id) => withTx(db, 'photos', 'readonly', (s) => req(s.photos.get(id)));
export const listPhotos = (db, plantId) =>
  withTx(db, 'photos', 'readonly', (s) => req(s.photos.index('plantId').getAll(plantId)));

export const metaGet = (db, key) =>
  withTx(db, 'meta', 'readonly', async (s) => (await req(s.meta.get(key)))?.value);
export const metaSet = (db, key, value) =>
  withTx(db, 'meta', 'readwrite', (s) => req(s.meta.put({ key, value })));

/** Remove a plant and everything that belongs to it, atomically. */
export function deletePlantData(db, plantId) {
  return withTx(db, ['plants', 'events', 'photos'], 'readwrite', async (s) => {
    const evKeys = await req(s.events.index('plantId').getAllKeys(plantId));
    const phKeys = await req(s.photos.index('plantId').getAllKeys(plantId));
    for (const k of evKeys) s.events.delete(k);
    for (const k of phKeys) s.photos.delete(k);
    s.plants.delete(plantId);
    return { events: evKeys.length, photos: phKeys.length };
  });
}

/** Ask the browser for persistent storage. Never throws. */
export async function ensurePersistence() {
  try {
    const st = globalThis.navigator?.storage;
    if (!st?.persist) return { supported: false, persisted: false };
    if (await st.persisted()) return { supported: true, persisted: true };
    return { supported: true, persisted: await st.persist() };
  } catch {
    return { supported: false, persisted: false };
  }
}

export const listPhotoKeys = (db) => withTx(db, 'photos', 'readonly', (s) => req(s.photos.getAllKeys()));
