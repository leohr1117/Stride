import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, describe, expect, it } from 'vitest';
import { erstelleMitglied } from './konten.ts';
import { datenordner, legeBenutzerAn, listeKonten, loeseWeltdatei, schliesseZugang, verwendeZugang } from './zugang.ts';
import { migriereWeltdateien, neutralisiereWeltdatei, speichereWeltdatei } from './weltdateiPfad.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-weltdatei-'));
const PASSWORT = 'geheimes-passwort';

function tabelle(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE benutzer (
      id INTEGER PRIMARY KEY,
      weltdatei TEXT NOT NULL
    );
    CREATE TABLE zaehler (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      n INTEGER NOT NULL
    );
    INSERT INTO zaehler (id, n) VALUES (1, 0);
    CREATE TRIGGER weltdatei_schreiben AFTER UPDATE ON benutzer
    BEGIN
      UPDATE zaehler SET n = n + 1 WHERE id = 1;
    END;
  `);
  return db;
}

function lege(db: DatabaseSync, id: number, weltdatei: string): void {
  db.prepare('INSERT INTO benutzer (id, weltdatei) VALUES (?, ?)').run(id, weltdatei);
}

function pfade(db: DatabaseSync): string[] {
  return (db.prepare('SELECT weltdatei FROM benutzer ORDER BY id').all() as { weltdatei: string }[]).map((zeile) => zeile.weltdatei);
}

function schreibzahl(db: DatabaseSync): number {
  const zeile = db.prepare('SELECT n FROM zaehler WHERE id = 1').get() as { n: number };
  return Number(zeile.n);
}

describe('weltdatei', () => {
  afterAll(() => {
    schliesseZugang();
  });

  it('macht Windows- und Linux-Pfade relativ mit Schrägstrich', () => {
    const faelle: [string, string, string][] = [
      ['C:\\daten', 'welten\\3.db', 'welten/3.db'],
      ['C:\\daten', 'welten\\unter/4.db', 'welten/unter/4.db'],
      ['C:\\daten', 'C:\\daten\\welten\\3.db', 'welten/3.db'],
      ['C:\\daten', 'C:/daten/welten/3.db', 'welten/3.db'],
      ['C:\\daten', 'c:\\Daten\\app.db', 'app.db'],
      ['C:\\daten\\', 'C:\\daten\\welten\\..\\app.db', 'app.db'],
      ['\\\\server\\share\\data', '\\\\server\\share\\data\\welten\\3.db', 'welten/3.db'],
      ['/daten', 'welten/3.db', 'welten/3.db'],
      ['/daten', 'welten\\3.db', 'welten/3.db'],
      ['/daten', '/daten/welten/3.db', 'welten/3.db'],
      ['/daten/', 'app.db', 'app.db'],
    ];
    for (const [daten, gespeichert, erwartet] of faelle) {
      expect(neutralisiereWeltdatei(gespeichert, daten)).toBe(erwartet);
      expect(neutralisiereWeltdatei(erwartet, daten)).toBe(erwartet);
    }
    expect(speichereWeltdatei('welten', '3.db')).toBe('welten/3.db');
  });

  it('lehnt Pfade außerhalb ab, auf Windows und auf Linux', () => {
    const draussen: [string, string][] = [
      ['C:\\daten', 'D:\\fremd\\3.db'],
      ['C:\\daten', 'C:\\daten-alt\\3.db'],
      ['C:\\daten', 'C:\\daten\\..\\fremd\\3.db'],
      ['C:\\daten', '/daten/welten/3.db'],
      ['\\\\server\\share\\data', '\\\\other\\share\\data\\welten\\3.db'],
      ['/daten', '/fremd/3.db'],
      ['/daten', '/daten-alt/3.db'],
      ['/daten', '/Daten/welten/3.db'],
      ['/daten', 'C:\\daten\\welten\\3.db'],
      ['/daten', 'welten/../3.db'],
      ['C:\\daten', ''],
      ['/daten', '..'],
    ];
    for (const [daten, gespeichert] of draussen) {
      expect(() => neutralisiereWeltdatei(gespeichert, daten)).toThrow(/außerhalb des Datenordners/);
    }
    expect(() => speichereWeltdatei('welten', '..', '3.db')).toThrow(/außerhalb des Datenordners/);
  });

  it('stellt Windows- und Linux-Bestand um und schreibt beim zweiten Lauf nicht', () => {
    const windows = tabelle();
    lege(windows, 1, 'welten\\1.db');
    lege(windows, 2, 'C:\\daten\\welten\\2.db');
    lege(windows, 3, 'app.db');
    lege(windows, 4, 'welten/4.db');
    migriereWeltdateien(windows, 'C:\\daten');
    expect(pfade(windows)).toEqual(['welten/1.db', 'welten/2.db', 'app.db', 'welten/4.db']);
    expect(schreibzahl(windows)).toBe(2);
    windows.prepare('UPDATE zaehler SET n = 0 WHERE id = 1').run();
    migriereWeltdateien(windows, 'C:\\daten');
    expect(pfade(windows)).toEqual(['welten/1.db', 'welten/2.db', 'app.db', 'welten/4.db']);
    expect(schreibzahl(windows)).toBe(0);
    windows.close();

    const linux = tabelle();
    lege(linux, 1, 'welten\\1.db');
    lege(linux, 2, '/daten/welten/2.db');
    lege(linux, 3, 'welten/3.db');
    migriereWeltdateien(linux, '/daten');
    expect(pfade(linux)).toEqual(['welten/1.db', 'welten/2.db', 'welten/3.db']);
    expect(schreibzahl(linux)).toBe(2);
    linux.prepare('UPDATE zaehler SET n = 0 WHERE id = 1').run();
    migriereWeltdateien(linux, '/daten');
    expect(schreibzahl(linux)).toBe(0);
    linux.close();
  });

  it('bricht ohne Teilschreiben ab, wenn ein absoluter Pfad außerhalb liegt', () => {
    for (const [daten, schlecht] of [
      ['C:\\daten', 'D:\\fremd\\2.db'],
      ['/daten', '/fremd/2.db'],
    ] as const) {
      const db = tabelle();
      lege(db, 1, 'welten\\1.db');
      lege(db, 2, schlecht);
      expect(() => migriereWeltdateien(db, daten)).toThrow(/außerhalb des Datenordners/);
      expect(pfade(db)).toEqual(['welten\\1.db', schlecht]);
      expect(schreibzahl(db)).toBe(0);
      db.close();
    }
  });

  it('speichert neue Pfade mit Schrägstrich und löst sie mit path.join', async () => {
    const datei = path.join(ordner, 'zugang.db');
    verwendeZugang(datei);
    const ada = await legeBenutzerAn({
      benutzername: 'Ada',
      passwort: PASSWORT,
      rolle: 'mitglied',
      weltdatei: 'welten\\ada.db',
    });
    expect(listeKonten().find((eintrag) => eintrag.id === ada.id)?.weltdatei).toBe('welten/ada.db');
    const bea = await erstelleMitglied({ benutzername: 'Bea', passwort: PASSWORT, profilname: 'Bea' });
    const beaZeile = listeKonten().find((eintrag) => eintrag.id === bea.id);
    expect(beaZeile?.weltdatei).toBe(`welten/${bea.id}.db`);
    expect(loeseWeltdatei(beaZeile?.weltdatei ?? '')).toBe(path.join(path.resolve(datenordner()), beaZeile?.weltdatei ?? ''));
    expect(() => loeseWeltdatei('')).toThrow();
    expect(() => loeseWeltdatei('..')).toThrow();
    expect(() => loeseWeltdatei(path.resolve(datenordner(), '..', 'absolut-ausserhalb.db'))).toThrow();
    expect(() => loeseWeltdatei('D:ausserhalb.db')).toThrow();
    schliesseZugang();

    const roh = new DatabaseSync(datei);
    roh.prepare('UPDATE benutzer SET weltdatei = ? WHERE id = ?').run('welten\\ada.db', ada.id);
    roh.prepare('UPDATE benutzer SET weltdatei = ? WHERE id = ?').run('D:\\ausserhalb\\bea.db', bea.id);
    roh.close();
    expect(() => verwendeZugang(datei)).toThrow(/außerhalb des Datenordners/);
    const kontrolle = new DatabaseSync(datei);
    expect(pfade(kontrolle)).toEqual(['welten\\ada.db', 'D:\\ausserhalb\\bea.db']);
    kontrolle.close();

    const nurAda = new DatabaseSync(datei);
    nurAda.prepare('UPDATE benutzer SET weltdatei = ? WHERE id = ?').run('welten/ada.db', ada.id);
    nurAda.prepare('UPDATE benutzer SET weltdatei = ? WHERE id = ?').run('welten\\bea.db', bea.id);
    nurAda.close();
    verwendeZugang(datei);
    const nachher = listeKonten();
    expect(nachher.find((eintrag) => eintrag.id === ada.id)?.weltdatei).toBe('welten/ada.db');
    expect(nachher.find((eintrag) => eintrag.id === bea.id)?.weltdatei).toBe('welten/bea.db');
    schliesseZugang();
    verwendeZugang(datei);
    expect(listeKonten().find((eintrag) => eintrag.id === bea.id)?.weltdatei).toBe('welten/bea.db');
    schliesseZugang();
  });
});
