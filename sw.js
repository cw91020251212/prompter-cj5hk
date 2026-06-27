const CACHE_NAME = 'cangjie-v16';
const ASSETS = [
  './',
  './index.html',
  './src/hk-homophones.js',
  './src/jyutping_dict.json',
  './src/char_freq_rank.json',
  // 注意：有啲部署環境未必有 icons 檔。
  // 以前用 cache.addAll() 會因為 404 而令 SW 安裝失敗，結果永遠用緊舊畫面。
  // 所以呢度改成「逐個 asset 盡力快取」，即使缺檔都唔會阻止更新。
  './assets/icons/favicon.ico'
];

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled(
    ASSETS.map(async (url) => {
      try {
        const req = new Request(url, { cache: 'reload' });
        const res = await fetch(req);
        if (res && res.ok) {
          await cache.put(req, res.clone());
        }
      } catch (e) {
        // ignore
      }
    })
  );
}

self.addEventListener('install', (e) => {
  // 讓新版 SW 盡快接管，避免長期用緊舊 cache
  self.skipWaiting();
  e.waitUntil(precache());
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
