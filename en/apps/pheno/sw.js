// App-shell cache. User data lives in IndexedDB and is never cached here.
// CACHE must match VERSION in js/version.js (tools/lint.js checks it), so a new release replaces the old shell.
const CACHE = 'pheno-shell-RCv0.191';
const SHELL = [
  './index.html',
  './manifest.json',
  './css/ember-components.css',
  './css/ember-tokens.css',
  './css/pheno.css',
  './fonts/roboto-latin-400-normal.woff2',
  './fonts/roboto-latin-500-normal.woff2',
  './fonts/roboto-latin-700-normal.woff2',
  './fonts/roboto-latin-ext-400-normal.woff2',
  './fonts/roboto-latin-ext-500-normal.woff2',
  './fonts/roboto-latin-ext-700-normal.woff2',
  './js/calendar.js',
  './js/config-categories.js',
  './js/config-engine.js',
  './js/config-rules.js',
  './js/ctx.js',
  './js/dom.js',
  './js/events.js',
  './js/format.js',
  './js/icons.js',
  './js/main.js',
  './js/model.js',
  './js/photos.js',
  './js/router.js',
  './js/sheet.js',
  './js/stats.js',
  './js/storage.js',
  './js/strings.cs.js',
  './js/timeline.js',
  './js/ui-dashboard.js',
  './js/ui-forms.js',
  './js/ui-plant-form.js',
  './js/ui-plant.js',
  './js/ui-rules.js',
  './js/ui-criteria.js',
  './js/criteria.js',
  './js/ui-settings.js',
  './js/backup.js',
  './js/pwa.js',
  './js/profile.js',
  './js/ui-onboarding.js',
  './js/ui-walk.js',
  './js/ui-install.js',
  './js/ui-stats.js',
  './js/utils.js',
  './js/version.js',
  './js/vendor/jszip.min.js',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/pheno-mark.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png'
];

// Hosts with cleanUrls redirect index.html -> directory; a redirected response must not be served to a navigation,
// so every shell file is stored as a clean copy.
async function precache() {
  const cache = await caches.open(CACHE);
  await Promise.all(SHELL.map(async (u) => {
    const res = await fetch(new Request(u, { cache: 'reload' }));
    if (!res.ok) throw new Error('precache failed: ' + u);
    const clean = res.redirected ? new Response(await res.blob(), { status: 200, headers: res.headers }) : res;
    await cache.put(u, clean);
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pheno-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const key = req.mode === 'navigate' ? './index.html' : req;
  event.respondWith(
    caches.match(key, { ignoreSearch: true }).then((hit) => hit
      || fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
