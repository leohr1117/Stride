import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { migriere } from './db.ts';
import { MIGRATIONEN } from './migrationen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-migration-investition-faehigkeit-'));
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

interface Zeile {
  id: number;
  name: string;
  icon: string;
  groesse: number;
  bonus: number;
  zielArt: string | null;
  zielId: number | null;
  attributId: number | null;
  archiviert: number;
  erstelltAm: string;
  bezahltAttributId: number | null;
  betrag: number;
}

function zeilen(db: DatabaseSync): Zeile[] {
  return db
    .prepare(
      `SELECT id, name, icon, groesse, bonus, ziel_art AS zielArt, ziel_id AS zielId, attribut_id AS attributId,
              archiviert, erstellt_am AS erstelltAm, bezahlt_attribut_id AS bezahltAttributId, betrag
       FROM investitionen ORDER BY id`,
    )
    .all() as unknown as Zeile[];
}

function fremdschluessel(db: DatabaseSync): unknown[] {
  return db.prepare('PRAGMA foreign_key_check').all();
}

describe('Fähigkeit an einer eigenen Investition', () => {
  it('lässt den Bestand stehen und nimmt die Fähigkeit als eigene Spalte', () => {
    const db = datenbank();
    migriere(db, 36);
    expect(version(db)).toBe(36);
    const attribute = db.prepare('SELECT id FROM attribute ORDER BY id').all() as { id: number }[];
    const erstes = attribute[0]?.id;
    const zweites = attribute[1]?.id;
    if (erstes === undefined || zweites === undefined) {
      throw new Error('Attribute fehlen.');
    }
    const anlegen = db.prepare(
      `INSERT INTO investitionen
         (id, name, icon, groesse, bonus, ziel_art, ziel_id, attribut_id, archiviert, erstellt_am, bezahlt_attribut_id, betrag)
       VALUES (?, ?, 'gem', 1, 0.1, ?, ?, ?, 0, ?, ?, ?)`,
    );
    anlegen.run(1, 'Nur Attribut', null, null, erstes, '2020-01-01T00:00:00.000Z', null, 0);
    anlegen.run(2, 'Zweites Attribut', 'attribut', zweites, erstes, '2020-02-02T00:00:00.000Z', zweites, 40);
    anlegen.run(3, 'Mit Projekt', 'projekt', 9, zweites, '2020-03-03T00:00:00.000Z', null, 0);
    anlegen.run(4, 'Mit Vision', 'vision', 4, erstes, '2020-04-04T00:00:00.000Z', erstes, 15);
    anlegen.run(5, 'Noch ein Attribut', 'attribut', erstes, zweites, '2020-05-05T00:00:00.000Z', null, 0);
    const vorher = zeilen(db);
    expect(vorher.filter((zeile) => zeile.zielArt === 'attribut')).toHaveLength(2);

    migriere(db);
    expect(version(db)).toBe(MIGRATIONEN.length);
    expect(zeilen(db)).toEqual(vorher);
    const faehigkeitIds = db.prepare('SELECT faehigkeit_id AS id FROM investitionen ORDER BY id').all() as { id: number | null }[];
    expect(faehigkeitIds.map((zeile) => zeile.id)).toEqual([null, null, null, null, null]);
    expect(fremdschluessel(db)).toEqual([]);
    const spalten = db.prepare(`SELECT name FROM pragma_table_info('investitionen') ORDER BY cid`).all() as { name: string }[];
    expect(spalten.map((spalte) => spalte.name)).toEqual([
      'id',
      'name',
      'icon',
      'groesse',
      'bonus',
      'ziel_art',
      'ziel_id',
      'attribut_id',
      'archiviert',
      'erstellt_am',
      'bezahlt_attribut_id',
      'betrag',
      'faehigkeit_id',
    ]);
    expect(
      db.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'investitionen_attribut'`).get(),
    ).toBeTruthy();
    expect(
      db.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'investitionen_faehigkeit'`).get(),
    ).toBeTruthy();

    const faehigkeit = db
      .prepare(`INSERT INTO faehigkeiten (name, farbe, icon) VALUES ('Lesen', '#112233', 'sparkles')`)
      .run();
    const faehigkeitId = Number(faehigkeit.lastInsertRowid);
    db.prepare(
      `INSERT INTO investitionen (name, groesse, bonus, faehigkeit_id) VALUES ('Nur Fähigkeit', 1, 0.1, ?)`,
    ).run(faehigkeitId);
    db.prepare(
      `INSERT INTO investitionen (name, groesse, bonus, ziel_art, ziel_id, attribut_id, faehigkeit_id)
       VALUES ('Alle drei', 2, 0.2, 'projekt', 9, ?, ?)`,
    ).run(erstes, faehigkeitId);
    expect(fremdschluessel(db)).toEqual([]);
    const neu = db
      .prepare(
        `SELECT name, ziel_art AS zielArt, ziel_id AS zielId, attribut_id AS attributId, faehigkeit_id AS faehigkeitId
         FROM investitionen WHERE name IN ('Nur Fähigkeit', 'Alle drei') ORDER BY name`,
      )
      .all() as { name: string; zielArt: string | null; zielId: number | null; attributId: number | null; faehigkeitId: number | null }[];
    expect(neu).toEqual([
      { name: 'Alle drei', zielArt: 'projekt', zielId: 9, attributId: erstes, faehigkeitId },
      { name: 'Nur Fähigkeit', zielArt: null, zielId: null, attributId: null, faehigkeitId },
    ]);
    expect(() =>
      db.prepare(`INSERT INTO investitionen (name, groesse, bonus) VALUES ('Leer', 1, 0.1)`).run(),
    ).toThrow(/CHECK/);
    expect(() =>
      db
        .prepare(
          `INSERT INTO investitionen (name, groesse, bonus, ziel_art, ziel_id, attribut_id)
           VALUES ('Nur zweites Attribut', 1, 0.1, 'attribut', ?, NULL)`,
        )
        .run(zweites),
    ).toThrow(/CHECK/);
    expect(() =>
      db
        .prepare(
          `INSERT INTO investitionen (name, groesse, bonus, ziel_art, ziel_id, attribut_id, faehigkeit_id)
           VALUES ('Attribut ohne Bonusfeld', 1, 0.1, 'attribut', ?, NULL, ?)`,
        )
        .run(zweites, faehigkeitId),
    ).toThrow(/CHECK/);
  });
});
