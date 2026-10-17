'use strict';
/* Service worker: stores the app on the device for offline use and checks for updates at launch. */
const VERSION = '2026-10-16-5';
const PREFIX = 'yahtzee-';
const CACHE = PREFIX + VERSION;

// files stored on first visit
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
      // always fetch fresh copies, not the browser's HTTP cache
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

// show the stored copy immediately, then refresh it in the background
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
