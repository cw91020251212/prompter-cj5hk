const CACHE_NAME = 'cangjie-v11';
const ASSETS = [
  './',
  './index.html',
  './src/hk-homophones.js',
  './src/jyutping_dict.json',
  './assets/icons/favicon.ico'
];

self.addEventListener('install', (e) => {
  // 讓新版 SW 盡快接管，避免長期用緊舊 cache
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
