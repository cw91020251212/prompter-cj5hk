const CACHE_NAME = 'cangjie-v2';
const ASSETS = [
  './',
  './index.html',
  './src/jyutping_logic.js',
  './src/jyutping_dict.json',
  './assets/icons/favicon.ico'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
