const CACHE_NAME = 'occ-pwa-cache-v20260805-0004';
const OCC_PWA_CACHE = CACHE_NAME;
const OCC_PWA_CORE = [
  '/',
  '/index.html',
  '/app.html',
  '/manifest.json',
  '/assets/image_cb64a0_192.png',
  '/assets/image_cb64a0_512.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(OCC_PWA_CACHE).then((cache) => cache.addAll(OCC_PWA_CORE)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.map((cache) => {
        if (cache !== CACHE_NAME) {
          console.log('[SW] Apagando cache antigo:', cache);
          return caches.delete(cache);
        }
        return Promise.resolve(false);
      })
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!request || request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(OCC_PWA_CACHE).then((cache) => cache.put('/app-shell:navigate', copy)).catch(() => null);
          return response;
        })
        .catch(() => caches.match(request, { ignoreSearch: true }).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: false }).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const copy = response.clone();
        caches.open(OCC_PWA_CACHE).then((cache) => cache.put(request, copy)).catch(() => null);
        return response;
      });
    })
  );
});
