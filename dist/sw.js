// Patch 20260628-patch4：修復 GitHub Pages 長期用舊版（SW 自己都被 cache 住）
// 重點：sw.js / index.html 一律 network-first（更新優先），其他資源先 cache-first。
const CACHE_NAME = 'cangjie-v24-speaker-github-fix';
const ASSETS = [
  './',
  './index.html',
  './sw.js'
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
  const url = new URL(e.request.url);
  const path = url.pathname;

  // 1) SW 自己：必須永遠走網絡，否則永遠更新唔到
  if (path.endsWith('/sw.js') || path.endsWith('sw.js')) {
    e.respondWith(fetch(new Request(e.request, { cache: 'no-store' })));
    return;
  }

  // 2) HTML（包括導航）：更新優先，失敗先用 cache
  const accept = e.request.headers.get('accept') || '';
  const isHtml = e.request.mode === 'navigate' || accept.includes('text/html');
  if (isHtml) {
    e.respondWith((async () => {
      try {
        const res = await fetch(new Request(e.request, { cache: 'no-store' }));
        if (res && res.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(e.request, res.clone());
        }
        return res;
      } catch (err) {
        const cached = await caches.match(e.request);
        return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // 3) 其他靜態：cache-first
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
