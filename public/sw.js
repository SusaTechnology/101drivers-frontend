// 101 Drivers Service Worker for PWA
//
// v5 — per-deploy cache versioning + content-type guard.
//
// WHY (history of incidents this file caused before):
//   v3-and-earlier cached ANY response, including 404/500 error pages
//   returned mid-deploy → poisoned cache → persistent white screens.
//   v4 fixed the 2xx-only caching, but kept a HAND-MAINTAINED cache
//   version ("v4") that was never bumped between deploys, plus
//   cache-first serving of every JS chunk. Vite reshuffles its chunks
//   on every build, so long-lived devices (iOS Safari and installed
//   PWAs above all — they keep service-worker caches the longest)
//   accumulated chunks from MULTIPLE deploy generations and crashed
//   with mixed-build TypeErrors like
//   "Cannot read properties of undefined (reading 'component')"
//   on pages that were perfectly fine in the current build.
//
// WHAT v5 CHANGES:
//   1. Per-deploy cache versioning: __BUILD_ID__ is stamped with a UTC
//      build timestamp by the production build (vite.config.ts →
//      serviceWorkerBuildStamp). Cache bucket names embed it, so every
//      new deploy's activate handler wipes every bucket from every
//      previous deploy. Chunks from old builds can never be served again.
//   2. Content-type guard: a cached entry is only served (and only
//      stored) if its content-type matches what the URL promises.
//      This kills the SPA-fallback poison vector — nginx returns
//      200 + index.html (text/html) for missing files, and storing
//      that under a .js URL breaks dynamic imports in confusing ways.
//      Already-poisoned entries are deleted on sight and re-fetched.
//   3. /sw.js itself is never intercepted or cached.
//   4. install() always calls skipWaiting() even if precache partially
//      fails, so a new deploy can never sit in "waiting" forever on a
//      device that keeps a tab/PWA open.
//
// If __BUILD_ID__ is still the literal placeholder (e.g. the file is
// served by a non-stamped build), everything still works — the cache
// names are just constant and per-deploy wiping degrades to the old
// behaviour. Never broken, only less protected.

const BUILD_ID = '__BUILD_ID__';
const STATIC_CACHE_NAME = `101-drivers-static-${BUILD_ID}`;
const DYNAMIC_CACHE_NAME = `101-drivers-dynamic-${BUILD_ID}`;

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/101drivers-logo.jpg',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/apple-touch-icon.png'
];

// ── Content-type guard ────────────────────────────────────────────────
// Returns true when a response's content-type matches what the request
// URL promises. Guarding BOTH reads and writes means:
//   - a poisoned entry (HTML stored under a .js URL) is never served —
//     it is deleted and the request goes to the network instead;
//   - the SPA-fallback HTML that nginx returns (status 200!) for a
//     missing asset can never enter the cache in the first place.
function contentTypeMatchesRequest(request, response) {
  if (!response) return false;

  const pathname = new URL(request.url).pathname;
  const type = (response.headers.get('content-type') || '').toLowerCase();

  // Browsers refuse to execute module scripts served without a
  // JavaScript MIME type, so anything less would break on delivery.
  if (pathname.endsWith('.js') || pathname.endsWith('.mjs')) {
    return type.includes('javascript');
  }
  if (pathname.endsWith('.css')) {
    return type.includes('css');
  }
  if (pathname.endsWith('.html')) {
    return type.includes('html');
  }

  // Everything else (images, fonts, json, ...): only reject the
  // SPA-fallback poison signature — an HTML page under a non-HTML URL.
  return !type.includes('html');
}

// Delete a request's entry from every cache bucket (used to evict
// poisoned entries that an older service worker may have stored).
function deleteFromAllCaches(request) {
  return caches.keys().then((names) =>
    Promise.all(
      names.map((name) =>
        caches.open(name).then((cache) => cache.delete(request))
      )
    )
  );
}

// Network fetch that only stores clean, successful responses in the
// current deploy's dynamic bucket. The response is always returned to
// the page exactly as the server delivered it.
function fetchAndCache(request) {
  return fetch(request).then((response) => {
    if (
      response &&
      response.ok &&
      contentTypeMatchesRequest(request, response)
    ) {
      const clone = response.clone();
      caches
        .open(DYNAMIC_CACHE_NAME)
        .then((cache) => cache.put(request, clone));
    }
    return response;
  });
}

// Check if a URL is a Vite dev server asset that must NEVER be cached.
// Vite 7 serves pre-bundled deps, HMR chunks, and virtual modules at
// various paths that change on every restart or cache clear.
function isViteDevAsset(url) {
  const p = url.pathname;

  // Vite internal paths
  if (p.startsWith('/node_modules/') ||
      p.startsWith('/@vite/') ||
      p.startsWith('/@tanstack/') ||
      p.startsWith('/@react-refresh/') ||
      p.includes('.vite/deps/') ||
      p.includes('tsr-split') ||
      p.includes('/@id/')) {
    return true;
  }

  // Any URL with a ?v= query param is a Vite dep optimization hash —
  // these change when the pre-bundle is regenerated and must never be cached.
  if (url.searchParams.has('v') || url.searchParams.has('t')) {
    return true;
  }

  // Virtual chunk filenames (Vite 7 pre-bundle output)
  if (/^\/chunk-[A-Z0-9]+\.js$/.test(p)) {
    return true;
  }

  // react-dom_client, react_jsx-runtime, etc. — Vite pre-bundled entry points
  if (/^(\/react|\/react-dom|\/react-dom_client|\/react_jsx)/.test(p)) {
    return true;
  }

  // All .js files under /src/ in dev mode (ESM modules, not production bundles)
  if (p.startsWith('/src/') && p.endsWith('.js')) {
    return true;
  }

  return false;
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing service worker build ${BUILD_ID}...`);
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((error) => {
        // Precache is an optimization, never a gate: a renamed icon or a
        // transient failure must NOT leave this service worker stuck in
        // "waiting" — that is how devices used to run months-old builds.
        console.error('[SW] Precache incomplete, installing anyway:', error);
      })
      .then(() => {
        console.log('[SW] Install complete, activating immediately');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up every cache bucket that does not belong to
// THIS build. Because the bucket names embed the per-deploy BUILD_ID,
// this wipes all caches from all previous deploys the first time the
// new service worker takes over.
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating service worker build ${BUILD_ID}...`);
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE_NAME && name !== DYNAMIC_CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting cache from another build:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // NEVER cache Vite dev server assets
  if (isViteDevAsset(url)) {
    return;
  }

  // Skip API requests (they need fresh data)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // The service worker script itself must never be intercepted — the
  // browser's update check has to see the freshly deployed file to
  // detect the new build.
  if (url.pathname === '/sw.js') {
    return;
  }

  // Skip external requests
  if (url.origin !== location.origin) {
    return;
  }

  // For navigation requests, try network first, then cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the new response — but ONLY if it is a real page with
          // the content-type it promises. Caching 404/502/503 error pages
          // here is what used to keep the app broken after a failed deploy
          // until site data was cleared.
          if (response && response.ok && contentTypeMatchesRequest(request, response)) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE_NAME)
              .then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Return cached response or offline page
          return caches.match(request)
            .then((response) => response || caches.match('/'));
        })
    );
    return;
  }

  // For other requests, try cache first, then network — with guards:
  //   - a cached entry is only used if its content-type matches the URL
  //     (a poisoned entry is evicted and the network is used instead);
  //   - the background refresh and the network fallback only STORE
  //     clean, successful responses.
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        const cachedUsable =
          cachedResponse && contentTypeMatchesRequest(request, cachedResponse);

        if (cachedUsable) {
          // Serve the cached copy and refresh it in the background.
          event.waitUntil(fetchAndCache(request));
          return cachedResponse;
        }

        if (cachedResponse && !cachedUsable) {
          // Poisoned by an older service worker (e.g. HTML under a .js
          // URL). Evict it from every bucket before it can hurt again.
          event.waitUntil(deleteFromAllCaches(request));
        }

        // Not in cache (or cache entry was poisoned) → network.
        return fetchAndCache(request);
      })
  );
});

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
});

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  const options = {
    body: event.data ? event.data.text() : 'New notification from 101 Drivers',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      { action: 'explore', title: 'View Details' },
      { action: 'close', title: 'Close' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('101 Drivers', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log(`[SW] Service worker build ${BUILD_ID} loaded`);
