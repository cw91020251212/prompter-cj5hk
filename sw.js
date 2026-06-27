const CACHE_NAME = 'cangjie-v20';
const ASSETS = [
  './',
  './index.html',
  './src/hk-homophones.js',
  './src/jyutping_dict.json',
  './src/char_freq_rank.json',
  './src/char_related_words.json',
  './assets/icons/favicon.ico'
];

self.addEventListener('install', (e) => {
  // 讓新版 SW 盡快接管，避免長期用緊舊 cache
  self.skipWaiting();
  // 部署環境可能冇 icons 檔；逐個盡力快取，避免 SW 安裝失敗而用緊舊版
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        ASSETS.map(async (url) => {
          try {
            const req = new Request(url, { cache: 'reload' });
            const res = await fetch(req);
            if (res && res.ok) await cache.put(req, res.clone());
          } catch (err) {}
        })
      );
    })
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
