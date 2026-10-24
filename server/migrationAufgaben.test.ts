import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { GRENZEN } from '../shared/spiel/begriffe.ts';
import { migriere } from './db.ts';
import { MIGRATIONEN } from './migrationen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-migration-aufgaben-'));
const offen: DatabaseSync[] = [];
let nummer = 0;

const AUFGABEN_SPALTEN = [
  'id',
  'name',
  'icon',
  'projekt_id',
  'vorlage_id',
  'stunden',
  'faellig_am',
  'wiederholung',
  'wochentage',
  'monatstag',
  'prioritaet',
  'nur_heute_am',
  'faellig_um',
  'organisation_id',
  'vision_id',
  'meilenstein',
  'gegner',
  'boss',
  'deadline',
  'angriff_bis',
  'archiviert',
  'erstellt_am',
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

function grundlage(db: DatabaseSync): { vorlageId: number; projektId: number } {
  const vorlageId = einfuegen(db, 'vorlagen', { name: 'Tun', icon: 'star' });
  const projektId = einfuegen(db, 'projekte', { standard_vorlage_id: vorlageId, name: 'Sache' });
  return { vorlageId, projektId };
}

function aufgabe(db: DatabaseSync, vorlageId: number, extra: Record<string, SQLInputValue> = {}): number {
  return einfuegen(db, 'aufgaben', { name: 'Arzt anrufen', icon: 'clipboard-list', vorlage_id: vorlageId, ...extra });
}

describe('Migration 23', () => {
  it('hängt die Aufgaben-Tabellen als 23. Migration an', () => {
    expect(MIGRATIONEN.length).toBeGreaterThanOrEqual(23);
    expect(MIGRATIONEN[22]).toContain('CREATE TABLE aufgaben');
    expect(MIGRATIONEN[22]).toContain('CREATE TABLE aufgaben_erledigt');
    expect(MIGRATIONEN[22]).toContain('ADD COLUMN aufgabe_id');
    expect(MIGRATIONEN.slice(0, 22).some((sql) => sql.includes('CREATE TABLE aufgaben'))).toBe(false);
    expect(MIGRATIONEN.slice(0, 22).some((sql) => sql.includes('ADD COLUMN aufgabe_id'))).toBe(false);
  });

  it('legt die Spalten an und lässt eintraege unverändert', () => {
    const db = datenbank();
    migriere(db, 22);
    expect(version(db)).toBe(22);
    expect(spalten(db, 'eintraege')).not.toContain('aufgabe_id');
    expect(db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'aufgaben'`).get()).toBeUndefined();

    migriere(db, 23);
    expect(version(db)).toBe(23);
    expect(spalten(db, 'aufgaben')).toEqual(AUFGABEN_SPALTEN);
    expect(spalten(db, 'aufgaben')).not.toContain('vorhaben_id');
    expect(spalten(db, 'aufgaben_erledigt')).toEqual(['id', 'aufgabe_id', 'vorkommen', 'eintrag_id', 'erledigt_am']);
    expect(spalten(db, 'eintraege')).not.toContain('aufgabe_id');
    expect(spalten(db, 'xp_ereignisse')).toContain('aufgabe_id');
    expect(loeschregel(db, 'aufgaben_erledigt', 'aufgabe_id')).toBe('NO ACTION');
    expect(loeschregel(db, 'aufgaben_erledigt', 'eintrag_id')).toBe('CASCADE');
    expect(loeschregel(db, 'xp_ereignisse', 'aufgabe_id')).toBe('CASCADE');
    expect(db.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'xp_ereignisse_aufgabe'`).get()).toEqual({
      name: 'xp_ereignisse_aufgabe',
    });
  });

  it('nimmt eine gültige Aufgabe und weist die Checks aus Abschnitt 6 ab', () => {
    const db = datenbank();
    migriere(db);
    const { vorlageId, projektId } = grundlage(db);
    const id = aufgabe(db, vorlageId, {
      projekt_id: projektId,
      faellig_am: '2026-10-24',
      faellig_um: '09:00',
      wiederholung: 'keine',
      prioritaet: 1,
      monatstag: 31,
    });
    expect(id).toBeGreaterThan(0);
    aufgabe(db, vorlageId, { projekt_id: projektId, vorlage_id: null });
    aufgabe(db, vorlageId, { name: 'A'.repeat(GRENZEN.nameMax), gegner: 1, deadline: '2026-10-30' });
    aufgabe(db, vorlageId, { boss: 1, meilenstein: 1, deadline: '2026-10-30', wiederholung: 'keine' });
    aufgabe(db, vorlageId, { faellig_am: '2026-10-24', faellig_um: '23:59' });

    expect(() => aufgabe(db, vorlageId, { name: 'A'.repeat(GRENZEN.nameMax + 1) })).toThrow(/constraint/i);
    expect(() => aufgabe(db, vorlageId, { vorlage_id: null, projekt_id: null })).toThrow(/constraint/i);
    expect(() => aufgabe(db, vorlageId, { prioritaet: 0 })).toThrow(/constraint/i);
    expect(() => aufgabe(db, vorlageId, { prioritaet: 5 })).toThrow(/constraint/i);
    expect(() => aufgabe(db, vorlageId, { monatstag: 32 })).toThrow(/constraint/i);
    expect(() => aufgabe(db, vorlageId, { faellig_um: '09:00' })).toThrow(/constraint/i);
    expect(() => aufgabe(db, vorlageId, { faellig_am: '2026-10-24', faellig_um: '24:00' })).toThrow(/constraint/i);
    expect(() => aufgabe(db, vorlageId, { faellig_am: '2026-10-24', faellig_um: '9:00' })).toThrow(/constraint/i);
    expect(() => aufgabe(db, vorlageId, { wiederholung: 'jaehrlich' })).toThrow(/constraint/i);
    expect(() => aufgabe(db, vorlageId, { gegner: 1, meilenstein: 1 })).toThrow(/constraint/i);
    expect(() => aufgabe(db, vorlageId, { gegner: 1, boss: 1 })).toThrow(/constraint/i);
    expect(() => aufgabe(db, vorlageId, { gegner: 1, wiederholung: 'taeglich', faellig_am: '2026-10-24' })).toThrow(/constraint/i);
    expect(() => aufgabe(db, vorlageId, { boss: 1 })).toThrow(/constraint/i);
    expect(() => aufgabe(db, vorlageId, { boss: 1, meilenstein: 1, gegner: 1 })).toThrow(/constraint/i);
    expect(() => aufgabe(db, vorlageId, { deadline: '2026-10-30' })).toThrow(/constraint/i);
  });

  it('koppelt Erledigt ohne Cascade und gibt den Angriff mit der Aufgabe frei', () => {
    const db = datenbank();
    migriere(db);
    const { vorlageId } = grundlage(db);
    const erste = aufgabe(db, vorlageId);
    const eintrag = einfuegen(db, 'eintraege', { vorlage_id: vorlageId, erstellt_am: '2026-10-24T12:00:00.000Z' });
    einfuegen(db, 'aufgaben_erledigt', {
      aufgabe_id: erste,
      vorkommen: '2026-10-24',
      eintrag_id: eintrag,
      erledigt_am: '2026-10-24T12:00:00.000Z',
    });
    expect(() =>
      einfuegen(db, 'aufgaben_erledigt', {
        aufgabe_id: erste,
        vorkommen: '2026-10-24',
        eintrag_id: einfuegen(db, 'eintraege', { vorlage_id: vorlageId, erstellt_am: '2026-10-24T13:00:00.000Z' }),
        erledigt_am: '2026-10-24T13:00:00.000Z',
      }),
    ).toThrow(/constraint/i);
    expect(() => db.prepare('DELETE FROM aufgaben WHERE id = ?').run(erste)).toThrow(/constraint/i);
    db.prepare('DELETE FROM eintraege WHERE id = ?').run(eintrag);
    expect(db.prepare('SELECT COUNT(*) AS anzahl FROM aufgaben_erledigt').get()).toEqual({ anzahl: 0 });
    db.prepare('DELETE FROM aufgaben WHERE id = ?').run(erste);

    const zweite = aufgabe(db, vorlageId);
    einfuegen(db, 'xp_ereignisse', {
      quelle: 'bossangriff',
      attribut_id: 1,
      xp: -2,
      erstellt_am: '2026-10-24T12:00:00.000Z',
      aufgabe_id: zweite,
    });
    db.prepare('DELETE FROM aufgaben WHERE id = ?').run(zweite);
    expect(db.prepare('SELECT COUNT(*) AS anzahl FROM xp_ereignisse WHERE aufgabe_id IS NOT NULL').get()).toEqual({ anzahl: 0 });
  });
});
