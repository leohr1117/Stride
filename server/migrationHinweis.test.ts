import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { migriere } from './db.ts';
import { MIGRATIONEN } from './migrationen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-migration-hinweis-'));
const offen: DatabaseSync[] = [];
let nummer = 0;

const SPALTEN = ['id', 'endpoint', 'p256dh', 'auth', 'erstellt_am', 'ungueltig_am'];

function datenbank(): DatabaseSync {
  nummer += 1;
  const db = new DatabaseSync(path.join(ordner, `${nummer}.db`));
  db.exec('PRAGMA foreign_keys = ON');
  offen.push(db);
  return db;
}

afterEach(() => {
  for (const db of offen) {
    db.close();
  }
  offen.length = 0;
});

function version(db: DatabaseSync): number {
  return (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
}

function spalten(db: DatabaseSync, tabelle: string): string[] {
  return (db.prepare(`PRAGMA table_info(${tabelle})`).all() as { name: string }[]).map((zeile) => zeile.name);
}

function tabellen(db: DatabaseSync): string[] {
  return (
    db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all() as {
      name: string;
    }[]
  ).map((zeile) => zeile.name);
}

function tabelleDa(db: DatabaseSync, tabelle: string): boolean {
  return db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(tabelle) !== undefined;
}

function einfuegen(db: DatabaseSync, werte: Record<string, SQLInputValue>): number {
  const namen = Object.keys(werte);
  const ergebnis = db
    .prepare(`INSERT INTO push_abos (${namen.join(', ')}) VALUES (${namen.map(() => '?').join(', ')})`)
    .run(...namen.map((name) => werte[name]));
  return Number(ergebnis.lastInsertRowid);
}

describe('Migration 28', () => {
  it('hängt nur push_abos als 28. Migration an', () => {
    expect(MIGRATIONEN).toHaveLength(28);
    const sql = MIGRATIONEN[27];
    expect(sql).toContain('CREATE TABLE push_abos');
    expect(sql).toContain('endpoint TEXT NOT NULL UNIQUE');
    expect(sql).toContain('ungueltig_am TEXT');
    expect(sql).not.toContain('ALTER TABLE');
    expect(sql).not.toContain('einstellungen');
    expect(sql).not.toContain('funktionen');
    expect(sql).not.toContain('hinweis_');
    expect(sql).not.toContain('CREATE TABLE streak_bruecken');
    expect(sql).not.toContain('CREATE TABLE aufgaben');
    expect(sql).not.toContain('CREATE TABLE training');
    expect(MIGRATIONEN.slice(0, 27).some((eintrag) => eintrag.includes('CREATE TABLE push_abos'))).toBe(false);
    expect(MIGRATIONEN[26]).not.toContain('CREATE TABLE push_abos');
    expect(MIGRATIONEN[26]).toContain('CREATE TABLE streak_bruecken');
  });

  it('legt die Tabelle erst ab Version 28 an und lässt alte Zeilen liegen', () => {
    const db = datenbank();
    migriere(db, 27);
    expect(version(db)).toBe(27);
    expect(tabelleDa(db, 'push_abos')).toBe(false);
    const vorher = tabellen(db);
    const eintraege = spalten(db, 'eintraege');
    db.prepare(`INSERT INTO vorlagen (name, icon) VALUES ('Tun', 'star')`).run();
    const vorlageId = (db.prepare('SELECT id FROM vorlagen').get() as { id: number }).id;
    db.prepare('INSERT INTO eintraege (vorlage_id, erstellt_am) VALUES (?, ?)').run(vorlageId, '2026-10-28T12:00:00.000Z');
    db.prepare(`INSERT INTO einstellungen (schluessel, wert) VALUES ('sprache', '"de"')`).run();
    db.prepare(`INSERT INTO einstellungen (schluessel, wert) VALUES ('funktionen', '{"koennen":true}')`).run();
    const einstellungen = (db.prepare('SELECT COUNT(*) AS anzahl FROM einstellungen').get() as { anzahl: number }).anzahl;

    migriere(db, 28);
    expect(version(db)).toBe(28);
    expect(spalten(db, 'push_abos')).toEqual(SPALTEN);
    expect(tabellen(db).filter((name) => !vorher.includes(name))).toEqual(['push_abos']);
    expect(spalten(db, 'eintraege')).toEqual(eintraege);
    expect(spalten(db, 'einstellungen')).toEqual(['schluessel', 'wert']);
    expect((db.prepare('SELECT COUNT(*) AS anzahl FROM einstellungen').get() as { anzahl: number }).anzahl).toBe(einstellungen);
    expect((db.prepare('SELECT wert FROM einstellungen WHERE schluessel = ?').get('funktionen') as { wert: string }).wert).toBe(
      '{"koennen":true}',
    );
    expect((db.prepare('SELECT COUNT(*) AS anzahl FROM eintraege').get() as { anzahl: number }).anzahl).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS anzahl FROM push_abos').get() as { anzahl: number }).anzahl).toBe(0);
    expect(
      (db.prepare(`SELECT COUNT(*) AS anzahl FROM einstellungen WHERE schluessel LIKE 'hinweis_%'`).get() as { anzahl: number })
        .anzahl,
    ).toBe(0);
  });

  it('nimmt ein Abo an und weist doppelte Endpunkte und leere Pflichtfelder ab', () => {
    const db = datenbank();
    migriere(db);
    expect(version(db)).toBe(MIGRATIONEN.length);
    const id = einfuegen(db, { endpoint: 'https://geraet.example/1', p256dh: 'schluessel', auth: 'geheim' });
    const zeile = db.prepare('SELECT endpoint, p256dh, auth, erstellt_am, ungueltig_am FROM push_abos WHERE id = ?').get(id) as {
      endpoint: string;
      p256dh: string;
      auth: string;
      erstellt_am: string;
      ungueltig_am: string | null;
    };
    expect(zeile.endpoint).toBe('https://geraet.example/1');
    expect(zeile.p256dh).toBe('schluessel');
    expect(zeile.auth).toBe('geheim');
    expect(zeile.ungueltig_am).toBeNull();
    expect(zeile.erstellt_am).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$/);
    einfuegen(db, {
      endpoint: 'https://geraet.example/2',
      p256dh: 'anderer',
      auth: 'auth',
      ungueltig_am: '2026-10-28T12:00:00.000Z',
    });
    expect(() => einfuegen(db, { endpoint: 'https://geraet.example/1', p256dh: 'neu', auth: 'neu' })).toThrow(/constraint/i);
    expect(() => einfuegen(db, { p256dh: 'p', auth: 'a' })).toThrow(/constraint/i);
    expect(() => einfuegen(db, { endpoint: 'https://geraet.example/3', auth: 'a' })).toThrow(/constraint/i);
    expect(() => einfuegen(db, { endpoint: 'https://geraet.example/3', p256dh: 'p' })).toThrow(/constraint/i);
    expect((db.prepare('SELECT COUNT(*) AS anzahl FROM push_abos').get() as { anzahl: number }).anzahl).toBe(2);
    const tot = db.prepare('SELECT ungueltig_am FROM push_abos WHERE endpoint = ?').get('https://geraet.example/2') as {
      ungueltig_am: string;
    };
    expect(tot.ungueltig_am).toBe('2026-10-28T12:00:00.000Z');
  });
});
