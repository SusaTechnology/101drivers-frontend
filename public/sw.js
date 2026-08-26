// 101 Drivers Service Worker for PWA
const CACHE_NAME = '101-drivers-v3';
const STATIC_CACHE_NAME = '101-drivers-static-v3';
const DYNAMIC_CACHE_NAME = '101-drivers-dynamic-v3';

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

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v3...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v3...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE_NAME && name !== DYNAMIC_CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
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

  // Skip external requests
  if (url.origin !== location.origin) {
    return;
  }

  // For navigation requests, try network first, then cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the new response
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE_NAME)
            .then((cache) => cache.put(request, responseClone));
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

  // For other requests, try cache first, then network
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached response and update cache in background
          fetch(request)
            .then((response) => {
              caches.open(DYNAMIC_CACHE_NAME)
                .then((cache) => cache.put(request, response));
            })
            .catch(() => {});
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request)
          .then((response) => {
            // Cache the response
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE_NAME)
              .then((cache) => cache.put(request, responseClone));
            return response;
          });
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

console.log('[SW] Service worker v3 loaded');
