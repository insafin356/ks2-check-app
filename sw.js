/* Service worker: офлайн-кеш приложения и библиотек */
const CACHE = 'ks2-check-v6';
const ASSETS = [
  './', './index.html', './manifest.json',
  './css/app.css',
  './js/app.js', './js/norm.js', './js/pdf-contract.js', './js/xlsx-act.js', './js/xlsx-market.js',
  './js/compare-act.js', './js/compare-market.js', './js/report-export.js', './js/store.js',
  './vendor/pdf.min.mjs', './vendor/pdf.worker.min.mjs', './vendor/xlsx.mjs', './vendor/cpexcel.full.mjs', './vendor/xlsx.zahl.mjs', './vendor/xlsx-js-style.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }))
  );
});
