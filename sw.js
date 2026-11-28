/* Service worker: офлайн-кеш приложения и библиотек */
const CACHE = 'ks2-online-update-v1';
const ASSETS = [
  './', './index.html', './favicon.ico', './manifest.json', './icons/maskable-512.png',
  './css/app.css',
  './js/app.js?v=online-update-1', './js/pdf-contract.js?v=wide-units-1', './js/app.js', './js/norm.js?v=unit-compare-1', './js/norm.js', './js/pdf-contract.js', './js/xlsx-act.js?v=multiline-price-1', './js/xlsx-act.js', './js/xlsx-market.js',
  './js/compare-act.js?v=duplicate-tolerance-1', './js/compare-act.js', './js/compare-market.js', './js/report-export.js?v=export-name-1', './js/report-export.js', './js/store.js',
  './vendor/pdf.min.mjs', './vendor/pdf.worker.min.mjs', './vendor/xlsx.mjs', './vendor/cpexcel.full.mjs', './vendor/xlsx.zahl.mjs', './vendor/xlsx-js-style.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.mode === 'navigate') {
    // Always check the current app shell while online. Keep the precached
    // index as the offline fallback, so installed PWA navigation still works.
    e.respondWith((async () => {
      try {
        const response = await fetch(e.request, { cache: 'no-store' });
        if (response.ok && response.type === 'basic' &&
            new URL(response.url).origin === self.location.origin) {
          try {
            const cache = await caches.open(CACHE);
            await cache.put('./index.html', response.clone());
          } catch { /* The online response is still usable. */ }
        }
        return response;
      } catch {
        return await caches.match('./index.html') || Response.error();
      }
    })());
    return;
  }
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }))
  );
});
