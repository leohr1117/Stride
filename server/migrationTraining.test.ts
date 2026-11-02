import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { GRENZEN } from '../shared/spiel/begriffe.ts';
import { migriere } from './db.ts';
import { MIGRATIONEN } from './migrationen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-migration-training-'));
const offen: DatabaseSync[] = [];
let nummer = 0;

const UEBUNGEN_SPALTEN = ['id', 'name', 'art', 'archiviert', 'erstellt_am'];
const PLAENE_SPALTEN = ['id', 'name', 'wochentage', 'vorlage_id', 'projekt_id', 'archiviert', 'erstellt_am'];
const PLAN_UEBUNGEN_SPALTEN = [
  'id',
  'plan_id',
  'uebung_id',
  'reihenfolge',
  'ziel_saetze',
  'ziel_wiederholungen',
  'ziel_gewicht_g',
  'ziel_sekunden',
  'aufwaerm_saetze',
  'aufwaerm_wiederholungen',
  'aufwaerm_gewicht_g',
  'aufwaerm_sekunden',
];
const EINHEITEN_SPALTEN = ['id', 'plan_id', 'eintrag_id', 'status', 'begonnen_am', 'beendet_am', 'krit_festgelegt'];
const SAETZE_SPALTEN = [
  'id',
  'einheit_id',
  'uebung_id',
  'reihenfolge',
  'gewicht_g',
  'wiederholungen',
  'sekunden',
  'aufwaermen',
  'erledigt',
];
const BESTWERTE_SPALTEN = ['id', 'uebung_id', 'art', 'wert', 'wiederholungen', 'satz_id', 'erreicht_am'];

const TABELLEN = [
  'uebungen',
  'trainingsplaene',
  'trainingsplan_uebungen',
  'trainingseinheiten',
  'trainingssaetze',
  'bestwerte',
];

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

function loeschregel(db: DatabaseSync, tabelle: string, spalte: string): string {
  const zeile = (db.prepare(`PRAGMA foreign_key_list(${tabelle})`).all() as { from: string; on_delete: string }[]).find(
    (eintrag) => eintrag.from === spalte,
  );
  if (!zeile) {
    throw new Error(`Fremdschlüssel fehlt: ${tabelle}.${spalte}`);
  }
  return zeile.on_delete;
}

function einfuegen(db: DatabaseSync, tabelle: string, werte: Record<string, SQLInputValue>): number {
  const namen = Object.keys(werte);
  const ergebnis = db
    .prepare(`INSERT INTO ${tabelle} (${namen.join(', ')}) VALUES (${namen.map(() => '?').join(', ')})`)
    .run(...namen.map((name) => werte[name]));
  return Number(ergebnis.lastInsertRowid);
}

function anzahl(db: DatabaseSync, tabelle: string): number {
  return (db.prepare(`SELECT COUNT(*) AS anzahl FROM ${tabelle}`).get() as { anzahl: number }).anzahl;
}

function grundlage(db: DatabaseSync): { vorlageId: number; projektId: number; uebungId: number; planId: number } {
  const vorlageId = einfuegen(db, 'vorlagen', { name: 'Training', icon: 'dumbbell' });
  const projektId = einfuegen(db, 'projekte', { standard_vorlage_id: vorlageId, name: 'Kraft' });
  const uebungId = einfuegen(db, 'uebungen', { name: 'Kniebeuge', art: 'kraft' });
  const planId = einfuegen(db, 'trainingsplaene', {
    name: 'Unterkörper',
    wochentage: '1,3,5',
    vorlage_id: vorlageId,
    projekt_id: projektId,
  });
  return { vorlageId, projektId, uebungId, planId };
}

function zuordnung(db: DatabaseSync, planId: number, uebungId: number, extra: Record<string, SQLInputValue> = {}): number {
  return einfuegen(db, 'trainingsplan_uebungen', {
    plan_id: planId,
    uebung_id: uebungId,
    reihenfolge: 1,
    ziel_saetze: 3,
    ziel_wiederholungen: 5,
    ziel_gewicht_g: 80000,
    ...extra,
  });
}

function einheit(db: DatabaseSync, planId: number | null, extra: Record<string, SQLInputValue> = {}): number {
  return einfuegen(db, 'trainingseinheiten', {
    plan_id: planId,
    status: 'offen',
    begonnen_am: '2026-10-24T08:00:00.000Z',
    ...extra,
  });
}

function satz(db: DatabaseSync, einheitId: number, uebungId: number, extra: Record<string, SQLInputValue> = {}): number {
  return einfuegen(db, 'trainingssaetze', {
    einheit_id: einheitId,
    uebung_id: uebungId,
    reihenfolge: 1,
    gewicht_g: 80000,
    wiederholungen: 5,
    ...extra,
  });
}

describe('Migration 24', () => {
  it('hängt die Trainingstabellen als 24. Migration an', () => {
    expect(MIGRATIONEN.length).toBeGreaterThanOrEqual(26);
    const sql = MIGRATIONEN[23];
    for (const tabelle of TABELLEN) {
      expect(sql).toContain(`CREATE TABLE ${tabelle}`);
      expect(MIGRATIONEN.slice(0, 23).some((eintrag) => eintrag.includes(`CREATE TABLE ${tabelle}`))).toBe(false);
    }
    expect(sql).not.toContain('gewicht_einheit');
    expect(sql).not.toContain('ALTER TABLE eintraege');
    expect(sql).not.toContain('ALTER TABLE einstellungen');
    expect(sql).toContain('ziel_saetze INTEGER NOT NULL');
    expect(MIGRATIONEN[24]).toContain('ziel_saetze IS NULL OR ziel_saetze BETWEEN 1 AND 20');
  });

  it('legt die Spalten an und lässt eintraege und einstellungen unverändert', () => {
    const db = datenbank();
    migriere(db, 23);
    expect(version(db)).toBe(23);
    const eintraege = spalten(db, 'eintraege');
    expect(spalten(db, 'einstellungen')).toEqual(['schluessel', 'wert']);
    for (const tabelle of TABELLEN) {
      expect(tabelleDa(db, tabelle)).toBe(false);
    }

    migriere(db, 24);
    expect(version(db)).toBe(24);
    const vor25 = grundlage(db);
    expect(() => zuordnung(db, vor25.planId, vor25.uebungId, { ziel_saetze: null })).toThrow(/constraint/i);

    migriere(db);
    expect(version(db)).toBe(MIGRATIONEN.length);
    expect(spalten(db, 'uebungen')).toEqual(UEBUNGEN_SPALTEN);
    expect(spalten(db, 'trainingsplaene')).toEqual(PLAENE_SPALTEN);
    expect(spalten(db, 'trainingsplan_uebungen')).toEqual(PLAN_UEBUNGEN_SPALTEN);
    expect(spalten(db, 'trainingseinheiten')).toEqual(EINHEITEN_SPALTEN);
    expect(spalten(db, 'trainingssaetze')).toEqual(SAETZE_SPALTEN);
    expect(spalten(db, 'bestwerte')).toEqual(BESTWERTE_SPALTEN);
    expect(spalten(db, 'eintraege')).toEqual(eintraege);
    expect(eintraege).not.toContain('gewicht_einheit');
    expect(spalten(db, 'einstellungen')).toEqual(['schluessel', 'wert']);
    expect(db.prepare(`SELECT name FROM sqlite_master WHERE sql LIKE '%gewicht_einheit%'`).get()).toBeUndefined();

    expect(loeschregel(db, 'trainingsplan_uebungen', 'plan_id')).toBe('CASCADE');
    expect(loeschregel(db, 'trainingsplan_uebungen', 'uebung_id')).toBe('NO ACTION');
    expect(loeschregel(db, 'trainingsplaene', 'vorlage_id')).toBe('NO ACTION');
    expect(loeschregel(db, 'trainingsplaene', 'projekt_id')).toBe('NO ACTION');
    expect(loeschregel(db, 'trainingseinheiten', 'plan_id')).toBe('NO ACTION');
    expect(loeschregel(db, 'trainingseinheiten', 'eintrag_id')).toBe('CASCADE');
    expect(loeschregel(db, 'trainingssaetze', 'einheit_id')).toBe('CASCADE');
    expect(loeschregel(db, 'trainingssaetze', 'uebung_id')).toBe('NO ACTION');
    expect(loeschregel(db, 'bestwerte', 'uebung_id')).toBe('NO ACTION');
    expect(loeschregel(db, 'bestwerte', 'satz_id')).toBe('CASCADE');
  });

  it('nimmt gültige Zeilen und weist die Checks ab', () => {
    const db = datenbank();
    migriere(db);
    const { vorlageId, projektId, uebungId, planId } = grundlage(db);
    const dauerId = einfuegen(db, 'uebungen', { name: 'Unterarmstütz', art: 'dauer' });
    einfuegen(db, 'trainingsplaene', { name: 'Ohne Tag' });
    einfuegen(db, 'uebungen', { name: 'A'.repeat(GRENZEN.nameMax), art: 'kraft' });
    einfuegen(db, 'trainingsplaene', { name: 'B'.repeat(GRENZEN.nameMax) });

    zuordnung(db, planId, uebungId, { aufwaerm_saetze: 2, aufwaerm_wiederholungen: 5, aufwaerm_gewicht_g: 40000 });
    zuordnung(db, planId, dauerId, {
      reihenfolge: 2,
      ziel_wiederholungen: null,
      ziel_gewicht_g: null,
      ziel_sekunden: 45,
      aufwaerm_saetze: 1,
      aufwaerm_sekunden: 20,
    });
    zuordnung(db, planId, uebungId, { reihenfolge: 3, ziel_saetze: 1, ziel_gewicht_g: null });
    zuordnung(db, planId, uebungId, { reihenfolge: 4, ziel_saetze: 20, ziel_wiederholungen: 1 });
    const laufband = zuordnung(db, planId, dauerId, {
      reihenfolge: 5, ziel_saetze: null, ziel_wiederholungen: null, ziel_gewicht_g: null, ziel_sekunden: 600,
    });
    expect(db.prepare('SELECT ziel_saetze, ziel_sekunden FROM trainingsplan_uebungen WHERE id = ?').get(laufband)).toEqual({ ziel_saetze: null, ziel_sekunden: 600 });

    const einheitId = einheit(db, planId);
    const ohnePlan = einheit(db, null);
    expect(ohnePlan).toBeGreaterThan(0);
    expect(anzahl(db, 'trainingseinheiten')).toBe(2);
    expect((db.prepare('SELECT archiviert AS wert FROM uebungen WHERE id = ?').get(uebungId) as { wert: number }).wert).toBe(0);
    expect(
      (db.prepare('SELECT krit_festgelegt AS wert FROM trainingseinheiten WHERE id = ?').get(einheitId) as { wert: number }).wert,
    ).toBe(0);
    const satzId = satz(db, einheitId, uebungId);
    expect((db.prepare('SELECT aufwaermen AS wert FROM trainingssaetze WHERE id = ?').get(satzId) as { wert: number }).wert).toBe(0);
    expect((db.prepare('SELECT erledigt AS wert FROM trainingssaetze WHERE id = ?').get(satzId) as { wert: number }).wert).toBe(0);
    satz(db, einheitId, dauerId, { reihenfolge: 2, gewicht_g: null, wiederholungen: null, sekunden: 45, aufwaermen: 1 });
    const bestwertId = einfuegen(db, 'bestwerte', {
      uebung_id: uebungId,
      art: 'gewicht',
      wert: 80000,
      wiederholungen: 5,
      satz_id: satzId,
      erreicht_am: '2026-10-24T08:10:00.000Z',
    });
    einfuegen(db, 'bestwerte', {
      uebung_id: uebungId,
      art: 'eins',
      wert: 93333,
      wiederholungen: 5,
      satz_id: satzId,
      erreicht_am: '2026-10-24T08:10:00.000Z',
    });
    const dauerSatz = satz(db, einheitId, dauerId, {
      reihenfolge: 3,
      gewicht_g: null,
      wiederholungen: null,
      sekunden: 45,
    });
    einfuegen(db, 'bestwerte', {
      uebung_id: dauerId,
      art: 'dauer',
      wert: 45,
      satz_id: dauerSatz,
      erreicht_am: '2026-10-24T08:12:00.000Z',
    });
    expect(bestwertId).toBeGreaterThan(0);
    expect(
      (db.prepare('SELECT erstellt_am AS zeit FROM uebungen WHERE id = ?').get(uebungId) as { zeit: string }).zeit,
    ).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const eintrag = einfuegen(db, 'eintraege', { vorlage_id: vorlageId, erstellt_am: '2026-10-24T08:00:00.000Z' });
    einheit(db, planId, { status: 'fertig', beendet_am: '2026-10-24T09:00:00.000Z', eintrag_id: eintrag });
    expect(() => einheit(db, planId, { eintrag_id: eintrag })).toThrow(/constraint/i);

    expect(() => einfuegen(db, 'uebungen', { name: 'A'.repeat(GRENZEN.nameMax + 1), art: 'kraft' })).toThrow(/constraint/i);
    expect(() => einfuegen(db, 'uebungen', { name: 'Lauf', art: 'cardio' })).toThrow(/constraint/i);
    expect(() => einfuegen(db, 'trainingsplaene', { name: 'C'.repeat(GRENZEN.nameMax + 1) })).toThrow(/constraint/i);
    expect(() => zuordnung(db, planId, uebungId, { ziel_saetze: 0 })).toThrow(/constraint/i);
    expect(() => zuordnung(db, planId, uebungId, { ziel_saetze: 21 })).toThrow(/constraint/i);
    expect(() => zuordnung(db, planId, uebungId, { ziel_wiederholungen: 0 })).toThrow(/constraint/i);
    expect(() => zuordnung(db, planId, uebungId, { ziel_sekunden: 45 })).toThrow(/constraint/i);
    expect(() => zuordnung(db, planId, uebungId, { ziel_sekunden: 45, ziel_wiederholungen: null, ziel_gewicht_g: 1000 })).toThrow(
      /constraint/i,
    );
    expect(() => zuordnung(db, planId, uebungId, { aufwaerm_saetze: 21 })).toThrow(/constraint/i);
    expect(() =>
      zuordnung(db, planId, dauerId, {
        ziel_wiederholungen: null,
        ziel_gewicht_g: null,
        ziel_sekunden: 45,
        aufwaerm_wiederholungen: 5,
        aufwaerm_sekunden: 20,
      }),
    ).toThrow(/constraint/i);
    expect(() => einheit(db, planId, { status: 'abgebrochen' })).toThrow(/constraint/i);
    expect(() => einheit(db, planId, { krit_festgelegt: 1 })).toThrow(/constraint/i);
    expect(() => satz(db, einheitId, uebungId, { wiederholungen: 5, sekunden: 30 })).toThrow(/constraint/i);
    expect(() => satz(db, einheitId, dauerId, { gewicht_g: 1000, wiederholungen: null, sekunden: 30 })).toThrow(/constraint/i);
    expect(() =>
      einfuegen(db, 'bestwerte', {
        uebung_id: uebungId,
        art: 'xp',
        wert: 1,
        satz_id: satzId,
        erreicht_am: '2026-10-24T08:10:00.000Z',
      }),
    ).toThrow(/constraint/i);
    expect(() =>
      einfuegen(db, 'bestwerte', {
        uebung_id: uebungId,
        art: 'gewicht',
        wert: 80000,
        satz_id: satzId,
        erreicht_am: '2026-10-24T08:10:00.000Z',
      }),
    ).toThrow(/constraint/i);
    expect(() =>
      einfuegen(db, 'bestwerte', {
        uebung_id: dauerId,
        art: 'dauer',
        wert: 45,
        wiederholungen: 5,
        satz_id: dauerSatz,
        erreicht_am: '2026-10-24T08:12:00.000Z',
      }),
    ).toThrow(/constraint/i);
    expect(() =>
      einfuegen(db, 'bestwerte', {
        uebung_id: uebungId,
        art: 'eins',
        wert: 0,
        wiederholungen: 5,
        satz_id: satzId,
        erreicht_am: '2026-10-24T08:10:00.000Z',
      }),
    ).toThrow(/constraint/i);
    expect(() => db.prepare('DELETE FROM projekte WHERE id = ?').run(projektId)).toThrow(/constraint/i);
    expect(() => db.prepare('DELETE FROM vorlagen WHERE id = ?').run(vorlageId)).toThrow(/constraint/i);
  });

  it('koppelt Löschen an Plan, Satz und Eintrag und hält die Übung', () => {
    const db = datenbank();
    migriere(db);
    const { vorlageId, uebungId, planId } = grundlage(db);
    zuordnung(db, planId, uebungId);
    const laufend = einheit(db, planId);
    const satzId = satz(db, laufend, uebungId);
    einfuegen(db, 'bestwerte', {
      uebung_id: uebungId,
      art: 'gewicht',
      wert: 80000,
      wiederholungen: 5,
      satz_id: satzId,
      erreicht_am: '2026-10-24T08:10:00.000Z',
    });

    expect(() => db.prepare('DELETE FROM trainingsplaene WHERE id = ?').run(planId)).toThrow(/constraint/i);
    expect(anzahl(db, 'trainingsplan_uebungen')).toBe(1);
    expect(() => db.prepare('DELETE FROM uebungen WHERE id = ?').run(uebungId)).toThrow(/constraint/i);

    db.prepare('DELETE FROM trainingseinheiten WHERE id = ?').run(laufend);
    expect(anzahl(db, 'trainingssaetze')).toBe(0);
    expect(anzahl(db, 'bestwerte')).toBe(0);
    expect(anzahl(db, 'uebungen')).toBe(1);
    expect(anzahl(db, 'trainingsplaene')).toBe(1);

    db.prepare('DELETE FROM trainingsplaene WHERE id = ?').run(planId);
    expect(anzahl(db, 'trainingsplan_uebungen')).toBe(0);
    expect(anzahl(db, 'uebungen')).toBe(1);

    const nochmal = grundlage(db);
    const zweite = einheit(db, nochmal.planId);
    const zweiterSatz = satz(db, zweite, nochmal.uebungId);
    einfuegen(db, 'bestwerte', {
      uebung_id: nochmal.uebungId,
      art: 'eins',
      wert: 93333,
      wiederholungen: 5,
      satz_id: zweiterSatz,
      erreicht_am: '2026-10-24T08:20:00.000Z',
    });
    const eintrag = einfuegen(db, 'eintraege', {
      vorlage_id: vorlageId,
      projekt_id: nochmal.projektId,
      erstellt_am: '2026-10-24T08:00:00.000Z',
    });
    db.prepare('UPDATE trainingseinheiten SET eintrag_id = ? WHERE id = ?').run(eintrag, zweite);
    db.prepare('DELETE FROM eintraege WHERE id = ?').run(eintrag);
    expect(anzahl(db, 'trainingseinheiten')).toBe(0);
    expect(anzahl(db, 'trainingssaetze')).toBe(0);
    expect(anzahl(db, 'bestwerte')).toBe(0);
    expect(anzahl(db, 'uebungen')).toBe(2);
    expect(anzahl(db, 'trainingsplaene')).toBe(1);
  });
});
