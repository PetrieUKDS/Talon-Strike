'use strict';

// Offline support. Every file the game needs is cached on install. Requests go to the
// network first, so a new version shows up as soon as you're online, and fall back to
// the cache when you're not. Bump CACHE when the file list changes.
const CACHE = 'talon-strike-v4';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'fonts/orbitron.woff2',
  'fonts/share-tech-mono.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'src/util.js',
  'src/audio.js',
  'src/music.js',
  'src/input.js',
  'src/terrain.js',
  'src/entities.js',
  'src/missions.js',
  'src/contracts.js',
  'src/progress.js',
  'src/weather.js',
  'src/hud.js',
  'src/game.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })),
  );
});
