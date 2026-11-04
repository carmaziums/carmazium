/*
 * CarMazium installed-app service worker.
 * Deliberately minimal: it never caches pages, API calls or account data, so
 * users always see live listings, bids and prices. Its only job is to show a
 * friendly offline page when a page can't load because the device is offline.
 */
const OFFLINE_URL = '/offline.html';
const CACHE = 'carmazium-offline-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return; // everything else: browser default
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error())),
  );
});
