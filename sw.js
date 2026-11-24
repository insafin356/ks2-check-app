/* Service worker: офлайн-кеш приложения и библиотек */
const CACHE = 'ks2-wide-contract-v1';
const ASSETS = [
  './', './index.html', './favicon.ico', './manifest.json', './icons/maskable-512.png',
  './css/app.css',
  './js/app.js?v=match-all-5', './js/pdf-contract.js?v=wide-contract-1', './js/app.js', './js/norm.js?v=unit-compare-1', './js/norm.js', './js/pdf-contract.js', './js/xlsx-act.js?v=act-rows-2', './js/xlsx-act.js', './js/xlsx-market.js',
  './js/compare-act.js?v=match-all-4', './js/compare-act.js', './js/compare-market.js', './js/report-export.js?v=duplicate-match-3', './js/report-export.js', './js/store.js',
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
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }))
  );
});
