import fs from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PROFILNAME_PLATZHALTER } from '../../../shared/spiel/profil.ts';
import { KONFIG } from '../../config.ts';
import { mitWelt, schliesseWelt } from '../../db.ts';
import { AppFehler } from '../../fehler.ts';
import { aendereEinstellungen, ladeEinstellungen } from '../einstellungen/einstellungen.ts';
import { googleSub, verknuepfeGoogle } from './google.ts';
import { hauptweltdatei, loescheEigenesKonto, setzeLoeschabbruchEinmal } from './konten.ts';
import { SITZUNG_COOKIE, zugangRouten } from './routen.ts';
import {
  ZUGANG,
  istAdmin,
  legeBenutzerAn,
  listeKonten,
  loeseWeltdatei,
  oeffneSitzung,
  schliesseZugang,
  setzeSperrenZurueck,
  sitzungGueltig,
  verwendeZugang,
  zugangStatus,
} from './zugang.ts';

const wurzel = mkdtempSync(path.join(tmpdir(), 'stride-kontoloesch-'));
const PASSWORT = 'geheimes-passwort';
const offen: string[] = [];
let ordner = '';

function starte(): void {
  verwendeZugang(path.join(ordner, 'zugang.db'));
}

function haupt(): string {
  return loeseWeltdatei(hauptweltdatei());
}

function oeffneWelt(relativ: string, name: string): string {
  const datei = loeseWeltdatei(relativ);
  offen.push(datei);
  mitWelt(datei, () => {
    aendereEinstellungen({ charakterName: name });
  });
  return datei;
}

function nameIn(relativ: string): string {
  return mitWelt(loeseWeltdatei(relativ), () => ladeEinstellungen().charakterName);
}

function markiereNeben(datei: string): void {
  schliesseWelt(datei);
  for (const endung of ['-wal', '-shm', '-journal']) {
    fs.writeFileSync(`${datei}${endung}`, 'x');
  }
}

function weg(datei: string): void {
  for (const endung of ['', '-wal', '-shm', '-journal']) {
    expect(fs.existsSync(`${datei}${endung}`)).toBe(false);
  }
}

function cookie(token: string): { cookie: string } {
  return { cookie: `${SITZUNG_COOKIE}=${encodeURIComponent(token)}` };
}

function cookieText(kopf: string | string[] | undefined): string {
  return Array.isArray(kopf) ? kopf.join('; ') : (kopf ?? '');
}

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

async function loesche(app: FastifyInstance, token: string, passwort: string) {
  return app.inject({
    method: 'POST',
    url: '/api/zugang/konto/loeschen',
    headers: cookie(token),
    payload: { passwort },
  });
}

beforeEach(() => {
  delete process.env.STRIDE_ADMIN;
  delete process.env.ASCEND_ADMIN;
  ordner = mkdtempSync(path.join(wurzel, 'fall-'));
  starte();
  setzeSperrenZurueck();
  setzeLoeschabbruchEinmal(false);
  expect(path.resolve(haupt())).not.toBe(path.resolve(KONFIG.datenbankPfad));
});

afterEach(() => {
  schliesseWelt(haupt());
  for (const datei of offen) {
    schliesseWelt(datei);
  }
  offen.length = 0;
  setzeLoeschabbruchEinmal(false);
  setzeSperrenZurueck();
});

afterAll(() => {
  delete process.env.STRIDE_ADMIN;
  delete process.env.ASCEND_ADMIN;
  setzeLoeschabbruchEinmal(false);
  setzeSperrenZurueck();
  schliesseZugang();
});

describe('eigenes Konto löschen', () => {
  it('entfernt ein Mitglied, seine Welt, Google und beide Sitzungen', async () => {
    const wirt = legeBenutzerAn({ benutzername: 'Wirt', passwort: PASSWORT, rolle: 'inhaber', weltdatei: 'app.db' });
    const gast = legeBenutzerAn({ benutzername: 'Gast', passwort: PASSWORT, rolle: 'mitglied', weltdatei: 'welten/gast.db' });
    const datei = oeffneWelt('welten/gast.db', 'Gast');
    markiereNeben(datei);
    oeffneWelt('app.db', 'Wirt');
    expect(verknuepfeGoogle(gast.id, 'sub-gast', 'gast@example.com')).toBe('ok');
    const wirtToken = oeffneSitzung(new Date(), wirt.id);
    const token = oeffneSitzung(new Date(), gast.id);
    const zweiter = oeffneSitzung(new Date(), gast.id);
    await mitRouten(async (app) => {
      const antwort = await loesche(app, token, PASSWORT);
      expect(antwort.statusCode).toBe(204);
      const text = cookieText(antwort.headers['set-cookie']);
      expect(text).toContain('ascend_sitzung=');
      expect(text).toContain('Max-Age=0');
    });
    expect(listeKonten().map((konto) => konto.id)).toEqual([wirt.id]);
    expect(sitzungGueltig(token)).toBe(false);
    expect(sitzungGueltig(zweiter)).toBe(false);
    expect(sitzungGueltig(wirtToken)).toBe(true);
    expect(googleSub(gast.id)).toBeNull();
    weg(datei);
    expect(fs.existsSync(haupt())).toBe(true);
    expect(nameIn('app.db')).toBe('Wirt');
  });

  it('zählt ein falsches Passwort und sperrt den neunten Versuch', async () => {
    const gast = legeBenutzerAn({ benutzername: 'Gast', passwort: PASSWORT, rolle: 'mitglied', weltdatei: 'welten/gast.db' });
    legeBenutzerAn({ benutzername: 'Wirt', passwort: PASSWORT, rolle: 'inhaber', weltdatei: 'app.db' });
    const datei = oeffneWelt('welten/gast.db', 'Gast');
    const token = oeffneSitzung(new Date(), gast.id);
    await mitRouten(async (app) => {
      for (let versuch = 0; versuch < ZUGANG.versucheMax; versuch += 1) {
        const antwort = await loesche(app, token, 'falsch');
        expect(antwort.statusCode).toBe(401);
        expect(antwort.json()).toEqual({ fehler: 'Das Passwort ist falsch.' });
      }
      const gesperrt = await loesche(app, token, PASSWORT);
      expect(gesperrt.statusCode).toBe(429);
      expect(gesperrt.json()).toEqual({ fehler: 'Zu viele Versuche. Bitte später erneut versuchen.' });
    });
    expect(listeKonten().some((konto) => konto.id === gast.id)).toBe(true);
    expect(fs.existsSync(datei)).toBe(true);
    expect(nameIn('welten/gast.db')).toBe('Gast');
  });

  it('zählt ein leeres Passwort nicht und löscht nichts', async () => {
    const gast = legeBenutzerAn({ benutzername: 'Gast', passwort: PASSWORT, rolle: 'mitglied', weltdatei: 'welten/gast.db' });
    const datei = oeffneWelt('welten/gast.db', 'Gast');
    const token = oeffneSitzung(new Date(), gast.id);
    await mitRouten(async (app) => {
      for (let versuch = 0; versuch < ZUGANG.versucheMax; versuch += 1) {
        const antwort = await loesche(app, token, '');
        expect(antwort.statusCode).toBe(400);
        expect(antwort.json()).toEqual({ fehler: 'Passwort darf nicht leer sein.' });
      }
      const falsch = await loesche(app, token, 'falsch');
      expect(falsch.statusCode).toBe(401);
    });
    expect(listeKonten().some((konto) => konto.id === gast.id)).toBe(true);
    expect(fs.existsSync(datei)).toBe(true);
  });

  it('verweigert die Route ohne Sitzung', async () => {
    legeBenutzerAn({ benutzername: 'Gast', passwort: PASSWORT, rolle: 'mitglied', weltdatei: 'welten/gast.db' });
    await mitRouten(async (app) => {
      const antwort = await app.inject({
        method: 'POST',
        url: '/api/zugang/konto/loeschen',
        payload: { passwort: PASSWORT },
      });
      expect(antwort.statusCode).toBe(401);
      expect(antwort.json()).toEqual({ fehler: 'Anmeldung erforderlich.' });
    });
  });

  it('lässt den letzten Inhaber stehen, auch wenn er Admin ist', async () => {
    process.env.STRIDE_ADMIN = 'Wirt';
    const wirt = legeBenutzerAn({ benutzername: 'Wirt', passwort: PASSWORT, rolle: 'inhaber', weltdatei: 'app.db' });
    const gast = legeBenutzerAn({ benutzername: 'Gast', passwort: PASSWORT, rolle: 'mitglied', weltdatei: 'welten/gast.db' });
    starte();
    expect(istAdmin(wirt.id)).toBe(true);
    const datei = oeffneWelt('welten/gast.db', 'Gast');
    oeffneWelt('app.db', 'Wirt');
    const token = oeffneSitzung(new Date(), wirt.id);
    await mitRouten(async (app) => {
      const antwort = await loesche(app, token, PASSWORT);
      expect(antwort.statusCode).toBe(409);
      expect(antwort.json()).toEqual({
        fehler: 'Du bist der einzige Inhaber. Solange es andere Accounts gibt, kannst du dein Konto nicht löschen.',
      });
    });
    expect(listeKonten().map((konto) => konto.id)).toEqual([wirt.id, gast.id]);
    expect(istAdmin(wirt.id)).toBe(true);
    expect(fs.existsSync(datei)).toBe(true);
    expect(nameIn('welten/gast.db')).toBe('Gast');
    expect(nameIn('app.db')).toBe('Wirt');
  });

  it('lässt ein Admin-Mitglied sich löschen', async () => {
    process.env.STRIDE_ADMIN = 'Ada';
    const wirt = legeBenutzerAn({ benutzername: 'Wirt', passwort: PASSWORT, rolle: 'inhaber', weltdatei: 'app.db' });
    const ada = legeBenutzerAn({ benutzername: 'Ada', passwort: PASSWORT, rolle: 'mitglied', weltdatei: 'welten/ada.db' });
    starte();
    expect(istAdmin(ada.id)).toBe(true);
    const datei = oeffneWelt('welten/ada.db', 'Ada');
    const token = oeffneSitzung(new Date(), ada.id);
    await mitRouten(async (app) => {
      const antwort = await loesche(app, token, PASSWORT);
      expect(antwort.statusCode).toBe(204);
    });
    expect(listeKonten().map((konto) => konto.id)).toEqual([wirt.id]);
    expect(istAdmin(ada.id)).toBe(false);
    expect(fs.existsSync(datei)).toBe(false);
  });

  it('leert beim einzigen Konto die Hauptwelt, lässt die Datei liegen und löscht nach einem Abbruch beim zweiten Mal', async () => {
    const wirt = legeBenutzerAn({ benutzername: 'Wirt', passwort: PASSWORT, rolle: 'inhaber', weltdatei: 'app.db' });
    oeffneWelt('app.db', 'Wirt');
    const token = oeffneSitzung(new Date(), wirt.id);
    setzeLoeschabbruchEinmal(true);
    await mitRouten(async (app) => {
      const abbruch = await loesche(app, token, PASSWORT);
      expect(abbruch.statusCode).toBe(500);
      expect(listeKonten().map((konto) => konto.id)).toEqual([wirt.id]);
      expect(fs.existsSync(haupt())).toBe(true);
      expect(nameIn('app.db')).toBe(PROFILNAME_PLATZHALTER);
      expect(sitzungGueltig(token)).toBe(true);
      const zweiter = await loesche(app, token, PASSWORT);
      expect(zweiter.statusCode).toBe(204);
    });
    expect(listeKonten()).toEqual([]);
    expect(fs.existsSync(haupt())).toBe(true);
    expect(nameIn('app.db')).toBe(PROFILNAME_PLATZHALTER);
    expect(sitzungGueltig(token)).toBe(false);
    expect(zugangStatus(token).modus).toBe('einrichten');
  });

  it('entfernt die eigene Datei des einzigen Kontos und leert zusätzlich die Hauptwelt', async () => {
    const wirt = legeBenutzerAn({ benutzername: 'Wirt', passwort: PASSWORT, rolle: 'inhaber', weltdatei: 'welten/solo.db' });
    const datei = oeffneWelt('welten/solo.db', 'Solo');
    markiereNeben(datei);
    oeffneWelt('app.db', 'Alt');
    const token = oeffneSitzung(new Date(), wirt.id);
    await mitRouten(async (app) => {
      const antwort = await loesche(app, token, PASSWORT);
      expect(antwort.statusCode).toBe(204);
    });
    weg(datei);
    expect(fs.existsSync(haupt())).toBe(true);
    expect(nameIn('app.db')).toBe(PROFILNAME_PLATZHALTER);
    expect(zugangStatus(undefined).modus).toBe('einrichten');
  });

  it('lässt einen zweiten Inhaber löschen und die Hauptwelt gefüllt', async () => {
    const wirt = legeBenutzerAn({ benutzername: 'Wirt', passwort: PASSWORT, rolle: 'inhaber', weltdatei: 'app.db' });
    const zweit = legeBenutzerAn({ benutzername: 'Zweit', passwort: PASSWORT, rolle: 'inhaber', weltdatei: 'app.db' });
    oeffneWelt('app.db', 'Bleibt');
    const token = oeffneSitzung(new Date(), zweit.id);
    await mitRouten(async (app) => {
      const antwort = await loesche(app, token, PASSWORT);
      expect(antwort.statusCode).toBe(204);
    });
    expect(listeKonten().map((konto) => konto.id)).toEqual([wirt.id]);
    expect(nameIn('app.db')).toBe('Bleibt');
  });

  it('behält das Entfernen fremder Accounts beim Inhaber', async () => {
    const wirt = legeBenutzerAn({ benutzername: 'Wirt', passwort: PASSWORT, rolle: 'inhaber', weltdatei: 'app.db' });
    const gast = legeBenutzerAn({ benutzername: 'Gast', passwort: PASSWORT, rolle: 'mitglied', weltdatei: 'welten/gast.db' });
    const alsGast = oeffneSitzung(new Date(), gast.id);
    const alsWirt = oeffneSitzung(new Date(), wirt.id);
    await mitRouten(async (app) => {
      const verboten = await app.inject({
        method: 'DELETE',
        url: `/api/zugang/konten/${wirt.id}`,
        headers: cookie(alsGast),
      });
      expect(verboten.statusCode).toBe(403);
      expect(verboten.json()).toEqual({ fehler: 'Nur der Inhaber entfernt Accounts.' });
      const selbst = await app.inject({
        method: 'DELETE',
        url: `/api/zugang/konten/${wirt.id}`,
        headers: cookie(alsWirt),
      });
      expect(selbst.statusCode).toBe(400);
      expect(selbst.json()).toEqual({ fehler: 'Der Inhaber bleibt.' });
    });
    expect(listeKonten()).toHaveLength(2);
  });

  it('wirft den Abbruch erst nach dem Leeren der Welt', () => {
    const wirt = legeBenutzerAn({ benutzername: 'Wirt', passwort: PASSWORT, rolle: 'inhaber', weltdatei: 'app.db' });
    oeffneWelt('app.db', 'Wirt');
    setzeLoeschabbruchEinmal(true);
    expect(() => loescheEigenesKonto(wirt.id)).toThrow('Löschen abgebrochen');
    expect(listeKonten()).toHaveLength(1);
    expect(nameIn('app.db')).toBe(PROFILNAME_PLATZHALTER);
    loescheEigenesKonto(wirt.id);
    expect(listeKonten()).toEqual([]);
  });
});
