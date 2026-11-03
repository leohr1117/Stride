import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { migriere } from './db.ts';
import { MIGRATIONEN } from './migrationen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-migration-zahlung-'));
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

describe('Migration der Bezahlung', () => {
  it('hängt die Bezahlung als 31. Migration an, ohne zu schreiben', () => {
    expect(MIGRATIONEN.length).toBeGreaterThanOrEqual(31);
    const sql = MIGRATIONEN[30];
    expect(sql).toContain('bezahlt_attribut_id');
    expect(sql).toContain('ADD COLUMN betrag');
    expect(sql).toContain('investition_id');
    expect(sql).not.toContain('INSERT');
    expect(sql).not.toContain('UPDATE');
    expect(MIGRATIONEN.slice(0, 30).some((eintrag) => eintrag.includes('bezahlt_attribut_id'))).toBe(false);
  });

  it('lässt bestehende Investitionen bei Nichts und ohne Buchung', () => {
    const db = datenbank();
    migriere(db, 30);
    expect(version(db)).toBe(30);
    const attribut = Number(
      db.prepare(`INSERT INTO attribute (typ, name, farbe, icon) VALUES ('status', 'Kasse', '#facc15', 'coins')`).run()
        .lastInsertRowid,
    );
    const id = Number(
      db
        .prepare(`INSERT INTO investitionen (name, icon, groesse, bonus, attribut_id) VALUES ('Lager', 'gem', 1, 0.1, ?)`)
        .run(attribut).lastInsertRowid,
    );

    migriere(db);

    expect(version(db)).toBe(MIGRATIONEN.length);
    const zeile = db
      .prepare(
        `SELECT name, icon, groesse, bonus, attribut_id AS attributId, archiviert,
                bezahlt_attribut_id AS bezahltAttributId, betrag
         FROM investitionen WHERE id = ?`,
      )
      .get(id) as {
      name: string;
      icon: string;
      groesse: number;
      bonus: number;
      attributId: number;
      archiviert: number;
      bezahltAttributId: number | null;
      betrag: number;
    };
    expect(zeile).toEqual({
      name: 'Lager',
      icon: 'gem',
      groesse: 1,
      bonus: 0.1,
      attributId: attribut,
      archiviert: 0,
      bezahltAttributId: null,
      betrag: 0,
    });
    expect(db.prepare(`SELECT COUNT(*) AS anzahl FROM xp_ereignisse WHERE quelle = 'investition'`).get()).toEqual({ anzahl: 0 });
  });
});
