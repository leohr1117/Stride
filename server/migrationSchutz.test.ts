import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { migriere } from './db.ts';
import { MIGRATIONEN } from './migrationen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-migration-schutz-'));
const offen: DatabaseSync[] = [];
let nummer = 0;

const BRUECKEN_SPALTEN = ['id', 'tag', 'erstellt_am'];
const RUECKKEHR_SPALTEN = ['id', 'status', 'geoeffnet_am', 'frist_am', 'eintrag_id'];
const PROTOKOLL_SPALTEN = ['id', 'art', 'bezug_typ', 'bezug_id', 'tag', 'erstellt_am'];

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

function vorlage(db: DatabaseSync): number {
  return einfuegen(db, 'vorlagen', { name: 'Tun', icon: 'star' });
}

describe('Migration 27', () => {
  it('hängt die Schutz-Tabellen als 27. Migration an', () => {
    expect(MIGRATIONEN).toHaveLength(27);
    const sql = MIGRATIONEN[26];
    expect(sql).toContain('CREATE TABLE streak_bruecken');
    expect(sql).toContain('CREATE TABLE rueckkehr');
    expect(sql).toContain('CREATE TABLE protokoll');
    expect(sql).not.toContain('ALTER TABLE eintraege');
    expect(sql).not.toContain('einstellungen');
    expect(sql).not.toContain('CREATE TABLE push_abos');
    for (const tabelle of ['streak_bruecken', 'rueckkehr', 'protokoll']) {
      expect(MIGRATIONEN.slice(0, 26).some((eintrag) => eintrag.includes(`CREATE TABLE ${tabelle}`))).toBe(false);
    }
  });

  it('legt die Spalten erst ab Version 27 an und lässt alte Zeilen liegen', () => {
    const db = datenbank();
    migriere(db, 26);
    expect(version(db)).toBe(26);
    const eintraege = spalten(db, 'eintraege');
    expect(spalten(db, 'einstellungen')).toEqual(['schluessel', 'wert']);
    for (const tabelle of ['streak_bruecken', 'rueckkehr', 'protokoll']) {
      expect(tabelleDa(db, tabelle)).toBe(false);
    }
    const vorlageId = vorlage(db);
    const eintragId = einfuegen(db, 'eintraege', { vorlage_id: vorlageId, erstellt_am: '2026-10-28T12:00:00.000Z' });
    einfuegen(db, 'einstellungen', { schluessel: 'sprache', wert: 'de' });
    const einstellungen = (db.prepare('SELECT COUNT(*) AS anzahl FROM einstellungen').get() as { anzahl: number }).anzahl;

    migriere(db, 27);
    expect(version(db)).toBe(27);
    expect(spalten(db, 'streak_bruecken')).toEqual(BRUECKEN_SPALTEN);
    expect(spalten(db, 'rueckkehr')).toEqual(RUECKKEHR_SPALTEN);
    expect(spalten(db, 'protokoll')).toEqual(PROTOKOLL_SPALTEN);
    expect(spalten(db, 'eintraege')).toEqual(eintraege);
    expect(eintraege).not.toContain('schutz');
    expect(spalten(db, 'einstellungen')).toEqual(['schluessel', 'wert']);
    expect((db.prepare('SELECT COUNT(*) AS anzahl FROM einstellungen').get() as { anzahl: number }).anzahl).toBe(einstellungen);
    expect((db.prepare('SELECT COUNT(*) AS anzahl FROM eintraege').get() as { anzahl: number }).anzahl).toBe(1);
    expect((db.prepare('SELECT id FROM eintraege').get() as { id: number }).id).toBe(eintragId);
    for (const tabelle of ['streak_bruecken', 'rueckkehr', 'protokoll']) {
      expect((db.prepare(`SELECT COUNT(*) AS anzahl FROM ${tabelle}`).get() as { anzahl: number }).anzahl).toBe(0);
    }
    const namen = (
      db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('streak_bruecken', 'rueckkehr', 'protokoll') ORDER BY name`,
        )
        .all() as { name: string }[]
    ).map((zeile) => zeile.name);
    expect(namen).toEqual(['protokoll', 'rueckkehr', 'streak_bruecken']);
  });

  it('nimmt gültige Zeilen und weist die Regeln ab', () => {
    const db = datenbank();
    migriere(db);
    expect(version(db)).toBe(27);
    const vorlageId = vorlage(db);
    const eintragId = einfuegen(db, 'eintraege', { vorlage_id: vorlageId, erstellt_am: '2026-10-28T12:00:00.000Z' });

    const bruecke = einfuegen(db, 'streak_bruecken', { tag: '2026-10-28' });
    const zeit = db.prepare('SELECT erstellt_am FROM streak_bruecken WHERE id = ?').get(bruecke) as { erstellt_am: string };
    expect(zeit.erstellt_am).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$/);
    expect(() => einfuegen(db, 'streak_bruecken', { tag: '2026-10-28' })).toThrow(/constraint/i);
    expect(() => einfuegen(db, 'streak_bruecken', { tag: '28.10.2026' })).toThrow(/constraint/i);
    expect(() => einfuegen(db, 'streak_bruecken', { tag: '2026-10-28T00:00:00Z' })).toThrow(/constraint/i);

    const offenId = einfuegen(db, 'rueckkehr', {
      status: 'offen',
      geoeffnet_am: '2026-10-28',
      frist_am: '2026-11-04',
    });
    einfuegen(db, 'rueckkehr', { status: 'zu', geoeffnet_am: '2026-10-01', frist_am: '2026-10-08' });
    const gebunden = einfuegen(db, 'rueckkehr', {
      status: 'geschafft',
      geoeffnet_am: '2026-09-01',
      frist_am: '2026-09-08',
      eintrag_id: eintragId,
    });
    expect(loeschregel(db, 'rueckkehr', 'eintrag_id')).toBe('SET NULL');
    expect(() =>
      einfuegen(db, 'rueckkehr', {
        status: 'weg',
        geoeffnet_am: '2026-08-01',
        frist_am: '2026-08-08',
      }),
    ).toThrow(/constraint/i);
    expect(() =>
      einfuegen(db, 'rueckkehr', {
        status: 'offen',
        geoeffnet_am: '2026-08-01',
        frist_am: '2026-08-08',
        eintrag_id: eintragId,
      }),
    ).toThrow(/constraint/i);
    expect(() =>
      einfuegen(db, 'rueckkehr', {
        status: 'offen',
        geoeffnet_am: '01.08.2026',
        frist_am: '2026-08-08',
      }),
    ).toThrow(/constraint/i);

    einfuegen(db, 'protokoll', { art: 'schutz_verdient', tag: '2026-10-28' });
    einfuegen(db, 'protokoll', { art: 'push_spaeter', bezug_typ: 'rueckkehr', bezug_id: offenId });
    expect(() => einfuegen(db, 'protokoll', { art: 'rueckkehr_offen', tag: '28.10.2026' })).toThrow(/constraint/i);
    expect(spalten(db, 'protokoll')).not.toContain('text');
    expect(spalten(db, 'protokoll')).not.toContain('notiz');

    db.prepare('DELETE FROM eintraege WHERE id = ?').run(eintragId);
    const nachLoeschen = db.prepare('SELECT eintrag_id FROM rueckkehr WHERE id = ?').get(gebunden) as { eintrag_id: number | null };
    expect(nachLoeschen.eintrag_id).toBeNull();
    expect((db.prepare('SELECT COUNT(*) AS anzahl FROM rueckkehr').get() as { anzahl: number }).anzahl).toBe(3);
    expect((db.prepare('SELECT COUNT(*) AS anzahl FROM protokoll').get() as { anzahl: number }).anzahl).toBe(2);
  });
});
