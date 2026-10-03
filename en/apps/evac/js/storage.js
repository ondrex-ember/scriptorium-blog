/**
 * storage.js
 * Tenký IndexedDB wrapper. Žádný backend - vše lokálně v prohlížeči.
 * DB: "evac_db", stores: meta, profiles, categories, items, photos
 */

const DB_NAME = "evac_db";
const DB_VERSION = 1;

const Storage = (function () {
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("profiles")) {
          db.createObjectStore("profiles", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("categories")) {
          db.createObjectStore("categories", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("items")) {
          const itemStore = db.createObjectStore("items", { keyPath: "id" });
          itemStore.createIndex("by_category", "category_id", { unique: false });
        }
        if (!db.objectStoreNames.contains("photos")) {
          db.createObjectStore("photos", { keyPath: "id" });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
    return dbPromise;
  }

  async function tx(storeName, mode) {
    const db = await open();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function wrap(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlToBlob(dataUrl) {
    return fetch(dataUrl).then((r) => r.blob());
  }

  return {
    async put(storeName, value) {
      const store = await tx(storeName, "readwrite");
      return wrap(store.put(value));
    },
    async bulkPut(storeName, values) {
      const store = await tx(storeName, "readwrite");
      return Promise.all(values.map((v) => wrap(store.put(v))));
    },
    async get(storeName, key) {
      const store = await tx(storeName, "readonly");
      return wrap(store.get(key));
    },
    async getAll(storeName) {
      const store = await tx(storeName, "readonly");
      return wrap(store.getAll());
    },
    async getAllByIndex(storeName, indexName, value) {
      const store = await tx(storeName, "readonly");
      return wrap(store.index(indexName).getAll(value));
    },
    async delete(storeName, key) {
      const store = await tx(storeName, "readwrite");
      return wrap(store.delete(key));
    },
    async clear(storeName) {
      const store = await tx(storeName, "readwrite");
      return wrap(store.clear());
    },

    // meta convenience
    async getMeta(key, fallback) {
      const row = await this.get("meta", key);
      return row ? row.value : fallback;
    },
    async setMeta(key, value) {
      return this.put("meta", { key, value });
    },

    // photo helpers (store as Blob)
    async savePhoto(id, blob) {
      return this.put("photos", { id, blob, created_at: new Date().toISOString() });
    },
    async getPhotoUrl(id) {
      const row = await this.get("photos", id);
      if (!row) return null;
      return URL.createObjectURL(row.blob);
    },
    async deletePhoto(id) {
      return this.delete("photos", id);
    },

    // full backup / restore (Settings > Data) - a single JSON file the user
    // can keep somewhere safe, since this app has no cloud sync of its own.
    async exportAll() {
      const [meta, profiles, categories, items, photos] = await Promise.all([
        this.getAll("meta"), this.getAll("profiles"), this.getAll("categories"),
        this.getAll("items"), this.getAll("photos")
      ]);
      const photosExport = await Promise.all(photos.map(async (p) => ({
        id: p.id, created_at: p.created_at, dataUrl: await blobToDataUrl(p.blob)
      })));
      return {
        export_format: "evac-zavazadlo-backup",
        export_version: 1,
        exported_at: new Date().toISOString(),
        meta, profiles, categories, items, photos: photosExport
      };
    },

    async importAll(data) {
      if (!data || data.export_format !== "evac-zavazadlo-backup"
        || data.export_version !== 1 || !Array.isArray(data.meta)
        || !Array.isArray(data.profiles) || !Array.isArray(data.categories)
        || !Array.isArray(data.items) || !Array.isArray(data.photos)) {
        throw new Error("invalid_backup");
      }
      const activeId = data.meta.find((m) => m && m.key === "active_profile_id")?.value;
      const activeProfile = data.profiles.find((p) => p && p.id === activeId);
      const unique = (rows, key) => new Set(rows.map((row) => row[key])).size === rows.length;
      const categoryIds = new Set(data.categories.map((c) => c && c.id));
      if (!activeId || !activeProfile || !activeProfile.coefficients
        || typeof activeProfile.created_at !== "string"
        || !Number.isFinite(activeProfile.days)
        || !["adults", "children", "seniors", "pets"].every((key) => Number.isFinite(activeProfile[key]))
        || !["children", "seniors"].every((key) => Number.isFinite(activeProfile.coefficients[key]))
        || !data.meta.some((m) => m && m.key === "onboarding_complete" && m.value === true)
        || data.meta.some((m) => !m || typeof m.key !== "string")
        || data.profiles.some((p) => !p || !p.id)
        || data.categories.some((c) => !c || !c.id || typeof c.name !== "string")
        || data.items.some((i) => !i || !i.id || !categoryIds.has(i.category_id)
          || typeof i.name !== "string" || !Number.isFinite(i.required_quantity)
          || !Number.isFinite(i.current_quantity))
        || data.photos.some((p) => !p || !p.id || typeof p.dataUrl !== "string"
          || !/^data:image\/[a-z0-9.+-]+;base64,/i.test(p.dataUrl))
        || ![[data.meta, "key"], [data.profiles, "id"], [data.categories, "id"],
          [data.items, "id"], [data.photos, "id"]].every(([rows, key]) => unique(rows, key))) {
        throw new Error("invalid_backup");
      }
      // Prepare photo blobs before touching the existing database.
      const restoredPhotos = await Promise.all(data.photos.map(async (p) => ({
        id: p.id, created_at: p.created_at, blob: await dataUrlToBlob(p.dataUrl)
      })));
      const db = await open();
      const storeNames = ["meta", "profiles", "categories", "items", "photos"];
      // One transaction: any failed put aborts the entire restore, including clears.
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(storeNames, "readwrite");
        transaction.oncomplete = resolve;
        transaction.onabort = () => reject(transaction.error || new Error("import_aborted"));
        try {
          for (const name of storeNames) transaction.objectStore(name).clear();
          for (const [name, rows] of [["meta", data.meta], ["profiles", data.profiles],
            ["categories", data.categories], ["items", data.items], ["photos", restoredPhotos]]) {
            for (const row of rows) transaction.objectStore(name).put(row);
          }
        } catch (error) {
          transaction.abort();
          reject(error);
        }
      });
    }
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = Storage;
}
