import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance, type InjectOptions, type LightMyRequestResponse } from 'fastify';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ANFRAGE_GRENZE, ZU_VIELE, setzeRegistrierungenZurueck } from './anfrageGrenzen.ts';
import { registriereAnfrageGrenze } from './anfrageGrenze.ts';
import { AppFehler } from './fehler.ts';
import { SITZUNG_COOKIE } from './features/zugang/routen.ts';
import { legeBenutzerAn, oeffneSitzung, schliesseZugang, setzeSperrenZurueck, verwendeZugang } from './features/zugang/zugang.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-anfrage-'));
const PASSWORT = 'geheimes-passwort';
let nummer = 0;

beforeEach(() => {
  nummer += 1;
  verwendeZugang(path.join(ordner, `${nummer}.db`));
  setzeSperrenZurueck();
  setzeRegistrierungenZurueck();
});

afterAll(() => {
  schliesseZugang();
});

function stelleTestmodus(wert: string | undefined): () => void {
  const vorher = process.env.STRIDE_TEST;
  if (wert === undefined) {
    delete process.env.STRIDE_TEST;
  } else {
    process.env.STRIDE_TEST = wert;
  }
  return () => {
    if (vorher === undefined) {
      delete process.env.STRIDE_TEST;
    } else {
      process.env.STRIDE_TEST = vorher;
    }
  };
}

async function baueApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, trustProxy: true });
  app.setErrorHandler((fehler, _anfrage, antwort) => {
    if (fehler instanceof AppFehler) {
      return antwort.status(fehler.statusCode).send({ fehler: fehler.message });
    }
    return antwort.status(500).send({ fehler: 'Interner Fehler. Details stehen im Server-Log.' });
  });
  await app.register(
    async (api) => {
      await registriereAnfrageGrenze(api);
      api.get('/ping', async () => ({ ok: true }));
    },
    { prefix: '/api' },
  );
  app.get('/statisch', async () => ({ datei: true }));
  return app;
}

async function hole(app: FastifyInstance, url: string, headers?: InjectOptions['headers']): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'GET', url, headers });
}

async function fuelle(
  app: FastifyInstance,
  url: string,
  anzahl: number,
  headers?: InjectOptions['headers'],
): Promise<LightMyRequestResponse> {
  let letzte: LightMyRequestResponse | undefined;
  for (let index = 0; index < anzahl; index += 1) {
    letzte = await hole(app, url, headers);
    expect(letzte.statusCode).toBe(200);
  }
  if (!letzte) {
    throw new Error('Keine Anfrage.');
  }
  return letzte;
}

function cookieFuer(name: string, weltdatei: string): string {
  const konto = legeBenutzerAn({ benutzername: name, passwort: PASSWORT, rolle: 'mitglied', weltdatei });
  const token = oeffneSitzung(new Date(), konto.id);
  return `${SITZUNG_COOKIE}=${encodeURIComponent(token)}`;
}

function kopfWert(antwort: LightMyRequestResponse, name: string): string {
  const wert = antwort.headers[name];
  if (Array.isArray(wert)) {
    return String(wert[0] ?? '');
  }
  return wert === undefined ? '' : String(wert);
}

describe('Anfragegrenze', () => {
  it('antwortet über der Grenze mit 429, ZU_VIELE und Retry-After und trennt Adressen', async () => {
    const zurueck = stelleTestmodus(undefined);
    const app = await baueApp();
    const gleiche = { 'x-forwarded-for': '1.1.1.1, 203.0.113.8' };
    const alias = { 'x-forwarded-for': '9.9.9.9, 203.0.113.8' };
    const andere = { 'x-forwarded-for': '1.1.1.1, 203.0.113.9' };
    const cloudflare = { 'cf-connecting-ip': '198.51.100.4', 'x-forwarded-for': '1.1.1.1, 203.0.113.8' };
    try {
      const erste = await hole(app, '/api/ping', gleiche);
      expect(erste.statusCode).toBe(200);
      expect(Number(kopfWert(erste, 'x-ratelimit-limit'))).toBe(ANFRAGE_GRENZE.jeMinuteAdresse);
      await fuelle(app, '/api/ping', ANFRAGE_GRENZE.jeMinuteAdresse - 1, gleiche);
      const stopp = await hole(app, '/api/ping', alias);
      expect(stopp.statusCode).toBe(429);
      expect(stopp.json()).toEqual({ fehler: ZU_VIELE });
      expect(Number(kopfWert(stopp, 'retry-after'))).toBeGreaterThan(0);
      expect((await hole(app, '/api/ping', andere)).statusCode).toBe(200);
      expect((await hole(app, '/api/ping', cloudflare)).statusCode).toBe(200);
      expect((await hole(app, '/api/ping')).statusCode).toBe(200);
    } finally {
      await app.close();
      zurueck();
    }
  }, 60_000);

  it('zählt angemeldete Konten getrennt von der Adresse und voneinander', async () => {
    const zurueck = stelleTestmodus(undefined);
    const app = await baueApp();
    const adresse = { 'cf-connecting-ip': '203.0.113.50' };
    const ada = { ...adresse, cookie: cookieFuer('Ada', 'app.db') };
    const bob = { ...adresse, cookie: cookieFuer('Bob', 'welten/2.db') };
    try {
      await fuelle(app, '/api/ping', ANFRAGE_GRENZE.jeMinuteAdresse, adresse);
      expect((await hole(app, '/api/ping', adresse)).statusCode).toBe(429);
      const erste = await hole(app, '/api/ping', ada);
      expect(erste.statusCode).toBe(200);
      expect(Number(kopfWert(erste, 'x-ratelimit-limit'))).toBe(ANFRAGE_GRENZE.jeMinuteKonto);
      await fuelle(app, '/api/ping', ANFRAGE_GRENZE.jeMinuteKonto - 1, ada);
      const stopp = await hole(app, '/api/ping', ada);
      expect(stopp.statusCode).toBe(429);
      expect(stopp.json()).toEqual({ fehler: ZU_VIELE });
      expect((await hole(app, '/api/ping', bob)).statusCode).toBe(200);
    } finally {
      await app.close();
      zurueck();
    }
  }, 60_000);

  it('begrenzt statische Dateien nicht und lässt sie die API-Grenze nicht verbrauchen', async () => {
    const zurueck = stelleTestmodus(undefined);
    const app = await baueApp();
    const adresse = { 'x-forwarded-for': '203.0.113.70' };
    try {
      await fuelle(app, '/statisch', ANFRAGE_GRENZE.jeMinuteAdresse + 1, adresse);
      const api = await hole(app, '/api/ping', adresse);
      expect(api.statusCode).toBe(200);
      expect(Number(kopfWert(api, 'x-ratelimit-limit'))).toBe(ANFRAGE_GRENZE.jeMinuteAdresse);
    } finally {
      await app.close();
      zurueck();
    }
  }, 60_000);

  it('bremst im Testmodus nicht', async () => {
    const zurueck = stelleTestmodus('1');
    const app = await baueApp();
    const adresse = { 'x-forwarded-for': '203.0.113.80' };
    try {
      const letzte = await fuelle(app, '/api/ping', ANFRAGE_GRENZE.jeMinuteAdresse + 1, adresse);
      expect(letzte.statusCode).toBe(200);
      expect(Number(kopfWert(letzte, 'x-ratelimit-limit'))).toBe(ANFRAGE_GRENZE.testJeMinute);
    } finally {
      await app.close();
      zurueck();
    }
  }, 60_000);
});
