// 101 Drivers Service Worker for PWA
//
// v5.2 — per-deploy cache versioning + content-type guard + CACHE-FIRST
// navigations (stale-while-revalidate; see the v5.2 block at the fetch
// handler for why — PWA cold start must not wait on the network).
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

// iOS launch screens (apple-touch-startup-image) — one per device/orientation.
// Precached so a standalone PWA's launch screen is available even on the very
// first offline launch after install. Names must stay in sync with
// scripts/gen_splash.py, which generates public/splash/*.
[
  'iphone5-se1', 'iphone678-se23', 'iphone-plus', 'iphone-xs-11pro-12mini-13mini',
  'iphone-xr-11', 'iphone-xsmax-11promax', 'iphone-12-13-14', 'iphone-121314promax',
  'iphone-14pro', 'iphone-14promax-15', 'iphone-16pro', 'iphone-16promax',
  'iphone-air', 'ipad-mini', 'ipad-102', 'ipad-air', 'ipad-pro-11', 'ipad-pro-129',
].forEach((stem) => {
  STATIC_ASSETS.push(`/splash/${stem}-portrait.png`, `/splash/${stem}-landscape.png`);
});

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

// Transient-network retry for asset fetches.
//
// WHY: after a device sits idle (screen lock, app switch, tab suspension),
// the OS drops the network connection. The FIRST request after resume races
// the reconnecting radio and often fails outright — and because route chunks
// are code-split and fetched exactly on first navigation, that failing
// request was typically a lazy route chunk. The page then crashed onto the
// router error screen (which auto-reloads), so every wake-up produced a
// visible "Something went wrong" flash. A short retry window bridges the
// reconnect: the re-attempt lands once the radio is back and the navigation
// completes invisibly.
//
// Only fetch REJECTIONS (network errors — no response at all) are retried.
// HTTP error statuses (404/500, the SPA-fallback HTML for a missing chunk)
// are answers from the server and are returned untouched — retrying those
// would just delay the correct stale-build recovery.
const NETWORK_RETRY_DELAYS_MS = [400, 1200];

async function fetchWithRetry(request) {
  try {
    return await fetch(request);
  } catch (firstError) {
    let lastError = firstError;
    for (const delay of NETWORK_RETRY_DELAYS_MS) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        return await fetch(request);
      } catch (retryError) {
        lastError = retryError;
      }
    }
    throw lastError;
  }
}

// Network fetch that only stores clean, successful responses in the
// current deploy's dynamic bucket. The response is always returned to
// the page exactly as the server delivered it.
function fetchAndCache(request) {
  return fetchWithRetry(request).then((response) => {
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

// Navigation fetch + cache. Navigations are ALWAYS documents — an HTML
// content-type under any path is the CORRECT answer here (nginx's SPA
// fallback serves index.html for /driver/123 etc.). The generic
// contentTypeMatchesRequest guard is for SUBRESOURCES and would wrongly
// treat every deep-link page as poison; its navigation equivalent is
// simply "ok + text/html", which already excludes 404/502/503 error
// bodies via response.ok.
// Both puts are CHAINED (not fire-and-forget) so the service worker stays
// alive until the cache is primed for the next launch.
async function fetchNavigationAndCache(request) {
  const response = await fetchWithRetry(request);
  if (response && response.ok) {
    const type = (response.headers.get('content-type') || '').toLowerCase();
    if (type.includes('html')) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      await Promise.all([
        cache.put(request, response.clone()),
        cache.put('/index.html', response.clone()),
      ]);
    }
  }
  return response;
}

// v5.2 — cache-first (stale-while-revalidate) NAVIGATIONS.
//
// WHY: v5.1 served navigations NETWORK-FIRST (cache only when the network
// outright failed). Every PWA cold launch therefore waited a full network
// round-trip — DNS + TLS + server render + the phone's radio reconnecting
// after idle — before a single pixel painted. On iPhone standalone (which
// has NO launch/splash UI at all) that wait is a plain WHITE screen for
// seconds: exactly the "white screen before the loading comes" report.
// The boot shell could only paint AFTER the navigation response arrived.
//
// WHAT v5.2 CHANGES: navigations are now served from THIS deploy's cached
// index.html instantly (the same stale-while-revalidate every other asset
// already used), and the fresh copy is fetched in the background so the
// NEXT launch is current. Staleness is contained by the existing defense
// stack, which was built for exactly this:
//   - cache buckets embed the per-deploy BUILD_ID and activate wipes every
//     older bucket, so a cached index.html can only be from the CURRENT
//     deploy's service worker;
//   - the inline boot shell + 8s/20s watchdogs recover a stale/mismatched
//     boot; the vite:preloadError reload-once recovers a chunk 404 after a
//     mid-deploy refresh.
// First-ever visit and the first launch right after a deploy (empty
// navigation cache) still go to the network — identical to v5.1 there.

  // For navigation requests, serve the cached shell INSTANTLY, refresh in
  // the background, and fall back to network only when nothing is cached.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        // 1. Instant paint. ignoreSearch so /?source=pwa, /?utm_…, and
        //    deep links (/driver/123) all hit the cached SPA shell — every
        //    navigation on this origin is the same client-rendered index.html.
        const cached =
          (await caches.match(request, { ignoreSearch: true })) ||
          (await caches.match('/index.html'));

        // 2. Background refresh — primes the request's own key AND the
        //    canonical '/index.html' key so the shell fallback above can
        //    never go stale-empty (see fetchNavigationAndCache).
        const networkPromise = fetchNavigationAndCache(request).catch(() => null);

        if (cached) {
          event.waitUntil(networkPromise);
          return cached;
        }

        // 3. Nothing cached yet (first visit / first launch after a deploy):
        //    wait for the network exactly like v5.1 did.
        const response = await networkPromise;
        if (response) return response;

        // 4. Offline AND nothing cached — last resort: any cached page.
        return (await caches.match('/')) || Response.error();
      })()
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
