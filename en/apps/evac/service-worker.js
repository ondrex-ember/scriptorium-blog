/**
 * service-worker.js
 * 1) Precachuje app shell, aby appka spolehlivě naběhla i offline (po prvním
 *    načtení) - to je to, co ze statické stránky dělá "opravdovou" PWA.
 * 2) Best-effort kontrola na pozadí (Periodic Background Sync) - pošle
 *    lokální notifikaci, pokud něco expirovalo/potřebuje kontrolu.
 *    POZOR: Periodic Background Sync podporuje jen Chrome/Edge (desktop
 *    i Android) u appky nainstalované na plochu, a i tak o frekvenci
 *    a spolehlivosti rozhoduje prohlížeč podle "engagement" heuristiky.
 *    Safari/iOS tuto API vůbec nemá a bez vlastního push serveru se to
 *    nedá obejít - proto appka spoléhá primárně na kontrolu při každém
 *    otevření (viz notifications-runtime.js), tohle je jen bonus navíc.
 *
 * Vyžaduje http(s) origin (i localhost stačí) - service workery se
 * na file:// vůbec neregistrují.
 */

const CACHE_NAME = "evac-cache-rcv075";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./manifest.json?v=075",
  "./css/style.css",
  "./css/themes.css",
  "./js/i18n.js",
  "./js/theme-icons.js",
  "./js/data-model.js",
  "./js/storage.js",
  "./js/templates.js",
  "./js/notifications.js",
  "./js/feed.js",
  "./js/notifications-runtime.js",
  "./js/app.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-192.png?v=075",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-512.png?v=075",
  "./assets/icons/icon-512-maskable.png",
  "./assets/icons/icon-512-maskable.png?v=075",
  "./assets/icons/apple-touch-icon.png?v=075",
  "./assets/icons/omnia-hand-mark.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for same-origin GET requests, network fallback (and cache the
// fresh response for next time). Anything cross-origin (feed API) always
// goes to the network untouched - the app already has its own cache/fallback
// logic for that in feed.js.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
    })
  );
});

/* ---------------- Best-effort background check ---------------- */

importScripts("js/i18n.js", "js/data-model.js", "js/storage.js", "js/notifications.js");

async function runBackgroundCheck() {
  try {
    const profileId = await Storage.getMeta("active_profile_id");
    if (!profileId) return;
    const profile = await Storage.get("profiles", profileId);
    if (!profile) return;
    I18n.setLocale(profile.locale || "cs");

    const items = await Storage.getAll("items");
    const attention = getTimeSensitiveItems(items, profile);
    if (!attention.length) return;

    const today = todayISO();
    const lastNotifiedDate = await Storage.getMeta("last_notification_date");
    if (lastNotifiedDate === today) return; // at most one notification per day

    await self.registration.showNotification(I18n.t("app.title"), {
      body: I18n.t("notif.summaryBody", { count: attention.length }),
      icon: "assets/icons/icon-192.png",
      badge: "assets/icons/icon-192.png",
      tag: "evac-attention"
    });
    await Storage.setMeta("last_notification_date", today);
  } catch (e) {
    // best-effort - a failed background check should never crash the SW
  }
}

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "evac-daily-check") {
    event.waitUntil(runBackgroundCheck());
  }
});

// Fallback for browsers without Periodic Background Sync: the foreground
// page can ask the SW to run the same check (see notifications-runtime.js).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "RUN_CHECK") {
    event.waitUntil(runBackgroundCheck());
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./index.html");
    })
  );
});
