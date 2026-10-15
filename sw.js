'use strict';
/*
  Yahtzee PWA service worker
  - 起動に必要な全ファイルを端末にキャッシュし、オフラインでも全機能が動く
  - 更新: 起動のたびにバックグラウンドで最新版を確認し、新しい版は次の起動から使われる
  - 更新したら VERSION の文字列を必ず変える（変えなくても index.html は自動で再取得されるが、
    アイコンなど他のファイルを入れ替えたときは VERSION を変えること）
*/
const VERSION = '2026-10-15-1';
const PREFIX = 'yahtzee-';
const CACHE = PREFIX + VERSION;

// ここに載せたファイルは、初回アクセス時にまとめて端末へ保存される
const A = (u) => new URL(u, self.location.href).href;
const INDEX = A('./index.html');
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
].map(A);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // cache:'reload' で、ブラウザの古いHTTPキャッシュではなく必ず最新を取りに行く
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(handle(event, req));
});

// キャッシュ優先で即表示し、裏で最新版を確認して保存する（stale-while-revalidate）
async function handle(event, req) {
  const cache = await caches.open(CACHE);
  const nav = req.mode === 'navigate';
  const key = nav ? INDEX : req.url;
  const hit = await cache.match(key, { ignoreSearch: true });

  const refresh = fetch(nav ? new Request(INDEX, { cache: 'no-cache' }) : new Request(req.url, { cache: 'no-cache' }))
    .then((res) => {
      if (res && res.ok && res.type === 'basic') cache.put(key, res.clone());
      return res;
    });

  if (hit) {
    event.waitUntil(refresh.catch(() => {}));
    return hit;
  }
  try {
    return await refresh;
  } catch (err) {
    if (nav) {
      const fallback = await cache.match(INDEX);
      if (fallback) return fallback;
    }
    throw err;
  }
}
