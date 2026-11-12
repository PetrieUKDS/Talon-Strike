'use strict';

// Offline support. Every file the game needs is cached on install. Requests go to the
// network first, so a new version shows up as soon as you're online, and fall back to
// the cache when you're not. Bump CACHE when the file list changes.
const CACHE = 'talon-strike-v7';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'fonts/orbitron.woff2',
  'fonts/share-tech-mono.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'art/stormwolf.png',
  'art/kestrel.png',
  'art/titan.png',
  'art/viper.png',
  'art/desert/jeep.png',
  'art/desert/truck.png',
  'art/desert/tank.png',
  'art/desert/turret.png',
  'art/desert/gunship.png',
  'art/desert/jet.png',
  'art/desert/boat.png',
  'art/temperate/jeep.png',
  'art/temperate/truck.png',
  'art/temperate/tank.png',
  'art/temperate/turret.png',
  'art/temperate/gunship.png',
  'art/temperate/jet.png',
  'art/temperate/boat.png',
  'art/arctic/jeep.png',
  'art/arctic/truck.png',
  'art/arctic/tank.png',
  'art/arctic/turret.png',
  'art/arctic/gunship.png',
  'art/arctic/jet.png',
  'art/arctic/boat.png',
  'art/jungle/jeep.png',
  'art/jungle/truck.png',
  'art/jungle/tank.png',
  'art/jungle/turret.png',
  'art/jungle/gunship.png',
  'art/jungle/jet.png',
  'art/jungle/boat.png',
  'art/ash/jeep.png',
  'art/ash/truck.png',
  'art/ash/tank.png',
  'art/ash/turret.png',
  'art/ash/gunship.png',
  'art/ash/jet.png',
  'art/ash/boat.png',
  'art/canyon/jeep.png',
  'art/canyon/truck.png',
  'art/canyon/tank.png',
  'art/canyon/turret.png',
  'art/canyon/gunship.png',
  'art/canyon/jet.png',
  'art/canyon/boat.png',
  'art/desert/pad.png',
  'art/desert/depot.png',
  'art/desert/bunker.png',
  'art/temperate/pad.png',
  'art/temperate/depot.png',
  'art/temperate/bunker.png',
  'art/arctic/pad.png',
  'art/arctic/depot.png',
  'art/arctic/bunker.png',
  'art/jungle/pad.png',
  'art/jungle/depot.png',
  'art/jungle/bunker.png',
  'art/ash/pad.png',
  'art/ash/depot.png',
  'art/ash/bunker.png',
  'art/canyon/pad.png',
  'art/canyon/depot.png',
  'art/canyon/bunker.png',
  'art/generator.png',
  'art/boss.png',
  'art/aidtruck.png',
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
