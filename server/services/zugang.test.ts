import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  abmeldeCookie,
  clientAdresse,
  istOeffentlicherZugang,
  leseSitzungsToken,
  sitzungsCookie,
  verbindungIstSicher,
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
  legeBenutzerAn,
  listeKonten,
  oeffneSitzung,
  passwortStimmt,
  schliesseZugang,
  schliesseSitzung,
  setzeFehlversucheZurueck,
  setzeSperrenZurueck,
  sitzungGueltig,
  uebernimmAltesPasswort,
  verwendeZugang,
  zugangStatus,
  ZUGANG,
} from '../features/zugang/zugang.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-zugang-'));
const PASSWORT = 'geheimes-passwort';
let datenbankNummer = 0;

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
  datenbankNummer += 1;
  verwendeZugang(path.join(ordner, `${datenbankNummer}.db`));
  setzeSperrenZurueck();
});

afterAll(() => {
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
    expect(zugangStatus(token)).toEqual({ modus: 'bereit', benutzername: 'Ada', rolle: 'inhaber' });
    expect(passwortStimmt(PASSWORT)).toBe(false);
    expect(benutzerPasswortStimmt('ada', PASSWORT)?.benutzername).toBe('Ada');
  });

  it('vergibt jeden Namen nur einmal und lässt den eigenen jederzeit ändern', () => {
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
