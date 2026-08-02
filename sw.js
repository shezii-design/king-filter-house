// King Filter House (KFH) Progressive Web App Service Worker
// Cache version identifier
const CACHE_NAME = 'kfh-pos-v1';

// Critical core assets to pre-cache on installation
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Install Event: Pre-cache app shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[KFH Service Worker] Pre-caching offline app shell');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[KFH Service Worker] Non-fatal precache notice:', err);
      });
    })
  );
});

// Activate Event: Clean old cache versions and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[KFH Service Worker] Removing stale cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Offline-first with stale-while-revalidate for local assets
self.addEventListener('fetch', (event) => {
  const request = event.request;
  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  // Skip caching for non-http(s) schemes (e.g. chrome-extension://), non-GET requests, or external API calls
  if (
    !url.protocol.startsWith('http') ||
    request.method !== 'GET' ||
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/rest/v1')
  ) {
    return;
  }

  // Prepare target request (Auto-upgrade http to https if app origin is https to prevent Mixed Content errors)
  let targetReq = request;
  if (url.protocol === 'http:' && self.location.protocol === 'https:') {
    try {
      const httpsUrl = request.url.replace(/^http:/i, 'https:');
      targetReq = new Request(httpsUrl, {
        mode: request.mode === 'navigate' ? 'same-origin' : 'cors',
        credentials: request.credentials,
        headers: request.headers,
        redirect: request.redirect,
      });
    } catch (e) {
      targetReq = request;
    }
  }

  // Handle app requests cleanly with async function returning a Response
  event.respondWith(
    (async () => {
      // 1. Check cache first
      let cachedResponse;
      try {
        cachedResponse = await caches.match(targetReq);
      } catch (err) {
        // ignore cache match error
      }

      // If cached, return cached response & trigger background revalidation
      if (cachedResponse) {
        fetchAndCache(targetReq).catch(() => {});
        return cachedResponse;
      }

      // 2. Perform network fetch
      try {
        const networkResponse = await fetch(targetReq);
        if (
          networkResponse &&
          (networkResponse.status === 200 || networkResponse.type === 'opaque')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(targetReq, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      } catch (networkError) {
        // Network, CORS, or Mixed Content failed
        if (request.mode === 'navigate') {
          const appShell =
            (await caches.match('./index.html')) ||
            (await caches.match('./')) ||
            (await caches.match('/index.html'));
          if (appShell) return appShell;
        }

        const isImage =
          request.destination === 'image' ||
          request.headers.get('accept')?.includes('image') ||
          /\.(jpg|jpeg|png|gif|svg|webp|ico)$/i.test(url.pathname);

        if (isImage) {
          const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100%" height="100%" fill="#f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-size="12">N/A</text></svg>`;
          return new Response(fallbackSvg, {
            status: 200,
            headers: { 'Content-Type': 'image/svg+xml' }
          });
        }

        return new Response('', { status: 404, statusText: 'Offline or Not Found' });
      }
    })()
  );
});

// Helper for background cache revalidation
async function fetchAndCache(request) {
  try {
    let reqToFetch = request;
    if (typeof request.url === 'string' && request.url.startsWith('http:') && self.location.protocol === 'https:') {
      try {
        reqToFetch = new Request(request.url.replace(/^http:/i, 'https:'), {
          mode: request.mode === 'navigate' ? 'same-origin' : 'cors',
          credentials: request.credentials,
          headers: request.headers,
          redirect: request.redirect,
        });
      } catch (err) {}
    }
    const networkResponse = await fetch(reqToFetch);
    if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
      const responseToCache = networkResponse.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, responseToCache);
    }
  } catch (e) {
    // background fetch failed or offline
  }
}
