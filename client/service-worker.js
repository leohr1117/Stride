const VERSION = '__VERSION__';
const CACHE = `ascend-${VERSION}`;
const DATEIEN = ['__DATEIEN__'];
const STARTSEITE = '/index.html';
const API_PRAEFIX = '/api/';
const ASSET_PRAEFIX = '/assets/';

function ladeUndMerke(anfrage) {
  return fetch(anfrage).then((antwort) => {
    if (antwort.ok) {
      const kopie = antwort.clone();
      caches.open(CACHE).then((cache) => cache.put(anfrage, kopie));
    }
    return antwort;
  });
}

self.addEventListener('install', (ereignis) => {
  ereignis.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(DATEIEN.map((datei) => new Request(datei, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (ereignis) => {
  ereignis.waitUntil(
    caches
      .keys()
      .then((namen) => Promise.all(namen.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (ereignis) => {
  const anfrage = ereignis.request;
  const url = new URL(anfrage.url);
  if (anfrage.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith(API_PRAEFIX)) {
    return;
  }
  if (anfrage.mode === 'navigate') {
    ereignis.respondWith(fetch(anfrage).catch(() => caches.match(STARTSEITE)));
    return;
  }
  const nachladen = url.pathname.startsWith(ASSET_PRAEFIX) ? ladeUndMerke : (eintrag) => fetch(eintrag);
  ereignis.respondWith(caches.match(anfrage).then((treffer) => treffer ?? nachladen(anfrage)));
});
