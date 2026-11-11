import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { eintragXp, verteileNachGewichten } from '../shared/spiel/xp.ts';
import { eine, migriere, mitWelt, schliesseWelt } from './db.ts';
import { erstelleEintrag } from './features/eintraege/eintraege.ts';
import { MIGRATIONEN } from './migrationen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-migration-taetigkeit-'));
const offen: string[] = [];
let nummer = 0;
const ZEIT = new Date(2026, 5, 2, 12, 0, 0);

function datei(): string {
  nummer += 1;
  const pfad = path.join(ordner, `${nummer}.db`);
  offen.push(pfad);
  return pfad;
}

afterEach(() => {
  for (const pfad of offen) {
    schliesseWelt(pfad);
  }
  offen.length = 0;
});

function anteilStand(): number {
  const index = MIGRATIONEN.findIndex((sql) => sql.includes('feste_anteile'));
  if (index < 0) {
    throw new Error('feste_anteile fehlt.');
  }
  return index;
}

function kennung(db: DatabaseSync, wert: string): number {
  const zeile = db.prepare('SELECT id FROM attribute WHERE kennung = ?').get(wert) as { id: number } | undefined;
  if (!zeile) {
    throw new Error(`${wert} fehlt.`);
  }
  return zeile.id;
}

describe('feste Anteile in der Migration', () => {
  it('bucht eine Summe von 130 nach der Migration wie vorher', () => {
    const pfad = datei();
    const db = new DatabaseSync(pfad);
    let vorlageId = 0;
    let koerper = 0;
    let disziplin = 0;
    try {
      db.exec('PRAGMA foreign_keys = ON');
      const stand = anteilStand();
      migriere(db, stand);
      const version = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
      const spalten = (db.prepare('PRAGMA table_info(vorlagen)').all() as { name: string }[]).map((zeile) => zeile.name);
      expect(version).toBe(stand);
      expect(spalten).not.toContain('feste_anteile');
      expect(db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'vorlage_abzuege'`).get()).toBeUndefined();

      koerper = kennung(db, 'koerper');
      disziplin = kennung(db, 'disziplin');
      const vorlage = db.prepare(`INSERT INTO vorlagen (name, icon, sortierung) VALUES ('Summe', 'star', 0)`).run();
      vorlageId = Number(vorlage.lastInsertRowid);
      db.prepare('INSERT INTO vorlage_gewichte (vorlage_id, attribut_id, gewicht) VALUES (?, ?, 80), (?, ?, 50)').run(
        vorlageId,
        koerper,
        vorlageId,
        disziplin,
      );
    } finally {
      db.close();
    }

    mitWelt(pfad, () => {
      const fest = eine<{ fest: number }>('SELECT feste_anteile AS fest FROM vorlagen WHERE id = ?', vorlageId)?.fest;
      expect(fest).toBe(0);
      const ergebnis = erstelleEintrag(
        {
          projektId: null,
          vorlageId,
          vorhaben: null,
          abschluss: null,
          erkenntnis: '',
          stunden: 1,
          notiz: '',
          meilenstein: false,
          faehigkeitId: null,
          datum: null,
        },
        ZEIT,
      );
      const gewichte = [
        { attributId: koerper, gewicht: 80 },
        { attributId: disziplin, gewicht: 50 },
      ];
      const voll = eintragXp(1, ergebnis.eintrag.faktor);
      const erwartet = verteileNachGewichten(voll, gewichte);
      expect(erwartet.reduce((summe, anteil) => summe + anteil.xp, 0)).toBe(voll);
      for (const anteil of erwartet) {
        const xp =
          eine<{ xp: number }>(
            `SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse
             WHERE eintrag_id = ? AND attribut_id = ? AND quelle = 'eintrag'`,
            ergebnis.eintrag.id,
            anteil.attributId,
          )?.xp ?? 0;
        expect(xp).toBe(anteil.xp);
      }
    });
  });
});
