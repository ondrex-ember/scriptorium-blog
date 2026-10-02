// PWA glue: service worker, install state, persistent storage.
import { ensurePersistence, metaGet, metaSet } from './storage.js';

let deferredPrompt = null;
const listeners = new Set();

export function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; listeners.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; listeners.forEach((f) => f()); });
  const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && secure) {
    const prod = location.hostname === 'blog.myscriptorium.cz';
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href, { scope: prod ? '/en/apps/pheno' : new URL('./', document.baseURI).pathname, updateViaCache: 'none' }).catch((e) => console.warn('SW registration failed', e));
  }
}

export const onInstallChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
export const canPromptInstall = () => !!deferredPrompt;

export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  listeners.forEach((f) => f());
  return outcome;
}

export function isStandalone() {
  return !!(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone);
}

export function platform() {
  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return { ios, android: /Android/.test(ua) };
}

/** iOS in a browser tab (not installed): storage may be evicted, so warn. */
export const iosBrowserTab = () => platform().ios && !isStandalone();

/** Request persistent storage and remember the result. Never throws. */
export async function requestPersistence(db) {
  const r = await ensurePersistence();
  try { await metaSet(db, 'persistGranted', r.persisted); } catch { /* best effort */ }
  return r;
}

export async function storageEstimate() {
  try {
    const e = await navigator.storage?.estimate?.();
    return e && e.quota ? { usage: e.usage || 0, quota: e.quota } : null;
  } catch { return null; }
}

export const persistGranted = (db) => metaGet(db, 'persistGranted');
