import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { REGISTRIERUNG_GRENZE, setzeRegistrierungenZurueck } from '../../anfrageGrenzen.ts';
import { AppFehler } from '../../fehler.ts';
import { istOeffentlicherZugang, leseSitzungsToken, zugangRouten } from './routen.ts';
import {
  ZUGANG,
  legeBenutzerAn,
  legePasswortAn,
  listeKonten,
  schliesseZugang,
  setzeSperrenZurueck,
  sitzungGueltig,
  verwendeZugang,
} from './zugang.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-registrieren-'));
const PASSWORT = 'geheimes-passwort';
const NAME_VERGEBEN = 'Der Benutzername ist schon vergeben. Wähle einen anderen.';
const UNBEKANNT = 'Unbekannter Pfad: POST /api/zugang/registrieren';
let nummer = 0;

function schalter(wert: string | undefined): void {
  delete process.env.STRIDE_REGISTRIERUNG;
  delete process.env.ASCEND_REGISTRIERUNG;
  if (wert !== undefined) {
    process.env.STRIDE_REGISTRIERUNG = wert;
  }
}

beforeEach(() => {
  delete process.env.STRIDE_ADMIN;
  delete process.env.ASCEND_ADMIN;
  schalter(undefined);
  nummer += 1;
  verwendeZugang(path.join(ordner, `${nummer}.db`));
  setzeSperrenZurueck();
  setzeRegistrierungenZurueck();
});

afterAll(() => {
  schalter(undefined);
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

function inhaber(name = 'Ada'): void {
  legeBenutzerAn({ benutzername: name, passwort: PASSWORT, rolle: 'inhaber', weltdatei: 'app.db' });
}

describe('registrieren', () => {
  it('bleibt aus, solange der Schalter nicht 1 ist', async () => {
    expect(istOeffentlicherZugang('POST', '/api/zugang/registrieren')).toBe(true);
    inhaber();
    await mitRouten(async (app) => {
      for (const wert of [undefined, '0', 'true', '']) {
        schalter(wert);
        const status = await app.inject({ method: 'GET', url: '/api/zugang' });
        expect(status.json()).toMatchObject({ modus: 'anmelden', registrierung: false });
        const antwort = await app.inject({
          method: 'POST',
          url: '/api/zugang/registrieren',
          payload: { benutzername: 'Neu', passwort: PASSWORT },
        });
        expect(antwort.statusCode).toBe(404);
        expect(antwort.json()).toEqual({ fehler: UNBEKANNT });
      }
    });
    expect(listeKonten().map((konto) => konto.benutzername)).toEqual(['Ada']);
  });

  it('legt mit Schalter 1 ein Mitglied an, ignoriert die Rolle und öffnet die Sitzung', async () => {
    inhaber();
    schalter('1');
    await mitRouten(async (app) => {
      const antwort = await app.inject({
        method: 'POST',
        url: '/api/zugang/registrieren',
        payload: { benutzername: ' Neu ', passwort: PASSWORT, rolle: 'inhaber', profilname: 'Fremd' },
      });
      expect(antwort.statusCode).toBe(200);
      expect(antwort.json()).toMatchObject({
        modus: 'bereit',
        benutzername: 'Neu',
        rolle: 'mitglied',
        admin: false,
        registrierung: true,
      });
      const kopf = antwort.headers['set-cookie'];
      const text = Array.isArray(kopf) ? kopf.join('; ') : (kopf ?? '');
      expect(text).toContain('ascend_sitzung=');
      expect(sitzungGueltig(leseSitzungsToken(kopf))).toBe(true);
    });
    expect(listeKonten().map((konto) => ({ name: konto.benutzername, rolle: konto.rolle }))).toEqual([
      { name: 'Ada', rolle: 'inhaber' },
      { name: 'Neu', rolle: 'mitglied' },
    ]);
  });

  it('lehnt den Admin-Namen und einen vergebenen Namen mit demselben Text ab', async () => {
    process.env.STRIDE_ADMIN = 'Wirt';
    inhaber();
    schalter('1');
    await mitRouten(async (app) => {
      const admin = await app.inject({
        method: 'POST',
        url: '/api/zugang/registrieren',
        payload: { benutzername: ' wirt ', passwort: PASSWORT },
      });
      const vergeben = await app.inject({
        method: 'POST',
        url: '/api/zugang/registrieren',
        payload: { benutzername: 'ADA', passwort: PASSWORT },
      });
      expect(admin.statusCode).toBe(400);
      expect(vergeben.statusCode).toBe(400);
      expect(admin.json()).toEqual({ fehler: NAME_VERGEBEN });
      expect(vergeben.json()).toEqual({ fehler: NAME_VERGEBEN });
    });
    expect(listeKonten().map((konto) => konto.benutzername)).toEqual(['Ada']);
  });

  it('lehnt ein zu kurzes Passwort ab', async () => {
    inhaber();
    schalter('1');
    await mitRouten(async (app) => {
      const antwort = await app.inject({
        method: 'POST',
        url: '/api/zugang/registrieren',
        payload: { benutzername: 'Kurz', passwort: 'kurz' },
      });
      expect(antwort.statusCode).toBe(400);
      expect(antwort.json()).toEqual({ fehler: 'Das Passwort muss mindestens 10 Zeichen haben.' });
    });
    expect(listeKonten().map((konto) => konto.benutzername)).toEqual(['Ada']);
  });

  it('begrenzt die Registrierung je Adresse, eine Anmeldung setzt sie nicht zurück', async () => {
    const vorher = process.env.STRIDE_TEST;
    delete process.env.STRIDE_TEST;
    inhaber();
    schalter('1');
    const adresse = { 'x-forwarded-for': '198.51.100.10' };
    try {
      await mitRouten(async (app) => {
        const angelegt = await app.inject({
          method: 'POST',
          url: '/api/zugang/registrieren',
          headers: adresse,
          payload: { benutzername: 'Neu', passwort: PASSWORT },
        });
        expect(angelegt.statusCode).toBe(200);
        for (let versuch = 1; versuch < REGISTRIERUNG_GRENZE.jeStunde; versuch += 1) {
          const falsch = await app.inject({
            method: 'POST',
            url: '/api/zugang/registrieren',
            headers: adresse,
            payload: { benutzername: `Weiter${versuch}`, passwort: 'kurz' },
          });
          expect(falsch.statusCode).toBe(400);
        }
        const stopp = await app.inject({
          method: 'POST',
          url: '/api/zugang/registrieren',
          headers: adresse,
          payload: { benutzername: 'Noch', passwort: PASSWORT },
        });
        expect(stopp.statusCode).toBe(429);
        expect(stopp.json()).toEqual({ fehler: 'Zu viele Versuche. Bitte später erneut versuchen.' });
        const login = await app.inject({
          method: 'POST',
          url: '/api/zugang',
          headers: adresse,
          payload: { benutzername: 'Ada', passwort: PASSWORT },
        });
        expect(login.statusCode).toBe(200);
        const danach = await app.inject({
          method: 'POST',
          url: '/api/zugang/registrieren',
          headers: adresse,
          payload: { benutzername: 'ImmerNoch', passwort: PASSWORT },
        });
        expect(danach.statusCode).toBe(429);
        const andere = await app.inject({
          method: 'POST',
          url: '/api/zugang/registrieren',
          headers: { 'x-forwarded-for': '198.51.100.11' },
          payload: { benutzername: 'Fremd', passwort: 'kurz' },
        });
        expect(andere.statusCode).toBe(400);
        const falsch = await app.inject({
          method: 'POST',
          url: '/api/zugang',
          headers: adresse,
          payload: { benutzername: 'Ada', passwort: 'falsch-falsch' },
        });
        expect(falsch.statusCode).toBe(401);
      });
    } finally {
      if (vorher === undefined) {
        delete process.env.STRIDE_TEST;
      } else {
        process.env.STRIDE_TEST = vorher;
      }
    }
    expect(listeKonten().map((konto) => konto.benutzername)).toEqual(['Ada', 'Neu']);
  });

  it('bremst die Registrierung im Testmodus nicht', async () => {
    const vorher = process.env.STRIDE_TEST;
    process.env.STRIDE_TEST = '1';
    inhaber();
    schalter('1');
    try {
      await mitRouten(async (app) => {
        for (let versuch = 0; versuch < REGISTRIERUNG_GRENZE.jeStunde + 1; versuch += 1) {
          const antwort = await app.inject({
            method: 'POST',
            url: '/api/zugang/registrieren',
            headers: { 'x-forwarded-for': '198.51.100.40' },
            payload: { benutzername: `Test${versuch}`, passwort: 'kurz' },
          });
          expect(antwort.statusCode).toBe(400);
        }
      });
    } finally {
      if (vorher === undefined) {
        delete process.env.STRIDE_TEST;
      } else {
        process.env.STRIDE_TEST = vorher;
      }
    }
  });

  it('sperrt die Anmeldung nach Fehlversuchen und ignoriert Registrierungen', async () => {
    inhaber();
    schalter('1');
    const adresse = { 'x-forwarded-for': '198.51.100.20' };
    await mitRouten(async (app) => {
      for (let versuch = 0; versuch < REGISTRIERUNG_GRENZE.jeStunde; versuch += 1) {
        const registriert = await app.inject({
          method: 'POST',
          url: '/api/zugang/registrieren',
          headers: adresse,
          payload: { benutzername: `Gast${versuch}`, passwort: 'kurz' },
        });
        expect(registriert.statusCode).toBe(400);
      }
      for (let versuch = 0; versuch < ZUGANG.versucheMax - 1; versuch += 1) {
        const falsch = await app.inject({
          method: 'POST',
          url: '/api/zugang',
          headers: adresse,
          payload: { benutzername: 'Ada', passwort: 'falsch-falsch' },
        });
        expect(falsch.statusCode).toBe(401);
      }
      const stopp = await app.inject({
        method: 'POST',
        url: '/api/zugang',
        headers: adresse,
        payload: { benutzername: 'Ada', passwort: 'falsch-falsch' },
      });
      expect(stopp.statusCode).toBe(429);
      expect(stopp.json()).toEqual({ fehler: 'Zu viele Versuche. Bitte später erneut versuchen.' });
      const andere = await app.inject({
        method: 'POST',
        url: '/api/zugang',
        headers: { 'x-forwarded-for': '198.51.100.21' },
        payload: { benutzername: 'Ada', passwort: 'falsch-falsch' },
      });
      expect(andere.statusCode).toBe(401);
    });
  });

  it('antwortet mit 404, wenn der Modus nicht anmelden ist', async () => {
    schalter('1');
    await mitRouten(async (app) => {
      const leer = await app.inject({
        method: 'POST',
        url: '/api/zugang/registrieren',
        payload: { benutzername: 'Neu', passwort: PASSWORT },
      });
      expect(leer.statusCode).toBe(404);
      expect(leer.json()).toEqual({ fehler: UNBEKANNT });
      expect((await app.inject({ method: 'GET', url: '/api/zugang' })).json()).toMatchObject({
        modus: 'einrichten',
        registrierung: true,
      });
      legePasswortAn(PASSWORT);
      const passwort = await app.inject({
        method: 'POST',
        url: '/api/zugang/registrieren',
        payload: { benutzername: 'Neu', passwort: PASSWORT },
      });
      expect(passwort.statusCode).toBe(404);
      expect((await app.inject({ method: 'GET', url: '/api/zugang' })).json()).toMatchObject({
        modus: 'passwort',
        registrierung: true,
      });
    });
    expect(listeKonten()).toEqual([]);
  });
});
