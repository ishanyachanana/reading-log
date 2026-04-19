// Simple offline-capable service worker.
// Strategy:
//   - App shell (HTML/CSS/JS/manifest/icons): cache-first, refreshed in background.
//   - Share target route (/share?...): always serve index.html from cache.
//   - Everything else: network-first, fall back to cache.

const VERSION = 'v1';
const SHELL_CACHE = `reading-log-shell-${VERSION}`;
const RUNTIME_CACHE = `reading-log-runtime-${VERSION}`;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // addAll fails atomically; use individual puts so a missing optional asset doesn't break install
      Promise.all(
        SHELL_ASSETS.map((asset) =>
          fetch(asset, { cache: 'reload' })
            .then((res) => res.ok && cache.put(asset, res))
            .catch(() => null)
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Share target: always respond with the app shell so the client-side handler picks up the query params.
  if (url.pathname === '/share') {
    event.respondWith(
      caches.match('/index.html').then((cached) => cached || fetch('/index.html'))
    );
    return;
  }

  // Navigation requests: network-first, fall back to cached shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html')))
    );
    return;
  }

  // Static shell assets: cache-first.
  if (SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }))
    );
    return;
  }

  // Everything else: network-first, cache fallback.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});
