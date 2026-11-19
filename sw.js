const CACHE_NAME = 'qbar-studio-v5';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/qbar-logo.webp',
  '/jsqr.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http')) return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // BioMi is served through a live GitHub Pages rewrite and contains user
  // profiles. Always fetch its pages fresh instead of keeping stale HTML.
  if (url.pathname === '/biomi' || url.pathname.startsWith('/biomi/')) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((networkRes) => {
        if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return networkRes;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
