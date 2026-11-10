import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { migriere } from './db.ts';
import { MIGRATIONEN } from './migrationen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-migration-fehler-art-'));
const offen: DatabaseSync[] = [];
let nummer = 0;

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

describe('Migration der Fehlerart', () => {
  it('hängt nur eine Spalte an das Ende und schreibt nichts', () => {
    expect(MIGRATIONEN.length).toBeGreaterThanOrEqual(32);
    const sql = MIGRATIONEN[31];
    expect(sql).toContain('ALTER TABLE kalender ADD COLUMN fehler_art TEXT');
    expect(sql).not.toContain('INSERT');
    expect(sql).not.toContain('UPDATE');
    expect(sql).not.toContain('DROP');
    expect(MIGRATIONEN.slice(0, 31).some((eintrag) => eintrag.includes('fehler_art'))).toBe(false);
  });

  it('legt die Spalte an und läuft ein zweites Mal ohne Fehler', () => {
    const db = datenbank();
    migriere(db, 31);
    expect(version(db)).toBe(31);
    migriere(db);
    migriere(db);
    expect(version(db)).toBe(MIGRATIONEN.length);
    const spalten = db.prepare('PRAGMA table_info(kalender)').all() as { name: string }[];
    expect(spalten.some((spalte) => spalte.name === 'fehler_art')).toBe(true);
    expect(db.prepare('SELECT fehler_art FROM kalender').all()).toEqual([]);
  });
});
