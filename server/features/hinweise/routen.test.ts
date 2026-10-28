import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { HINWEIS_SCHLUESSEL } from '../../../shared/spiel/hinweis.ts';
import { ausfuehren, eine, mitWeltAsync, schliesseWelt } from '../../db.ts';
import { AppFehler } from '../../fehler.ts';
import { leseHinweisAngebotGesehen } from '../einstellungen/hinweisSchluessel.ts';
import { beschreibeValidierungsfehler } from '../../validierung.ts';
import { hinweiseRouten } from './routen.ts';

const GEHEIM = 'x9f3-vapid-nicht-in-der-antwort';
const OEFFENTLICH = 'BOeffentlicherTestSchluessel';
const BETREFF = 'mailto:stride@example.com';
const ENDPUNKT = 'https://push.example/geraet-1';
const ZWEITES = 'https://push.example/geraet-2';
const P256 = 'p256-nur-in-der-tabelle';
const AUTH = 'auth-nur-in-der-tabelle';
const VAPID = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const;

const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-hinweis-routen-'));
const offen: string[] = [];
let nummer = 0;

function welt(): string {
  nummer += 1;
  const datei = path.join(ordner, `${nummer}.db`);
  offen.push(datei);
  return datei;
}

afterEach(() => {
  for (const datei of offen) {
    schliesseWelt(datei);
  }
  offen.length = 0;
});

function roh(name: string): string | undefined {
  return eine<{ wert: string }>('SELECT wert FROM einstellungen WHERE schluessel = ?', name)?.wert;
}

function xp(): number {
  return eine<{ anzahl: number }>('SELECT COUNT(*) AS anzahl FROM xp_ereignisse')?.anzahl ?? 0;
}

function aboZeile(endpoint: string): { p256dh: string; auth: string; erstelltAm: string; ungueltigAm: string | null } | undefined {
  return eine('SELECT p256dh, auth, erstellt_am AS erstelltAm, ungueltig_am AS ungueltigAm FROM push_abos WHERE endpoint = ?', endpoint);
}

async function mitRouten<T>(arbeit: (app: FastifyInstance) => Promise<T>): Promise<T> {
  const app = Fastify({ logger: false });
  app.setErrorHandler((fehler, _anfrage, antwort) => {
    if (fehler instanceof ZodError) {
      return antwort.status(400).send({ fehler: beschreibeValidierungsfehler(fehler) });
    }
    if (fehler instanceof AppFehler) {
      return antwort.status(fehler.statusCode).send({ fehler: fehler.message });
    }
    return antwort.status(500).send({ fehler: 'Interner Fehler. Details stehen im Server-Log.' });
  });
  await app.register(hinweiseRouten, { prefix: '/api' });
  try {
    return await arbeit(app);
  } finally {
    await app.close();
  }
}

async function mitVapid<T>(arbeit: () => Promise<T>): Promise<T> {
  const vorher = new Map(VAPID.map((name) => [name, process.env[name]]));
  process.env.VAPID_PUBLIC_KEY = OEFFENTLICH;
  process.env.VAPID_PRIVATE_KEY = GEHEIM;
  process.env.VAPID_SUBJECT = BETREFF;
  try {
    return await arbeit();
  } finally {
    for (const name of VAPID) {
      const wert = vorher.get(name);
      if (wert === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = wert;
      }
    }
  }
}

function ohneGeheim(text: string): void {
  expect(text).not.toContain(GEHEIM);
  expect(text).not.toContain(P256);
  expect(text).not.toContain(AUTH);
  expect(text).not.toContain(ENDPUNKT);
  expect(text.toLowerCase()).not.toContain('privat');
}

const STAND_FELDER = [
  'angebot',
  'angemeldet',
  'boss',
  'geraete',
  'oeffentlicherSchluessel',
  'rueckkehr',
  'ruheBis',
  'ruheVon',
  'streak',
];

describe('Hinweis-Routen', () => {
  it('liefert den öffentlichen Schlüssel und nie den privaten', async () => {
    await mitVapid(() =>
      mitWeltAsync(welt(), async () => {
        const vorher = xp();
        await mitRouten(async (app) => {
          const antwort = await app.inject({ method: 'GET', url: '/api/hinweise' });
          expect(antwort.statusCode).toBe(200);
          const stand = antwort.json();
          expect(Object.keys(stand).sort()).toEqual(STAND_FELDER);
          expect(stand).toEqual({
            oeffentlicherSchluessel: OEFFENTLICH,
            angemeldet: false,
            geraete: 0,
            ruheVon: '22:00',
            ruheBis: '08:00',
            streak: false,
            rueckkehr: false,
            boss: false,
            angebot: false,
          });
          expect(stand).not.toHaveProperty('faellig');
          expect(stand).not.toHaveProperty('training');
          ohneGeheim(antwort.body);
          expect(xp()).toBe(vorher);
        });
      }),
    );
  });

  it('lässt den Schlüssel null, wenn das Tripel unvollständig ist', async () => {
    const vorher = process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PUBLIC_KEY;
    try {
      await mitWeltAsync(welt(), async () => {
        await mitRouten(async (app) => {
          const antwort = await app.inject({ method: 'GET', url: '/api/hinweise' });
          expect(antwort.json().oeffentlicherSchluessel).toBeNull();
          ohneGeheim(antwort.body);
        });
      });
    } finally {
      if (vorher === undefined) {
        delete process.env.VAPID_PUBLIC_KEY;
      } else {
        process.env.VAPID_PUBLIC_KEY = vorher;
      }
    }
  });

  it('meldet ein Gerät an, lässt die Schalter beim zweiten stehen und schreibt keine XP', async () => {
    await mitVapid(() =>
      mitWeltAsync(welt(), async () => {
        const vorher = xp();
        await mitRouten(async (app) => {
          const leer = await app.inject({ method: 'PATCH', url: '/api/hinweise', payload: { streak: true } });
          expect(leer.statusCode).toBe(400);
          expect(leer.json()).toEqual({ fehler: 'Zuerst einschalten.' });
          expect(roh(HINWEIS_SCHLUESSEL.streak)).toBeUndefined();

          const erstes = await app.inject({
            method: 'POST',
            url: '/api/hinweise/abo',
            payload: { endpoint: ENDPUNKT, p256dh: P256, auth: AUTH },
          });
          expect(erstes.statusCode).toBe(201);
          expect(erstes.json()).toMatchObject({
            oeffentlicherSchluessel: OEFFENTLICH,
            angemeldet: true,
            geraete: 1,
            streak: false,
            rueckkehr: false,
            boss: false,
            angebot: false,
            ruheVon: '22:00',
            ruheBis: '08:00',
          });
          ohneGeheim(erstes.body);
          expect(roh(HINWEIS_SCHLUESSEL.streak)).toBe('false');
          expect(roh(HINWEIS_SCHLUESSEL.rueckkehr)).toBe('false');
          expect(roh(HINWEIS_SCHLUESSEL.boss)).toBe('false');
          expect(roh(HINWEIS_SCHLUESSEL.ruheVon)).toBe('"22:00"');
          expect(roh(HINWEIS_SCHLUESSEL.ruheBis)).toBe('"08:00"');
          const angelegt = aboZeile(ENDPUNKT);
          expect(angelegt?.p256dh).toBe(P256);
          expect(angelegt?.ungueltigAm).toBeNull();

          const schalter = await app.inject({
            method: 'PATCH',
            url: '/api/hinweise',
            payload: { streak: true, ruheVon: '21:00', ruheBis: '07:00' },
          });
          expect(schalter.statusCode).toBe(200);
          expect(schalter.json()).toMatchObject({ streak: true, ruheVon: '21:00', ruheBis: '07:00', geraete: 1 });
          ohneGeheim(schalter.body);

          const zweites = await app.inject({
            method: 'POST',
            url: '/api/hinweise/abo',
            payload: { endpoint: ZWEITES, p256dh: 'p256-zweites', auth: 'auth-zweites' },
          });
          expect(zweites.statusCode).toBe(201);
          expect(zweites.json()).toMatchObject({
            geraete: 2,
            streak: true,
            ruheVon: '21:00',
            ruheBis: '07:00',
          });
          expect(roh(HINWEIS_SCHLUESSEL.streak)).toBe('true');

          ausfuehren(`UPDATE push_abos SET ungueltig_am = ? WHERE endpoint = ?`, '2026-01-01T00:00:00.000Z', ENDPUNKT);
          const erneut = await app.inject({
            method: 'POST',
            url: '/api/hinweise/abo',
            payload: { endpoint: ENDPUNKT, p256dh: 'p256-neu', auth: 'auth-neu' },
          });
          expect(erneut.statusCode).toBe(201);
          expect(erneut.json().geraete).toBe(2);
          const neu = aboZeile(ENDPUNKT);
          expect(neu?.p256dh).toBe('p256-neu');
          expect(neu?.auth).toBe('auth-neu');
          expect(neu?.ungueltigAm).toBeNull();
          expect(neu?.erstelltAm).toBe(angelegt?.erstelltAm);
          expect(aboZeile(ZWEITES)?.ungueltigAm).toBeNull();
          ohneGeheim(erneut.body);
          expect(xp()).toBe(vorher);
        });
      }),
    );
  });

  it('setzt nur das genannte Gerät ab und lässt die Schalter stehen', async () => {
    await mitWeltAsync(welt(), async () => {
      const vorher = xp();
      await mitRouten(async (app) => {
        await app.inject({
          method: 'POST',
          url: '/api/hinweise/abo',
          payload: { endpoint: ENDPUNKT, p256dh: P256, auth: AUTH },
        });
        await app.inject({
          method: 'POST',
          url: '/api/hinweise/abo',
          payload: { endpoint: ZWEITES, p256dh: 'p256-zweites', auth: 'auth-zweites' },
        });
        await app.inject({ method: 'PATCH', url: '/api/hinweise', payload: { boss: true } });
        const weg = await app.inject({ method: 'DELETE', url: '/api/hinweise/abo', payload: { endpoint: ENDPUNKT } });
        expect(weg.statusCode).toBe(200);
        expect(weg.json()).toMatchObject({ angemeldet: true, geraete: 1, boss: true, angebot: false });
        expect(aboZeile(ENDPUNKT)?.ungueltigAm).not.toBeNull();
        expect(aboZeile(ZWEITES)?.ungueltigAm).toBeNull();
        ohneGeheim(weg.body);
        const letztes = await app.inject({ method: 'DELETE', url: '/api/hinweise/abo', payload: { endpoint: ZWEITES } });
        expect(letztes.json()).toMatchObject({ angemeldet: false, geraete: 0, boss: true });
        expect(roh(HINWEIS_SCHLUESSEL.boss)).toBe('true');
        const gesperrt = await app.inject({ method: 'PATCH', url: '/api/hinweise', payload: { streak: true } });
        expect(gesperrt.statusCode).toBe(400);
        expect(gesperrt.json()).toEqual({ fehler: 'Zuerst einschalten.' });
        expect(roh(HINWEIS_SCHLUESSEL.streak)).toBe('false');
        expect(xp()).toBe(vorher);
      });
    });
  });

  it('lehnt ungültige Körper ab und merkt das Angebot ohne Karte', async () => {
    await mitWeltAsync(welt(), async () => {
      await mitRouten(async (app) => {
        await app.inject({
          method: 'POST',
          url: '/api/hinweise/abo',
          payload: { endpoint: ENDPUNKT, p256dh: P256, auth: AUTH },
        });
        const http = await app.inject({
          method: 'POST',
          url: '/api/hinweise/abo',
          payload: { endpoint: 'http://push.example/klar', p256dh: P256, auth: AUTH },
        });
        expect(http.statusCode).toBe(400);
        expect(http.json().fehler).toContain('Die Adresse muss mit https:// beginnen.');
        const uhr = await app.inject({ method: 'PATCH', url: '/api/hinweise', payload: { ruheVon: '25:00' } });
        expect(uhr.statusCode).toBe(400);
        expect(uhr.json().fehler).toContain('Die Uhrzeit muss im Format HH:MM angegeben werden.');
        expect(roh(HINWEIS_SCHLUESSEL.ruheVon)).toBe('"22:00"');
        const fremd = await app.inject({ method: 'PATCH', url: '/api/hinweise', payload: { faellig: true } });
        expect(fremd.statusCode).toBe(400);
        expect(roh(HINWEIS_SCHLUESSEL.streak)).toBe('false');
        const gleich = await app.inject({
          method: 'PATCH',
          url: '/api/hinweise',
          payload: { ruheVon: '08:00', ruheBis: '08:00' },
        });
        expect(gleich.statusCode).toBe(200);
        expect(gleich.json()).toMatchObject({ ruheVon: '08:00', ruheBis: '08:00' });
        const erstes = await app.inject({ method: 'POST', url: '/api/hinweise/angebot', payload: { nie: true } });
        const zweites = await app.inject({ method: 'POST', url: '/api/hinweise/angebot', payload: { nie: true } });
        expect(erstes.statusCode).toBe(200);
        expect(erstes.json()).toEqual({ gesehen: true });
        expect(zweites.json()).toEqual({ gesehen: true });
        expect(leseHinweisAngebotGesehen()).toBe(true);
        const stand = await app.inject({ method: 'GET', url: '/api/hinweise' });
        expect(stand.json().angebot).toBe(false);
        ohneGeheim(erstes.body);
        ohneGeheim(stand.body);
      });
    });
  });
});
