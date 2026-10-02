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
        || !Array.isArray(data.profiles) || !Array.isArray(data.categories) || !Array.isArray(data.items)) {
        throw new Error("invalid_backup");
      }
      await Promise.all(["meta", "profiles", "categories", "items", "photos"].map((s) => this.clear(s)));
      if (data.meta && data.meta.length) await this.bulkPut("meta", data.meta);
      if (data.profiles.length) await this.bulkPut("profiles", data.profiles);
      if (data.categories.length) await this.bulkPut("categories", data.categories);
      if (data.items.length) await this.bulkPut("items", data.items);
      if (data.photos && data.photos.length) {
        const restored = await Promise.all(data.photos.map(async (p) => ({
          id: p.id, created_at: p.created_at, blob: await dataUrlToBlob(p.dataUrl)
        })));
        await this.bulkPut("photos", restored);
      }
    }
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = Storage;
}
