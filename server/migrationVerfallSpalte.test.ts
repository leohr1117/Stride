import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { migriere } from './db.ts';
import { MIGRATIONEN } from './migrationen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-migration-verfall-spalte-'));
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

function spalten(db: DatabaseSync): string[] {
  return (db.prepare('PRAGMA table_info(attribute)').all() as { name: string }[]).map((zeile) => zeile.name);
}

function kennung(db: DatabaseSync, wert: string): number {
  const zeile = db.prepare('SELECT id FROM attribute WHERE kennung = ?').get(wert) as { id: number } | undefined;
  if (!zeile) {
    throw new Error(`${wert} fehlt.`);
  }
  return zeile.id;
}

function summe(db: DatabaseSync, tabelle: string): number {
  return (db.prepare(`SELECT COALESCE(SUM(xp), 0) AS xp FROM ${tabelle}`).get() as { xp: number }).xp;
}

function belastung(db: DatabaseSync): { id: number; attributId: number; xp: number; eintragId: number | null }[] {
  return db
    .prepare(
      `SELECT id, attribut_id AS attributId, xp, eintrag_id AS eintragId
       FROM xp_ereignisse WHERE quelle = 'belastung' ORDER BY id`,
    )
    .all() as { id: number; attributId: number; xp: number; eintragId: number | null }[];
}

describe('Spalte verfall_belastung', () => {
  it('entfernt die Spalte und lässt alte Buchungen und XP-Summen', () => {
    const db = datenbank();
    migriere(db, 34);
    expect(version(db)).toBe(34);
    expect(spalten(db)).toContain('verfall_belastung');
    expect(MIGRATIONEN[8]).toContain('verfall_belastung');
    expect(MIGRATIONEN[6]).toContain("quelle = 'belastung'");

    const geist = kennung(db, 'geist');
    const koerper = kennung(db, 'koerper');
    db.prepare(`UPDATE attribute SET verfall_belastung = 'mittel' WHERE id = ?`).run(geist);
    db.prepare(
      `INSERT INTO xp_ereignisse (quelle, attribut_id, xp, erstellt_am) VALUES ('belastung', ?, -12, '2026-01-01T00:00:00.000Z')`,
    ).run(geist);
    db.prepare(
      `INSERT INTO xp_ereignisse (quelle, attribut_id, xp, erstellt_am) VALUES ('eintrag', ?, 40, '2026-01-02T00:00:00.000Z')`,
    ).run(koerper);
    const vorher = {
      ereignisse: summe(db, 'xp_ereignisse'),
      projekt: summe(db, 'projekt_xp'),
      faehigkeit: summe(db, 'faehigkeit_xp'),
      belastung: belastung(db),
      stufe: (db.prepare('SELECT verfall_belastung AS stufe FROM attribute WHERE id = ?').get(geist) as { stufe: string }).stufe,
    };
    expect(vorher.stufe).toBe('mittel');
    expect(vorher.belastung).toEqual([{ id: vorher.belastung[0]?.id, attributId: geist, xp: -12, eintragId: null }]);
    expect(vorher.ereignisse).toBe(28);

    migriere(db, 35);
    expect(version(db)).toBe(35);
    expect(spalten(db)).not.toContain('verfall_belastung');
    expect(summe(db, 'xp_ereignisse')).toBe(vorher.ereignisse);
    expect(summe(db, 'projekt_xp')).toBe(vorher.projekt);
    expect(summe(db, 'faehigkeit_xp')).toBe(vorher.faehigkeit);
    expect(belastung(db)).toEqual(vorher.belastung);

    migriere(db);
    expect(version(db)).toBe(MIGRATIONEN.length);
    expect(summe(db, 'xp_ereignisse')).toBe(vorher.ereignisse);
    expect(belastung(db)).toEqual(vorher.belastung);
  });
});
