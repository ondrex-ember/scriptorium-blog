// Photos: resize in the browser, keep as Blob in IndexedDB, show via object URLs.
import { getPhoto, putPhoto } from './storage.js';
import { uid, nowIso } from './utils.js';

const urls = new Map();

export function resizeImage(file, max = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * k), hgt = Math.round(img.height * k);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = hgt;
      canvas.getContext('2d').drawImage(img, 0, 0, w, hgt);
      URL.revokeObjectURL(src);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Fotku se nepodařilo zpracovat'))), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(src); reject(new Error('Soubor není obrázek')); };
    img.src = src;
  });
}

/** Store a photo file for a plant; returns the photo id. */
export async function savePhotoFile(db, plantId, file) {
  const blob = await resizeImage(file);
  const id = uid();
  await putPhoto(db, { id, plantId, blob, createdAt: nowIso() });
  return id;
}

export async function photoUrl(db, id) {
  if (!id) return null;
  if (urls.has(id)) return urls.get(id);
  const rec = await getPhoto(db, id);
  if (!rec) return null;
  const u = URL.createObjectURL(rec.blob);
  urls.set(id, u);
  return u;
}
