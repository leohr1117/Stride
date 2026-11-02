import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { migriere } from './db.ts';
import { MIGRATIONEN } from './migrationen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-migration-investition-'));
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

function migrationsIndex(ausschnitt: string): number {
  const index = MIGRATIONEN.findIndex((sql) => sql.includes(ausschnitt));
  if (index < 0) {
    throw new Error(`Migration fehlt: ${ausschnitt}`);
  }
  return index;
}

function vorbereiten(db: DatabaseSync): void {
  migriere(db, migrationsIndex('ALTER TABLE projekte ADD COLUMN investition INTEGER'));
}

interface Zeile {
  name: string;
  art: string | null;
  ziel: number | null;
  geschafft: string | null;
  archiviert: number;
  ressourcen: number;
  bonus: number;
  vorlageId: number;
}

function investitionen(db: DatabaseSync): Zeile[] {
  return db
    .prepare(
      `SELECT name, investition_ziel_art AS art, investition_ziel_id AS ziel, geschafft_am AS geschafft,
              archiviert, investition_ressourcen AS ressourcen, investition_bonus AS bonus,
              standard_vorlage_id AS vorlageId
       FROM projekte WHERE investition = 1 ORDER BY id`,
    )
    .all() as unknown as Zeile[];
}

describe('Migration der Investitionen', () => {
  it('macht aus jeder alten Investition ein Projekt und lässt die Käufe stehen', () => {
    const db = datenbank();
    vorbereiten(db);
    const vorlage = Number(db.prepare(`INSERT INTO vorlagen (name, icon) VALUES ('Tun', 'star')`).run().lastInsertRowid);
    const fit = Number(db.prepare(`INSERT INTO visionen (titel, farbe) VALUES ('Fit', '#34d399')`).run().lastInsertRowid);
    const app = Number(db.prepare(`INSERT INTO visionen (titel, farbe) VALUES ('App', '#60a5fa')`).run().lastInsertRowid);
    const projekt = (name: string, vision: number | null) =>
      Number(
        db
          .prepare('INSERT INTO projekte (standard_vorlage_id, name, vision_id) VALUES (?, ?, ?)')
          .run(vorlage, name, vision).lastInsertRowid,
      );
    const kraft = projekt('Kraft', fit);
    const laufen = projekt('Laufen', fit);
    const portal = projekt('Portal', app);
    const solo = projekt('Solo', null);
    const offenVorhaben = Number(
      db.prepare(`INSERT INTO vorhaben (projekt_id, titel, status) VALUES (?, 'Offen', 'offen')`).run(kraft).lastInsertRowid,
    );
    const fertig = Number(
      db
        .prepare(
          `INSERT INTO vorhaben (projekt_id, titel, status, abgeschlossen_am) VALUES (?, 'Fertig', 'geschafft', ?)`,
        )
        .run(solo, '2026-05-01T12:00:00.000Z').lastInsertRowid,
    );
    const kauf = (name: string, bonus: number, archiviert = 0, ausloeser: number | null = null) =>
      Number(
        db
          .prepare(
            `INSERT INTO ausruestung (name, beschreibung, icon, stufe, bonus, kosten, archiviert, gekauft_am, ausloeser_vorhaben_id)
             VALUES (?, '', 'wrench', 'klein', ?, 100, ?, '2026-04-01T08:00:00.000Z', ?)`,
          )
          .run(name, bonus, archiviert, ausloeser).lastInsertRowid,
      );
    const verknuepfe = (ausruestungId: number, projektId: number) => {
      db.prepare('INSERT INTO ausruestung_projekte (ausruestung_id, projekt_id) VALUES (?, ?)').run(ausruestungId, projektId);
    };

    const einzel = kauf('Trainingsbank', 0.1);
    verknuepfe(einzel, kraft);
    const geteilt = kauf('Gute Tastatur', 0.2);
    verknuepfe(geteilt, kraft);
    verknuepfe(geteilt, laufen);
    const gemischt = kauf('Zwei Welten', 0.1);
    verknuepfe(gemischt, portal);
    verknuepfe(gemischt, kraft);
    const wartet = kauf('Wartet', 0.3, 0, offenVorhaben);
    db.prepare('INSERT INTO ausruestung_visionen (ausruestung_id, vision_id) VALUES (?, ?)').run(wartet, app);
    const erfuellt = kauf('Erfüllt', 0.1, 0, fertig);
    verknuepfe(erfuellt, solo);
    const archiv = kauf('Archiv', 0.1, 1);
    verknuepfe(archiv, portal);
    kauf('Leer', 0.1);

    migriere(db);

    const nachName = new Map(investitionen(db).map((zeile) => [zeile.name, zeile]));
    expect(nachName.size).toBe(7);
    expect(db.prepare('SELECT COUNT(*) AS anzahl FROM ausruestung').get()).toEqual({ anzahl: 7 });

    const bank = nachName.get('Trainingsbank');
    expect(bank).toMatchObject({ art: 'projekt', ziel: kraft, geschafft: '2026-04-01T08:00:00.000Z', archiviert: 0, ressourcen: 0, bonus: 0.1, vorlageId: vorlage });

    const tastatur = nachName.get('Gute Tastatur');
    expect(tastatur).toMatchObject({ art: 'vision', ziel: fit, bonus: 0.2, ressourcen: 0 });

    const welten = nachName.get('Zwei Welten');
    expect(welten).toMatchObject({ art: 'projekt', ziel: Math.min(portal, kraft) });

    expect(nachName.get('Wartet')).toMatchObject({ art: 'vision', ziel: app, geschafft: null, bonus: 0.3 });
    expect(nachName.get('Erfüllt')).toMatchObject({ art: 'projekt', ziel: solo, geschafft: '2026-05-01T12:00:00.000Z' });
    expect(nachName.get('Archiv')).toMatchObject({ art: 'projekt', ziel: portal, geschafft: null, archiviert: 1 });
    expect(nachName.get('Leer')).toMatchObject({ art: null, ziel: null, geschafft: '2026-04-01T08:00:00.000Z' });

    const alt = db.prepare(`SELECT COUNT(*) AS anzahl FROM projekte WHERE name = 'Kraft' AND investition = 0`).get() as { anzahl: number };
    expect(alt.anzahl).toBe(1);
  });

  it('überspringt die Übernahme, wenn keine Tätigkeit da ist', () => {
    const db = datenbank();
    vorbereiten(db);
    const vorlage = Number(db.prepare(`INSERT INTO vorlagen (name, icon, archiviert) VALUES ('Alt', 'star', 1)`).run().lastInsertRowid);
    db.prepare(
      `INSERT INTO ausruestung (name, beschreibung, icon, stufe, bonus, kosten, gekauft_am) VALUES ('Stuhl', '', 'wrench', 'klein', 0.1, 100, '2026-04-01T08:00:00.000Z')`,
    ).run();
    expect(vorlage).toBeGreaterThan(0);
    migriere(db);
    expect(investitionen(db)).toEqual([]);
    expect(db.prepare('SELECT COUNT(*) AS anzahl FROM ausruestung').get()).toEqual({ anzahl: 1 });
  });

  it('übernimmt nur übrige Käufe, rastet die Größe ein und löscht Krit-Markierungen', () => {
    const db = datenbank();
    migriere(db, migrationsIndex('CREATE TABLE investitionen'));
    const vorlage = Number(db.prepare(`INSERT INTO vorlagen (name, icon) VALUES ('Tun', 'star')`).run().lastInsertRowid);
    const kraft = Number(
      db.prepare(`INSERT INTO projekte (standard_vorlage_id, name) VALUES (?, 'Kraft')`).run(vorlage).lastInsertRowid,
    );
    db.prepare(`UPDATE projekte SET investition = 1, investition_bonus = 0.15 WHERE id = ?`).run(kraft);
    db.prepare(
      `INSERT INTO projekte (standard_vorlage_id, name, erstellt_am, investition, investition_bonus, geschafft_am)
       VALUES (?, 'Gute Tastatur', '2026-04-01T08:00:00.000Z', 1, 0.1, '2026-04-01T08:00:00.000Z')`,
    ).run(vorlage);
    db.prepare(
      `INSERT INTO projekte (standard_vorlage_id, name, investition, investition_bonus) VALUES (?, 'Knapp', 1, 0.149)`,
    ).run(vorlage);
    const bank = Number(
      db
        .prepare(
          `INSERT INTO ausruestung (name, beschreibung, icon, stufe, bonus, kosten, archiviert, gekauft_am)
           VALUES ('Trainingsbank', '', 'wrench', 'klein', 0.12, 0, 0, '2026-10-03T06:00:00.000Z')`,
        )
        .run().lastInsertRowid,
    );
    db.prepare('INSERT INTO ausruestung_projekte (ausruestung_id, projekt_id) VALUES (?, ?)').run(bank, kraft);
    db.prepare(
      `INSERT INTO ausruestung (name, beschreibung, icon, stufe, bonus, kosten, archiviert, gekauft_am)
       VALUES ('Gute Tastatur', '', 'wrench', 'klein', 0.1, 0, 0, '2026-04-01T08:00:00.000Z')`,
    ).run();
    db.prepare(`INSERT INTO eintraege (projekt_id, vorlage_id, krit, erstellt_am) VALUES (?, ?, 1, '2026-04-02T08:00:00.000Z')`).run(
      kraft,
      vorlage,
    );
    const attribut = Number(
      (db.prepare(`SELECT id FROM attribute WHERE archiviert = 0 ORDER BY id LIMIT 1`).get() as { id: number }).id,
    );
    db.prepare(`INSERT INTO xp_ereignisse (quelle, attribut_id, xp, erstellt_am) VALUES ('eintrag', ?, 40, '2026-04-02T08:00:00.000Z')`).run(
      attribut,
    );

    migriere(db);

    const projekte = investitionen(db);
    const nachName = new Map(projekte.map((zeile) => [zeile.name, zeile]));
    expect(nachName.get('Kraft')).toMatchObject({ bonus: 0.2 });
    expect(nachName.get('Gute Tastatur')).toMatchObject({ bonus: 0.1 });
    expect(nachName.get('Knapp')).toMatchObject({ bonus: 0.1 });
    expect(nachName.has('Trainingsbank')).toBe(false);

    const groessen = db
      .prepare(`SELECT name, investition_groesse AS groesse FROM projekte WHERE investition = 1`)
      .all() as { name: string; groesse: number }[];
    const groesse = new Map(groessen.map((zeile) => [zeile.name, zeile.groesse]));
    expect(groesse.get('Kraft')).toBe(2);
    expect(groesse.get('Gute Tastatur')).toBe(1);
    expect(groesse.get('Knapp')).toBe(1);

    const eigene = db
      .prepare(
        `SELECT name, groesse, bonus, ziel_art AS art, ziel_id AS ziel, attribut_id AS attribut, archiviert
         FROM investitionen`,
      )
      .all() as { name: string; groesse: number; bonus: number; art: string | null; ziel: number | null; attribut: number; archiviert: number }[];
    expect(eigene).toHaveLength(1);
    const ressourcen = Number(
      (db.prepare(`SELECT id FROM attribute WHERE kennung = 'ressourcen' AND archiviert = 0`).get() as { id: number }).id,
    );
    expect(eigene[0]).toMatchObject({
      name: 'Trainingsbank',
      groesse: 1,
      bonus: 0.1,
      art: 'projekt',
      ziel: kraft,
      attribut: ressourcen,
      archiviert: 0,
    });
    expect(db.prepare(`SELECT krit FROM eintraege`).all()).toEqual([{ krit: 0 }]);
    expect(db.prepare(`SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse`).get()).toEqual({ xp: 40 });
  });
});
