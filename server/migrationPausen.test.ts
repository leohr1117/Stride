import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { migriere } from './db.ts';
import { MIGRATIONEN } from './migrationen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-migration-pausen-'));
const offen: DatabaseSync[] = [];
let nummer = 0;

const SPALTEN = ['id', 'von', 'bis'];

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

function tabelleDa(db: DatabaseSync, tabelle: string): boolean {
  return db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(tabelle) !== undefined;
}

function anzahl(db: DatabaseSync, tabelle: string): number {
  return (db.prepare(`SELECT COUNT(*) AS anzahl FROM ${tabelle}`).get() as { anzahl: number }).anzahl;
}

function einfuegen(db: DatabaseSync, werte: Record<string, SQLInputValue>): number {
  const namen = Object.keys(werte);
  const ergebnis = db
    .prepare(`INSERT INTO streak_pausen (${namen.join(', ')}) VALUES (${namen.map(() => '?').join(', ')})`)
    .run(...namen.map((name) => werte[name]));
  return Number(ergebnis.lastInsertRowid);
}

function pausenStand(): number {
  const index = MIGRATIONEN.findIndex((sql) => sql.includes('CREATE TABLE streak_pausen'));
  if (index < 0) {
    throw new Error('streak_pausen fehlt.');
  }
  return index;
}

describe('streak_pausen', () => {
  it('legt die Pausentabelle in genau einer Migration an', () => {
    const index = pausenStand();
    const sql = MIGRATIONEN[index] ?? '';
    expect(sql).toContain('CREATE TABLE streak_pausen');
    expect(sql).not.toContain('IF NOT EXISTS');
    expect(sql).not.toContain('REFERENCES');
    expect(MIGRATIONEN.filter((eintrag) => eintrag.includes('streak_pausen'))).toHaveLength(1);
  });

  it('legt die Tabelle in zwei Dateien an und lässt den zweiten Lauf stehen', () => {
    const erste = datenbank();
    const davor = pausenStand();
    migriere(erste, davor);
    expect(version(erste)).toBe(davor);
    expect(tabelleDa(erste, 'streak_pausen')).toBe(false);

    migriere(erste);
    expect(version(erste)).toBe(MIGRATIONEN.length);
    expect(spalten(erste, 'streak_pausen')).toEqual(SPALTEN);
    expect(anzahl(erste, 'streak_pausen')).toBe(0);
    expect((erste.prepare('PRAGMA foreign_key_list(streak_pausen)').all() as unknown[]).length).toBe(0);
    const zeile = einfuegen(erste, { von: '2026-05-01', bis: null });
    expect(anzahl(erste, 'streak_pausen')).toBe(1);

    migriere(erste);
    expect(version(erste)).toBe(MIGRATIONEN.length);
    expect(spalten(erste, 'streak_pausen')).toEqual(SPALTEN);
    expect(anzahl(erste, 'streak_pausen')).toBe(1);
    expect(
      (erste.prepare(`SELECT COUNT(*) AS anzahl FROM sqlite_master WHERE type = 'table' AND name = 'streak_pausen'`).get() as {
        anzahl: number;
      }).anzahl,
    ).toBe(1);

    const zweite = datenbank();
    migriere(zweite);
    expect(version(zweite)).toBe(MIGRATIONEN.length);
    expect(spalten(zweite, 'streak_pausen')).toEqual(SPALTEN);
    expect(tabelleDa(zweite, 'streak_pausen')).toBe(true);

    const pfad = path.join(ordner, 'doppelt.db');
    const links = new DatabaseSync(pfad);
    links.exec('PRAGMA foreign_keys = ON');
    offen.push(links);
    migriere(links);
    links.exec('PRAGMA journal_mode = WAL');
    const id = einfuegen(links, { von: '2026-06-01', bis: '2026-06-03' });
    const rechts = new DatabaseSync(pfad);
    offen.push(rechts);
    expect(anzahl(rechts, 'streak_pausen')).toBe(1);
    expect((rechts.prepare('SELECT id FROM streak_pausen').get() as { id: number }).id).toBe(id);
    expect(zeile).toBeGreaterThan(0);
  });

  it('weist ein ungültiges Datum und ein bis vor von ab', () => {
    const db = datenbank();
    migriere(db);
    einfuegen(db, { von: '2026-05-01', bis: null });
    einfuegen(db, { von: '2026-06-01', bis: '2026-06-01' });
    einfuegen(db, { von: '2026-07-01', bis: '2026-07-05' });
    expect(() => einfuegen(db, { von: '2026-13-40', bis: null })).toThrow(/constraint/i);
    expect(() => einfuegen(db, { von: '05.05.2026', bis: null })).toThrow(/constraint/i);
    expect(() => einfuegen(db, { von: '2026-05-01T00:00:00Z', bis: null })).toThrow(/constraint/i);
    expect(() => einfuegen(db, { von: '2026-05-05', bis: '2026-05-01' })).toThrow(/constraint/i);
    expect(() => einfuegen(db, { von: '2026-08-02', bis: '2026-08-1' })).toThrow(/constraint/i);
    expect(anzahl(db, 'streak_pausen')).toBe(3);
  });
});
