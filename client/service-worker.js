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

// Einzig erlaubtes Ziel ist die Übersicht. Jeder andere Wert wird /.
const ERLAUBTE_ZIELE = ['/'];
const HINWEIS_ICON = '/icons/icon-192.png';
const HINWEIS_TITEL = 'Stride';

function erlaubtesZiel(wert) {
  return ERLAUBTE_ZIELE.includes(wert) ? wert : '/';
}

function liesNutzlast(daten) {
  if (!daten || typeof daten.json !== 'function') {
    return null;
  }
  try {
    const wert = daten.json();
    return wert && typeof wert === 'object' ? wert : null;
  } catch {
    return null;
  }
}

function zeigeHinweis(daten) {
  const nutzlast = liesNutzlast(daten);
  const titel =
    nutzlast && typeof nutzlast.title === 'string' && nutzlast.title.trim() !== '' ? nutzlast.title : HINWEIS_TITEL;
  const text = nutzlast && typeof nutzlast.body === 'string' ? nutzlast.body : '';
  const ziel = erlaubtesZiel(nutzlast && nutzlast.data ? nutzlast.data.ziel : undefined);
  return self.registration.showNotification(titel, {
    body: text,
    icon: HINWEIS_ICON,
    data: { ziel },
    silent: false,
  });
}

function gleicherUrsprung(client) {
  try {
    return new URL(client.url).origin === self.location.origin;
  } catch {
    return false;
  }
}

function pfadVon(client) {
  try {
    return new URL(client.url).pathname;
  } catch {
    return '';
  }
}

function oeffneZiel(ziel) {
  const erlaubt = erlaubtesZiel(ziel);
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenster) => {
    const eigenes = fenster.find((client) => gleicherUrsprung(client));
    if (!eigenes) {
      return self.clients.openWindow(erlaubt);
    }
    if (typeof eigenes.focus === 'function') {
      eigenes.focus();
    }
    if (pfadVon(eigenes) === erlaubt) {
      return Promise.resolve(eigenes);
    }
    if (typeof eigenes.navigate === 'function') {
      return eigenes.navigate(erlaubt).then((navigiert) => navigiert || self.clients.openWindow(erlaubt));
    }
    return self.clients.openWindow(erlaubt);
  });
}

self.addEventListener('push', (ereignis) => {
  ereignis.waitUntil(zeigeHinweis(ereignis.data));
});

self.addEventListener('notificationclick', (ereignis) => {
  ereignis.notification.close();
  const daten = ereignis.notification.data;
  ereignis.waitUntil(oeffneZiel(daten ? daten.ziel : undefined));
});
