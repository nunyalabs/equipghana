// EQUIP PWA Service Worker
// Offline-first shell, runtime caching for data, update notifications.
// Increment CACHE_VERSION to trigger an update prompt for users.

const CACHE_VERSION = 'equip-v1.1.0';
const APP_SHELL_CACHE = CACHE_VERSION + '-shell';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';

// Core assets for offline (App Shell)
const APP_SHELL_ASSETS = [
  'index.html',
  'app.js',
  'forms.js',
  'users.js',
  'analytics.js',
  'data-portability.js',
  'manifest.json',
  'sw.js',
  'cso.json',
  'icon-192.png',
  'icon-512.png'
];

// Region facility JSON files for offline lookups
const FACILITY_FILES = [
  'Ahafo','Ashanti','Bono','Bono_East','Central','Eastern','Greater_Accra','North_East','Northern','Oti','Savannah','Upper_East','Upper_West','Volta','Western','Western_North'
].map(r => `facilities/${r}.json`);

// Utility: broadcast message to all controlled clients
async function broadcastMessage(msg) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage(msg);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);
    try {
      await cache.addAll([...APP_SHELL_ASSETS, ...FACILITY_FILES]);
    } catch (e) {
      // Some facility files may 404 later if missing; ignore partial failures
      console.warn('[SW] Precaching issue:', e);
    }
    // Activate new SW immediately
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Remove old versioned caches
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k)));
    await self.clients.claim();
    await broadcastMessage({ type: 'SW_ACTIVATED', version: CACHE_VERSION });
  })());
});

// Cache strategy helpers
async function cacheFirst(request) {
  const cache = await caches.open(APP_SHELL_CACHE);
  const match = await cache.match(request, { ignoreSearch: true });
  if (match) return match;
  try {
    const resp = await fetch(request);
    if (resp && resp.status === 200 && request.method === 'GET') {
      cache.put(request, resp.clone());
    }
    return resp;
  } catch (e) {
    return match; // fallback if existed
  }
}

async function networkFirstJSON(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const resp = await fetch(request);
    if (resp && resp.status === 200) {
      cache.put(request, resp.clone());
    }
    return resp;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Last resort: maybe offline shell for navigation
  return caches.match('index.html');
  }
}

// Navigation requests fallback to index.html for SPA routing / offline start
async function handleNavigation(request) {
  try {
    const resp = await fetch(request);
    if (resp && resp.ok) return resp;
    return caches.match('index.html');
  } catch (e) {
    return caches.match('index.html');
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Navigation (HTML) requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // JSON data (facilities / cso) network-first for freshness
  if (request.destination === 'empty' && /\.(json)$/.test(url.pathname)) {
    event.respondWith(networkFirstJSON(request));
    return;
  }

  // App shell & JS/CSS/images: cache-first
  if ([ 'script','style','image' ].includes(request.destination) || APP_SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
});

// Listen for client messages (e.g., to trigger skipWaiting)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Periodic sync placeholder (future): could refresh facility data
// self.addEventListener('periodicsync', (event) => { /* handle periodic sync */ });

// Optional: respond to push notifications in future.
// self.addEventListener('push', (event) => { /* handle push */ });