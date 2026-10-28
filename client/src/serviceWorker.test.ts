import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext, type Context } from 'node:vm';
import { describe, expect, it } from 'vitest';

const QUELLE = readFileSync(fileURLToPath(new URL('../service-worker.js', import.meta.url)), 'utf8');
const URSPRUNG = 'http://127.0.0.1:4173';
const VERSION = 'abc123def456';

interface HinweisOptionen {
  body: string;
  icon: string;
  data: { ziel: string };
  silent: boolean;
  badge?: string;
  actions?: unknown[];
}

interface Gezeigt {
  titel: string;
  optionen: HinweisOptionen;
}

interface Fenster {
  url: string;
  focus?: () => Promise<Fenster>;
  navigate?: (ziel: string) => Promise<Fenster | null>;
}

interface Arbeiter {
  feuer: (typ: string, ereignis: Record<string, unknown>) => Promise<void>;
  gezeigt: Gezeigt[];
  geoeffnet: string[];
  cacheNamen: string[];
  geloescht: string[];
  beansprucht: number;
  uebersprungen: number;
  matchAlle: unknown[];
  antworten: Promise<unknown>[];
  vorgeladen: { url: string; cache?: string }[];
}

function arbeiter(fenster: Fenster[] = []): Arbeiter {
  const listener = new Map<string, (ereignis: Record<string, unknown>) => void>();
  const gezeigt: Gezeigt[] = [];
  const geoeffnet: string[] = [];
  const cacheNamen: string[] = [];
  const geloescht: string[] = [];
  const matchAlle: unknown[] = [];
  const antworten: Promise<unknown>[] = [];
  const stand = { beansprucht: 0, uebersprungen: 0 };
  const vorgeladen: { url: string; cache?: string }[] = [];
  const cache = {
    addAll: (liste: { url: string; cache?: string }[]) => {
      vorgeladen.push(...liste);
      return Promise.resolve();
    },
    put: () => Promise.resolve(),
  };
  const sandbox = {
    self: {
      location: { origin: URSPRUNG },
      skipWaiting: () => {
        stand.uebersprungen += 1;
        return Promise.resolve();
      },
      clients: {
        claim: () => {
          stand.beansprucht += 1;
          return Promise.resolve();
        },
        matchAll: (optionen: unknown) => {
          matchAlle.push(optionen);
          return Promise.resolve(fenster);
        },
        openWindow: (url: string) => {
          geoeffnet.push(url);
          return Promise.resolve({ url: `${URSPRUNG}${url}` });
        },
      },
      registration: {
        showNotification: (titel: string, optionen: HinweisOptionen) => {
          gezeigt.push({ titel, optionen });
          return Promise.resolve();
        },
      },
      addEventListener: (typ: string, fn: (ereignis: Record<string, unknown>) => void) => {
        listener.set(typ, fn);
      },
    },
    caches: {
      open: (name: string) => {
        cacheNamen.push(name);
        return Promise.resolve(cache);
      },
      keys: () => Promise.resolve([`ascend-${VERSION}`, 'ascend-alt', 'fremd']),
      delete: (name: string) => {
        geloescht.push(name);
        return Promise.resolve(true);
      },
      match: () => Promise.resolve(undefined),
    },
    fetch: () => Promise.reject(new Error('offline')),
    URL,
    Request: function Anfrage(this: { url: string; cache?: string }, eingabe: string, init?: { cache?: string }) {
      this.url = eingabe;
      this.cache = init?.cache;
    },
    Promise,
  };
  runInContext(QUELLE.replace('__VERSION__', VERSION).replace(`['__DATEIEN__']`, JSON.stringify(['/index.html'])), createContext(sandbox) as Context);
  return {
    async feuer(typ, ereignis) {
      const warten: Promise<unknown>[] = [];
      ereignis.waitUntil = (arbeit: Promise<unknown>) => {
        warten.push(arbeit);
      };
      if (typ === 'fetch') {
        ereignis.respondWith = (arbeit: Promise<unknown>) => {
          antworten.push(arbeit);
        };
      }
      const fn = listener.get(typ);
      if (!fn) {
        throw new Error(`Listener ${typ} fehlt.`);
      }
      fn(ereignis);
      await Promise.all(warten);
    },
    gezeigt,
    geoeffnet,
    cacheNamen,
    geloescht,
    get beansprucht() {
      return stand.beansprucht;
    },
    get uebersprungen() {
      return stand.uebersprungen;
    },
    matchAlle,
    antworten,
    vorgeladen,
  };
}

function fenster(pfad: string, extra: Partial<Fenster> = {}): Fenster {
  const client: Fenster = {
    url: `${URSPRUNG}${pfad}`,
    focus: () => {
      return Promise.resolve(client);
    },
    navigate: (ziel: string) => {
      client.url = `${URSPRUNG}${ziel}`;
      return Promise.resolve(client);
    },
    ...extra,
  };
  return client;
}

function nutzlast(ziel: unknown, title = 'Stride', body = '4 Tage sind angeschlagen. Ein Eintrag heute hält sie.') {
  return {
    json: () => ({ title, body, data: { ziel } }),
  };
}

describe('Service Worker', () => {
  it('behält die Platzhalter, damit der Build Version und Dateien einsetzt', () => {
    expect(QUELLE).toContain("const VERSION = '__VERSION__'");
    expect(QUELLE).toContain("const DATEIEN = ['__DATEIEN__']");
    expect(QUELLE).not.toContain('/aufgaben');
    expect(QUELLE).not.toContain('/training');
  });

  it('schreibt die Dateiliste erst nach dem finalen Bundle', () => {
    const plugin = readFileSync(fileURLToPath(new URL('../../vite.config.ts', import.meta.url)), 'utf8');
    expect(plugin).toContain('writeBundle(optionen, bundle)');
    expect(plugin).not.toContain('emitFile');
  });

  it('behält Install, Activate und den Cache-Namen', async () => {
    const sw = arbeiter();
    await sw.feuer('install', {});
    await sw.feuer('activate', {});
    expect(sw.cacheNamen).toEqual([`ascend-${VERSION}`]);
    expect(sw.vorgeladen).toEqual([{ url: '/index.html', cache: 'reload' }]);
    expect(sw.uebersprungen).toBe(1);
    expect(sw.geloescht).toEqual(['ascend-alt', 'fremd']);
    expect(sw.beansprucht).toBe(1);
  });

  it('lässt die API ungecached und fängt eine Navigation offline mit der Startseite', async () => {
    const sw = arbeiter();
    await sw.feuer('fetch', { request: { method: 'GET', url: `${URSPRUNG}/api/hinweise`, mode: 'cors' } });
    expect(sw.antworten).toHaveLength(0);
    await sw.feuer('fetch', { request: { method: 'GET', url: `${URSPRUNG}/mehr`, mode: 'navigate' } });
    expect(sw.antworten).toHaveLength(1);
    await expect(sw.antworten[0]).resolves.toBeUndefined();
  });

  it('zeigt die Nutzlast sichtbar, mit Icon und ohne Badge oder Aktionen', async () => {
    const sw = arbeiter();
    await sw.feuer('push', { data: nutzlast('/') });
    expect(sw.gezeigt).toEqual([
      {
        titel: 'Stride',
        optionen: {
          body: '4 Tage sind angeschlagen. Ein Eintrag heute hält sie.',
          icon: '/icons/icon-192.png',
          data: { ziel: '/' },
          silent: false,
        },
      },
    ]);
    expect(sw.gezeigt[0]?.optionen.badge).toBeUndefined();
    expect(sw.gezeigt[0]?.optionen.actions).toBeUndefined();
    expect(sw.geoeffnet).toEqual([]);
  });

  it('zeigt auch ohne brauchbare Nutzlast eine sichtbare Meldung', async () => {
    const sw = arbeiter();
    await sw.feuer('push', { data: null });
    await sw.feuer('push', {
      data: {
        json: () => {
          throw new Error('kaputt');
        },
      },
    });
    await sw.feuer('push', { data: nutzlast('/', '   ', '') });
    expect(sw.gezeigt.map((eintrag) => eintrag.titel)).toEqual(['Stride', 'Stride', 'Stride']);
    expect(sw.gezeigt.every((eintrag) => eintrag.optionen.silent === false)).toBe(true);
    expect(sw.gezeigt.every((eintrag) => eintrag.optionen.data.ziel === '/')).toBe(true);
  });

  it.each(['/aufgaben', '/training', '/training/plaene/3', 'https://evil.example/phish', '//evil.example', 'javascript:alert(1)', '/?x=1', '', null])(
    'macht aus dem Ziel %j die Übersicht',
    async (ziel) => {
      const sw = arbeiter();
      await sw.feuer('push', { data: nutzlast(ziel) });
      expect(sw.gezeigt[0]?.optionen.data.ziel).toBe('/');
    },
  );

  it('öffnet ohne Fenster nur die Übersicht, nie das mitgelieferte Ziel', async () => {
    const sw = arbeiter();
    await sw.feuer('notificationclick', { notification: { data: { ziel: 'https://evil.example' }, close: () => undefined } });
    expect(sw.geoeffnet).toEqual(['/']);
    expect(sw.matchAlle).toEqual([{ type: 'window', includeUncontrolled: true }]);
  });

  it('schließt die Meldung und fokussiert ein offenes Fenster auf der Übersicht', async () => {
    let zu = 0;
    const fokussiert: string[] = [];
    const offen = fenster('/');
    offen.focus = () => {
      fokussiert.push(offen.url);
      return Promise.resolve(offen);
    };
    const sw = arbeiter([offen]);
    await sw.feuer('notificationclick', {
      notification: {
        data: { ziel: '/aufgaben' },
        close: () => {
          zu += 1;
        },
      },
    });
    expect(zu).toBe(1);
    expect(fokussiert).toEqual([`${URSPRUNG}/`]);
    expect(sw.geoeffnet).toEqual([]);
    expect(offen.url).toBe(`${URSPRUNG}/`);
  });

  it('navigiert ein offenes Fenster von einer Unterseite auf die Übersicht', async () => {
    const offen = fenster('/mehr');
    const ziele: string[] = [];
    offen.navigate = (ziel) => {
      ziele.push(ziel);
      offen.url = `${URSPRUNG}${ziel}`;
      return Promise.resolve(offen);
    };
    const sw = arbeiter([offen]);
    await sw.feuer('notificationclick', { notification: { data: { ziel: '/training' }, close: () => undefined } });
    expect(ziele).toEqual(['/']);
    expect(sw.geoeffnet).toEqual([]);
  });

  it('öffnet die Übersicht, wenn das Fenster nicht navigieren kann', async () => {
    const offen = fenster('/mehr', { navigate: undefined });
    const sw = arbeiter([offen]);
    await sw.feuer('notificationclick', { notification: { data: { ziel: '/' }, close: () => undefined } });
    expect(sw.geoeffnet).toEqual(['/']);
  });

  it('lässt fremde Fenster stehen und öffnet ein eigenes', async () => {
    const fremd: Fenster = { url: 'https://anders.example/weg' };
    const sw = arbeiter([fremd]);
    await sw.feuer('notificationclick', { notification: { data: { ziel: '/' }, close: () => undefined } });
    expect(sw.geoeffnet).toEqual(['/']);
    expect(fremd.url).toBe('https://anders.example/weg');
  });
});
