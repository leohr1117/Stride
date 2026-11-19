import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ZUSTIMMUNG_FEHLT, RECHT_FASSUNG } from '../../../shared/recht/fassung.ts';
import { setzeRegistrierungenZurueck } from '../../anfrageGrenzen.ts';
import { AppFehler } from '../../fehler.ts';
import { istOeffentlicherZugang, leseSitzungsToken, SITZUNG_COOKIE, zugangRouten } from './routen.ts';
import {
  legeBenutzerAn,
  liesZustimmung,
  listeKonten,
  merkeZustimmung,
  schliesseZugang,
  setzeSperrenZurueck,
  setzeZustimmungsFassung,
  verwendeZugang,
} from './zugang.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-zustimmung-'));
const PASSWORT = 'geheimes-passwort';
let nummer = 0;

function schalter(an: boolean): void {
  delete process.env.STRIDE_REGISTRIERUNG;
  delete process.env.ASCEND_REGISTRIERUNG;
  if (an) {
    process.env.STRIDE_REGISTRIERUNG = '1';
  }
}

beforeEach(() => {
  delete process.env.STRIDE_ADMIN;
  delete process.env.ASCEND_ADMIN;
  schalter(false);
  nummer += 1;
  verwendeZugang(path.join(ordner, `${nummer}.db`));
  setzeSperrenZurueck();
  setzeRegistrierungenZurueck();
});

afterAll(() => {
  schalter(false);
  schliesseZugang();
});

async function mitRouten<T>(arbeit: (app: FastifyInstance) => Promise<T>): Promise<T> {
  const app = Fastify({ logger: false });
  app.setErrorHandler((fehler, _anfrage, antwort) => {
    if (fehler instanceof ZodError) {
      return antwort.status(400).send({ fehler: fehler.message });
    }
    if (fehler instanceof AppFehler) {
      return antwort.status(fehler.statusCode).send({ fehler: fehler.message });
    }
    return antwort.status(500).send({ fehler: 'Interner Fehler. Details stehen im Server-Log.' });
  });
  await app.register(zugangRouten, { prefix: '/api' });
  try {
    return await arbeit(app);
  } finally {
    await app.close();
  }
}

describe('zustimmung', () => {
  it('legt ohne Haken kein Konto an und speichert Zeitpunkt und Fassung mit Haken', async () => {
    legeBenutzerAn({ benutzername: 'Ada', passwort: PASSWORT, rolle: 'inhaber', weltdatei: 'app.db' });
    schalter(true);
    await mitRouten(async (app) => {
      const ohne = await app.inject({
        method: 'POST',
        url: '/api/zugang/registrieren',
        payload: { benutzername: 'Ohne', passwort: PASSWORT },
      });
      const falsch = await app.inject({
        method: 'POST',
        url: '/api/zugang/registrieren',
        payload: { benutzername: 'Falsch', passwort: PASSWORT, zustimmung: 'ja' },
      });
      expect(ohne.statusCode).toBe(400);
      expect(falsch.statusCode).toBe(400);
      expect(ohne.json()).toEqual({ fehler: ZUSTIMMUNG_FEHLT });
      expect(falsch.json()).toEqual({ fehler: ZUSTIMMUNG_FEHLT });
      const antwort = await app.inject({
        method: 'POST',
        url: '/api/zugang/registrieren',
        payload: { benutzername: 'Neu', passwort: PASSWORT, zustimmung: true },
      });
      expect(antwort.statusCode).toBe(200);
      expect(antwort.json()).toMatchObject({ modus: 'bereit', benutzername: 'Neu', zustimmungAktuell: true });
      const ada = await app.inject({
        method: 'POST',
        url: '/api/zugang',
        payload: { benutzername: 'Ada', passwort: PASSWORT },
      });
      expect(ada.json()).toMatchObject({ benutzername: 'Ada', zustimmungAktuell: true });
    });
    expect(listeKonten().map((konto) => konto.benutzername)).toEqual(['Ada', 'Neu']);
    const ada = listeKonten().find((konto) => konto.benutzername === 'Ada');
    const neu = listeKonten().find((konto) => konto.benutzername === 'Neu');
    expect(liesZustimmung(ada?.id ?? 0)).toEqual({ fassung: null, am: null });
    const gespeichert = liesZustimmung(neu?.id ?? 0);
    expect(gespeichert?.fassung).toBe(RECHT_FASSUNG);
    expect(gespeichert?.am).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('schreibt den übergebenen Zeitpunkt', () => {
    const id = legeBenutzerAn({ benutzername: 'Ada', passwort: PASSWORT, rolle: 'inhaber', weltdatei: 'app.db' }).id;
    merkeZustimmung(id, new Date('2026-11-18T15:04:05.000Z'));
    expect(liesZustimmung(id)).toEqual({ fassung: RECHT_FASSUNG, am: '2026-11-18T15:04:05.000Z' });
  });

  it('fragt nach der Anmeldung nur bei abweichender Fassung und speichert die neue', async () => {
    const id = legeBenutzerAn({
      benutzername: 'Neu',
      passwort: PASSWORT,
      rolle: 'mitglied',
      weltdatei: 'welten/2.db',
      zustimmung: new Date('2026-11-18T08:00:00.000Z'),
    }).id;
    setzeZustimmungsFassung(id, '2000-01-01');
    expect(istOeffentlicherZugang('POST', '/api/zugang/zustimmung')).toBe(false);
    await mitRouten(async (app) => {
      const login = await app.inject({
        method: 'POST',
        url: '/api/zugang',
        payload: { benutzername: 'Neu', passwort: PASSWORT },
      });
      expect(login.statusCode).toBe(200);
      expect(login.json()).toMatchObject({ zustimmungAktuell: false });
      const token = leseSitzungsToken(login.headers['set-cookie']);
      const gast = await app.inject({
        method: 'POST',
        url: '/api/zugang/zustimmung',
        payload: { zustimmung: true },
      });
      expect(gast.statusCode).toBe(401);
      const nein = await app.inject({
        method: 'POST',
        url: '/api/zugang/zustimmung',
        headers: { cookie: `${SITZUNG_COOKIE}=${token}` },
        payload: { zustimmung: false },
      });
      expect(nein.statusCode).toBe(400);
      expect(nein.json()).toEqual({ fehler: ZUSTIMMUNG_FEHLT });
      expect(liesZustimmung(id)?.fassung).toBe('2000-01-01');
      const ja = await app.inject({
        method: 'POST',
        url: '/api/zugang/zustimmung',
        headers: { cookie: `${SITZUNG_COOKIE}=${token}` },
        payload: { zustimmung: true },
      });
      expect(ja.statusCode).toBe(200);
      expect(ja.json()).toMatchObject({ benutzername: 'Neu', zustimmungAktuell: true });
    });
    expect(liesZustimmung(id)).toMatchObject({ fassung: RECHT_FASSUNG });
    expect(liesZustimmung(id)?.am).not.toBe('2026-11-18T08:00:00.000Z');
  });
});
