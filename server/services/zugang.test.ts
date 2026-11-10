import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { AppFehler } from '../fehler.ts';
import {
  SITZUNG_COOKIE,
  abmeldeCookie,
  clientAdresse,
  istOeffentlicherZugang,
  leseSitzungsToken,
  sitzungsCookie,
  verbindungIstSicher,
  zugangRouten,
} from '../features/zugang/routen.ts';
import {
  aenderePasswort,
  istEingerichtet,
  istGesperrt,
  legePasswortAn,
  merkeFehlversuch,
  benenneBenutzer,
  benutzerPasswortStimmt,
  ersetzeZugangspasswort,
  istAdmin,
  legeBenutzerAn,
  listeKonten,
  loescheBenutzer,
  oeffneSitzung,
  passwortStimmt,
  schliesseZugang,
  schliesseSitzung,
  setzeFehlversucheZurueck,
  setzeSperrenZurueck,
  sitzungGueltig,
  setzeZugangsWarnung,
  uebernimmAltesPasswort,
  verwendeZugang,
  zugangStatus,
  ZUGANG,
} from '../features/zugang/zugang.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-zugang-'));
const PASSWORT = 'geheimes-passwort';
const warnungen: string[] = [];
let datenbankNummer = 0;

function zugangPfad(): string {
  return path.join(ordner, `${datenbankNummer}.db`);
}

function starte(): void {
  verwendeZugang(zugangPfad());
}

function adminZeile(): { benutzer_id: number | null; name_norm: string } | undefined {
  const db = new DatabaseSync(zugangPfad());
  const zeile = db.prepare('SELECT benutzer_id, name_norm FROM admin_konto WHERE id = 1').get() as
    | { benutzer_id: number | null; name_norm: string }
    | undefined;
  db.close();
  return zeile;
}

function schreibeAlteBenutzer(pfad: string, namen: string[]): void {
  const db = new DatabaseSync(pfad);
  db.exec(`
    CREATE TABLE benutzer (
      id INTEGER PRIMARY KEY,
      benutzername TEXT NOT NULL,
      name_norm TEXT NOT NULL,
      salt TEXT NOT NULL,
      hash TEXT NOT NULL,
      rolle TEXT NOT NULL,
      weltdatei TEXT NOT NULL,
      geaendert_am TEXT NOT NULL
    );
  `);
  const einfuegen = db.prepare(
    `INSERT INTO benutzer (benutzername, name_norm, salt, hash, rolle, weltdatei, geaendert_am)
     VALUES (?, ?, 'salt', 'hash', 'mitglied', 'welten/x.db', '2026-01-01T00:00:00.000Z')`,
  );
  for (const name of namen) {
    einfuegen.run(name, name.trim().toLocaleLowerCase('de-DE'));
  }
  db.close();
}

function hatNamensindex(pfad: string): boolean {
  const db = new DatabaseSync(pfad);
  const zeile = db.prepare(`SELECT 1 AS da FROM sqlite_master WHERE type = 'index' AND name = 'benutzer_name_norm'`).get();
  db.close();
  return zeile !== undefined;
}

beforeEach(() => {
  warnungen.length = 0;
  setzeZugangsWarnung((text) => {
    warnungen.push(text);
  });
  delete process.env.STRIDE_ADMIN;
  delete process.env.ASCEND_ADMIN;
  delete process.env.STRIDE_REGISTRIERUNG;
  delete process.env.ASCEND_REGISTRIERUNG;
  delete process.env.STRIDE_GOOGLE;
  delete process.env.ASCEND_GOOGLE;
  delete process.env.STRIDE_GOOGLE_CLIENT_ID;
  delete process.env.ASCEND_GOOGLE_CLIENT_ID;
  delete process.env.STRIDE_GOOGLE_CLIENT_SECRET;
  delete process.env.ASCEND_GOOGLE_CLIENT_SECRET;
  datenbankNummer += 1;
  starte();
  setzeSperrenZurueck();
});

afterAll(() => {
  setzeZugangsWarnung((text) => {
    console.warn(text);
  });
  schliesseZugang();
});

describe('passwort', () => {
  it('legt ein Passwort fest und prüft es', () => {
    expect(istEingerichtet()).toBe(false);
    legePasswortAn(PASSWORT);
    expect(istEingerichtet()).toBe(true);
    expect(passwortStimmt(PASSWORT)).toBe(true);
    expect(passwortStimmt('falsches-passwort')).toBe(false);
    expect(() => legePasswortAn('anderes-passwort')).toThrow('bereits festgelegt');
  });

  it('lehnt zu kurze Passwörter ab', () => {
    expect(() => legePasswortAn('kurz')).toThrow('mindestens');
  });

  it('wechselt das Passwort und beendet andere Sitzungen', () => {
    legePasswortAn(PASSWORT);
    const bleiben = oeffneSitzung();
    const weg = oeffneSitzung();
    aenderePasswort('neues-passwort-1', bleiben);
    expect(passwortStimmt('neues-passwort-1')).toBe(true);
    expect(passwortStimmt(PASSWORT)).toBe(false);
    expect(sitzungGueltig(bleiben)).toBe(true);
    expect(sitzungGueltig(weg)).toBe(false);
  });
});

describe('accounts', () => {
  it('übernimmt das bestehende Passwort in einen Benutzernamen', () => {
    legePasswortAn(PASSWORT);
    const token = oeffneSitzung();
    uebernimmAltesPasswort('Ada', 'app.db');
    expect(zugangStatus(token)).toEqual({
      modus: 'bereit',
      benutzername: 'Ada',
      rolle: 'inhaber',
      admin: false,
      registrierung: false,
      google: false,
      googleEmail: null,
      googleAnlage: null,
      googleLoesen: false,
    });
    expect(passwortStimmt(PASSWORT)).toBe(false);
    expect(benutzerPasswortStimmt('ada', PASSWORT)?.benutzername).toBe('Ada');
  });

  it('vergibt jeden Namen nur einmal', () => {
    const ada = legeBenutzerAn({ benutzername: 'Ada', passwort: PASSWORT, rolle: 'inhaber', weltdatei: 'app.db' });
    expect(() => legeBenutzerAn({ benutzername: ' ada ', passwort: PASSWORT, rolle: 'mitglied', weltdatei: 'welten/2.db' })).toThrow(
      'schon vergeben',
    );
    expect(listeKonten().map((konto) => konto.benutzername)).toEqual(['Ada']);

    const bob = legeBenutzerAn({ benutzername: 'Bob', passwort: PASSWORT, rolle: 'mitglied', weltdatei: 'welten/3.db' });
    expect(() => benenneBenutzer(bob.id, 'ADA')).toThrow('schon vergeben');
    expect(listeKonten().find((konto) => konto.id === bob.id)?.benutzername).toBe('Bob');
    expect(listeKonten().find((konto) => konto.id === ada.id)?.benutzername).toBe('Ada');

    benenneBenutzer(bob.id, 'Berta');
    benenneBenutzer(bob.id, 'berta');
    benenneBenutzer(bob.id, 'Bert');
    expect(listeKonten().find((konto) => konto.id === bob.id)?.benutzername).toBe('Bert');
    expect(benutzerPasswortStimmt('bert', PASSWORT)?.id).toBe(bob.id);
    expect(() => benenneBenutzer(999, 'Neu')).toThrow('existiert nicht');
  });

  it('übernimmt kein Passwort auf einen vergebenen Namen', () => {
    legeBenutzerAn({ benutzername: 'Ada', passwort: PASSWORT, rolle: 'inhaber', weltdatei: 'app.db' });
    legePasswortAn('anderes-passwort-1');
    expect(() => uebernimmAltesPasswort('ada', 'app.db')).toThrow('schon vergeben');
    expect(passwortStimmt('anderes-passwort-1')).toBe(true);
    expect(listeKonten().map((konto) => konto.benutzername)).toEqual(['Ada']);
  });

  it('benennt vorhandene Doppelte nicht um', () => {
    const pfad = path.join(ordner, 'doppelt.db');
    schreibeAlteBenutzer(pfad, ['Ada', 'Ada']);
    verwendeZugang(pfad);
    schliesseZugang();
    expect(hatNamensindex(pfad)).toBe(false);

    verwendeZugang(pfad);
    const vorher = listeKonten();
    expect(vorher.map((konto) => konto.benutzername)).toEqual(['Ada', 'Ada']);
    expect(() => benenneBenutzer(vorher[1]?.id ?? 0, 'ada')).toThrow('schon vergeben');
    expect(listeKonten().map((konto) => konto.benutzername)).toEqual(['Ada', 'Ada']);
    benenneBenutzer(vorher[1]?.id ?? 0, 'Berta');
    expect(listeKonten().map((konto) => konto.benutzername)).toEqual(['Ada', 'Berta']);
    schliesseZugang();

    verwendeZugang(pfad);
    expect(() => legeBenutzerAn({ benutzername: 'ADA', passwort: PASSWORT, rolle: 'mitglied', weltdatei: 'welten/4.db' })).toThrow(
      'schon vergeben',
    );
    expect(listeKonten().map((konto) => konto.benutzername)).toEqual(['Ada', 'Berta']);
    schliesseZugang();
    expect(hatNamensindex(pfad)).toBe(true);
  });

  it('setzt das Passwort zurück, ohne das alte zu kennen', () => {
    legePasswortAn(PASSWORT);
    const token = oeffneSitzung();
    ersetzeZugangspasswort('neues-passwort-2');
    expect(passwortStimmt('neues-passwort-2')).toBe(true);
    expect(passwortStimmt(PASSWORT)).toBe(false);
    expect(sitzungGueltig(token)).toBe(false);
  });
});

describe('sitzung', () => {
  it('gilt bis zum Ablauf und verlängert sich in der zweiten Hälfte', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const offen = oeffneSitzung(start);
    expect(sitzungGueltig(offen, new Date(start.getTime() + 1000))).toBe(true);
    expect(sitzungGueltig(offen, new Date(start.getTime() + ZUGANG.sitzungMs))).toBe(false);

    const verlaengert = oeffneSitzung(start);
    const nachHalb = new Date(start.getTime() + ZUGANG.sitzungMs / 2 + 1);
    expect(sitzungGueltig(verlaengert, nachHalb)).toBe(true);
    expect(sitzungGueltig(verlaengert, new Date(nachHalb.getTime() + ZUGANG.sitzungMs - 1))).toBe(true);
  });

  it('endet beim Abmelden', () => {
    const token = oeffneSitzung();
    schliesseSitzung(token);
    expect(sitzungGueltig(token)).toBe(false);
    expect(sitzungGueltig(undefined)).toBe(false);
  });
});

describe('sperre', () => {
  it('sperrt eine Adresse und hebt die Sperre nach der Frist auf', () => {
    const jetzt = 1_000;
    for (let versuch = 0; versuch < ZUGANG.versucheMax; versuch += 1) {
      merkeFehlversuch('handy', jetzt);
    }
    expect(istGesperrt('handy', jetzt)).toBe(true);
    expect(istGesperrt('anderer-rechner', jetzt)).toBe(false);
    expect(istGesperrt('handy', jetzt + ZUGANG.sperreMs)).toBe(false);
    setzeFehlversucheZurueck('handy');
    expect(istGesperrt('handy', jetzt)).toBe(false);
  });

  it('sperrt bei zu vielen Versuchen über alle Adressen', () => {
    const jetzt = 5_000;
    for (let versuch = 0; versuch < ZUGANG.versucheGlobalMax; versuch += 1) {
      merkeFehlversuch(`adresse-${versuch}`, jetzt);
    }
    expect(istGesperrt('neu', jetzt)).toBe(true);
  });
});

describe('cookie', () => {
  it('liest nur das eigene Sitzungscookie', () => {
    expect(leseSitzungsToken(undefined)).toBeUndefined();
    expect(leseSitzungsToken('anderes=1; ascend_sitzung=abc-def')).toBe('abc-def');
    expect(leseSitzungsToken('ascend_sitzung=')).toBeUndefined();
  });

  it('setzt und löscht das Cookie', () => {
    expect(sitzungsCookie('abc', true)).toContain('Secure');
    expect(sitzungsCookie('abc', false)).not.toContain('Secure');
    expect(abmeldeCookie(true)).toContain('Max-Age=0');
  });

  it('erkennt öffentliche Wege und https hinter dem Proxy', () => {
    expect(istOeffentlicherZugang('GET', '/api/zugang')).toBe(true);
    expect(istOeffentlicherZugang('POST', '/api/zugang/abmelden?x=1')).toBe(true);
    expect(istOeffentlicherZugang('GET', '/api/uebersicht')).toBe(false);
    expect(istOeffentlicherZugang('POST', '/api/zugang/passwort')).toBe(false);
    expect(istOeffentlicherZugang('GET', '/api/gesundheit')).toBe(true);
    expect(istOeffentlicherZugang('GET', '/api/gesundheit?x=1')).toBe(true);
    expect(istOeffentlicherZugang('POST', '/api/gesundheit')).toBe(false);
    expect(istOeffentlicherZugang('GET', '/api/gesundheit/extra')).toBe(false);
    expect(verbindungIstSicher('http', 'https')).toBe(true);
    expect(verbindungIstSicher('http', 'http, https')).toBe(false);
    expect(verbindungIstSicher('https', undefined)).toBe(true);
  });

  it('nimmt die Client-Adresse vom Proxy, nicht die gespoofte', () => {
    expect(clientAdresse('127.0.0.1', { cfConnectingIp: '203.0.113.5', xForwardedFor: '1.1.1.1, 203.0.113.5' })).toBe(
      '203.0.113.5',
    );
    expect(clientAdresse('127.0.0.1', { xForwardedFor: '1.1.1.1, 203.0.113.8' })).toBe('203.0.113.8');
    expect(clientAdresse('', {})).toBe('unbekannt');
  });
});

function cookie(token: string): { cookie: string } {
  return { cookie: `${SITZUNG_COOKIE}=${encodeURIComponent(token)}` };
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

describe('admin', () => {
  it('lässt einen angemeldeten Nutzer den eigenen Namen nicht ändern', async () => {
    const ada = legeBenutzerAn({ benutzername: 'Ada', passwort: PASSWORT, rolle: 'inhaber', weltdatei: 'app.db' });
    const token = oeffneSitzung(new Date(), ada.id);
    await mitRouten(async (app) => {
      const antwort = await app.inject({
        method: 'POST',
        url: '/api/zugang/benutzername',
        headers: cookie(token),
        payload: { benutzername: 'Neu' },
      });
      expect(antwort.statusCode).toBe(403);
      expect(antwort.json()).toEqual({ fehler: 'Nur der Admin ändert Benutzernamen.' });
    });
    expect(listeKonten().find((konto) => konto.id === ada.id)?.benutzername).toBe('Ada');
  });

  it('legt den ersten Benutzernamen weiter über die Anmeldung fest', async () => {
    legePasswortAn(PASSWORT);
    const token = oeffneSitzung();
    await mitRouten(async (app) => {
      const antwort = await app.inject({
        method: 'POST',
        url: '/api/zugang/benutzername',
        headers: cookie(token),
        payload: { benutzername: 'Ada' },
      });
      expect(antwort.statusCode).toBe(200);
    });
    expect(listeKonten().map((konto) => konto.benutzername)).toEqual(['Ada']);
  });

  it('verweigert die Admin-Route ohne Admin und ändert nichts', async () => {
    process.env.STRIDE_ADMIN = 'Ada';
    const ada = legeBenutzerAn({ benutzername: 'Ada', passwort: PASSWORT, rolle: 'mitglied', weltdatei: 'app.db' });
    const bob = legeBenutzerAn({ benutzername: 'Bob', passwort: PASSWORT, rolle: 'inhaber', weltdatei: 'welten/2.db' });
    starte();
    const token = oeffneSitzung(new Date(), bob.id);
    await mitRouten(async (app) => {
      const liste = await app.inject({ method: 'GET', url: '/api/zugang/admin/konten', headers: cookie(token) });
      expect(liste.statusCode).toBe(403);
      expect(liste.body).not.toContain('Ada');
      const umbenennen = await app.inject({
        method: 'POST',
        url: `/api/zugang/admin/konten/${ada.id}/benutzername`,
        headers: { ...cookie(token), 'content-type': 'application/json' },
        payload: { benutzername: 'Carlo' },
      });
      expect(umbenennen.statusCode).toBe(403);
      const ohne = await app.inject({ method: 'GET', url: '/api/zugang/admin/konten' });
      expect(ohne.statusCode).toBe(401);
    });
    expect(listeKonten().find((konto) => konto.id === ada.id)?.benutzername).toBe('Ada');
    expect(zugangStatus(token).admin).toBe(false);
  });

  it('ändert jeden Namen nur als Admin und lässt einen vergebenen Namen stehen', async () => {
    process.env.STRIDE_ADMIN = 'ADA';
    const ada = legeBenutzerAn({ benutzername: 'Ada', passwort: PASSWORT, rolle: 'mitglied', weltdatei: 'app.db' });
    const bob = legeBenutzerAn({ benutzername: 'Bob', passwort: PASSWORT, rolle: 'mitglied', weltdatei: 'welten/3.db' });
    starte();
    const token = oeffneSitzung(new Date(), ada.id);
    expect(zugangStatus(token).admin).toBe(true);
    await mitRouten(async (app) => {
      const kopf = { ...cookie(token), 'content-type': 'application/json' };
      const selbst = await app.inject({
        method: 'POST',
        url: '/api/zugang/benutzername',
        headers: kopf,
        payload: { benutzername: 'Anders' },
      });
      expect(selbst.statusCode).toBe(403);
      const vergeben = await app.inject({
        method: 'POST',
        url: `/api/zugang/admin/konten/${bob.id}/benutzername`,
        headers: kopf,
        payload: { benutzername: ' ada ' },
      });
      expect(vergeben.statusCode).toBe(400);
      expect(vergeben.json()).toEqual({ fehler: 'Der Benutzername ist schon vergeben.' });
      const ok = await app.inject({
        method: 'POST',
        url: `/api/zugang/admin/konten/${bob.id}/benutzername`,
        headers: kopf,
        payload: { benutzername: 'Berta' },
      });
      expect(ok.statusCode).toBe(200);
      expect(ok.json()).toEqual({ id: bob.id, benutzername: 'Berta', rolle: 'mitglied', admin: false });
      const liste = await app.inject({ method: 'GET', url: '/api/zugang/admin/konten', headers: cookie(token) });
      expect(liste.statusCode).toBe(200);
      expect(liste.json()).toEqual([
        { id: ada.id, benutzername: 'Ada', rolle: 'mitglied', admin: true },
        { id: bob.id, benutzername: 'Berta', rolle: 'mitglied', admin: false },
      ]);
    });
    expect(listeKonten().find((konto) => konto.id === ada.id)?.benutzername).toBe('Ada');
    expect(listeKonten().find((konto) => konto.id === bob.id)?.benutzername).toBe('Berta');
  });

  it('bindet beim Start die ID und lässt einen anderen Namen daneben ohne Rechte', () => {
    process.env.ASCEND_ADMIN = 'Ada';
    const ada = legeBenutzerAn({ benutzername: 'Ada', passwort: PASSWORT, rolle: 'mitglied', weltdatei: 'app.db' });
    starte();
    expect(istAdmin(ada.id)).toBe(true);
    expect(adminZeile()).toEqual({ benutzer_id: ada.id, name_norm: 'ada' });
    benenneBenutzer(ada.id, 'Anders');
    const neu = legeBenutzerAn({ benutzername: 'Ada', passwort: PASSWORT, rolle: 'mitglied', weltdatei: 'welten/9.db' });
    starte();
    expect(istAdmin(ada.id)).toBe(true);
    expect(istAdmin(neu.id)).toBe(false);
    expect(adminZeile()?.benutzer_id).toBe(ada.id);
    expect(warnungen).toEqual([]);
  });

  it('bindet denselben Namen nach dem Löschen nie wieder, auch bei wiedervergebener ID', () => {
    process.env.STRIDE_ADMIN = 'Ada';
    const ada = legeBenutzerAn({ benutzername: 'Ada', passwort: PASSWORT, rolle: 'mitglied', weltdatei: 'app.db' });
    starte();
    loescheBenutzer(ada.id);
    expect(adminZeile()).toEqual({ benutzer_id: null, name_norm: 'ada' });
    const db = new DatabaseSync(zugangPfad());
    db.prepare(
      `INSERT INTO benutzer (id, benutzername, name_norm, salt, hash, rolle, weltdatei, geaendert_am)
       VALUES (?, 'Ada', 'ada', 'salt', 'hash', 'mitglied', 'app.db', '2026-01-01T00:00:00.000Z')`,
    ).run(ada.id);
    db.close();
    starte();
    expect(istAdmin(ada.id)).toBe(false);
    expect(adminZeile()).toEqual({ benutzer_id: null, name_norm: 'ada' });
    expect(warnungen).toEqual([]);
  });

  it('hängt nur einen anderen, beim Start vorhandenen Namen um', () => {
    process.env.STRIDE_ADMIN = 'Ada';
    const ada = legeBenutzerAn({ benutzername: 'Ada', passwort: PASSWORT, rolle: 'mitglied', weltdatei: 'app.db' });
    const berta = legeBenutzerAn({ benutzername: 'Berta', passwort: PASSWORT, rolle: 'mitglied', weltdatei: 'welten/8.db' });
    starte();
    loescheBenutzer(ada.id);
    process.env.STRIDE_ADMIN = 'Berta';
    starte();
    expect(istAdmin(berta.id)).toBe(true);
    expect(adminZeile()).toEqual({ benutzer_id: berta.id, name_norm: 'berta' });
    expect(warnungen).toEqual([]);
  });

  it('warnt ohne Konto und bindet eine spätere Registrierung nicht von selbst', () => {
    process.env.STRIDE_ADMIN = 'Ada';
    const ada = legeBenutzerAn({ benutzername: 'Ada', passwort: PASSWORT, rolle: 'mitglied', weltdatei: 'app.db' });
    starte();
    loescheBenutzer(ada.id);
    process.env.STRIDE_ADMIN = 'Berta';
    starte();
    expect(adminZeile()).toEqual({ benutzer_id: null, name_norm: 'ada' });
    expect(warnungen).toEqual([
      'Admin-Konto nicht gebunden: zum Namen „berta“ gibt es kein Konto. Es wird auch später nicht automatisch gebunden.',
    ]);
    expect(warnungen[0]).not.toContain('STRIDE');
    expect(warnungen[0]).not.toContain('ASCEND');
    const berta = legeBenutzerAn({ benutzername: 'Berta', passwort: PASSWORT, rolle: 'mitglied', weltdatei: 'welten/8.db' });
    expect(istAdmin(berta.id)).toBe(false);
    expect(adminZeile()?.benutzer_id).toBeNull();
    starte();
    expect(istAdmin(berta.id)).toBe(true);
    expect(adminZeile()).toEqual({ benutzer_id: berta.id, name_norm: 'berta' });
  });

  it('versucht das erste Binden beim nächsten Start erneut, ohne zu warnen', () => {
    process.env.STRIDE_ADMIN = 'Ada';
    starte();
    expect(adminZeile()).toBeUndefined();
    expect(warnungen).toEqual([]);
    const ada = legeBenutzerAn({ benutzername: 'Ada', passwort: PASSWORT, rolle: 'inhaber', weltdatei: 'app.db' });
    expect(istAdmin(ada.id)).toBe(false);
    starte();
    expect(istAdmin(ada.id)).toBe(true);
    expect(warnungen).toEqual([]);
  });
});
