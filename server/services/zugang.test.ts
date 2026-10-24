import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
  benutzerPasswortStimmt,
  ersetzeZugangspasswort,
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
