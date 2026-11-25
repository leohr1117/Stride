import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DATENBANK_SCHWELLE_MS,
  EREIGNIS_SCHWELLE_MS,
  datenbankMeldung,
  ereignisMeldung,
  sqlOhneDaten,
  starteMessung,
} from './messung.ts';

const NS_JE_MS = 1_000_000;

describe('Messung', () => {
  const stoppen: Array<() => void> = [];

  afterEach(() => {
    while (stoppen.length > 0) {
      stoppen.pop()?.();
    }
    vi.useRealTimers();
  });

  it('meldet die Event-Loop-Verzögerung erst ab der Schwelle', () => {
    expect(ereignisMeldung((EREIGNIS_SCHWELLE_MS - 1) * NS_JE_MS)).toBeNull();
    expect(ereignisMeldung(EREIGNIS_SCHWELLE_MS * NS_JE_MS)).toBe(
      `Event-Loop-Verzögerung ${EREIGNIS_SCHWELLE_MS} ms`,
    );
  });

  it('meldet langsame Zugriffe erst ab der Schwelle', () => {
    const sql = "SELECT name FROM konten WHERE name = 'Ada'";
    expect(datenbankMeldung(sql, DATENBANK_SCHWELLE_MS - 1)).toBeNull();
    const text = datenbankMeldung(sql, DATENBANK_SCHWELLE_MS);
    expect(text).toContain(`Langsamer Datenbankzugriff ${DATENBANK_SCHWELLE_MS} ms`);
    expect(text).toContain('FROM konten');
    expect(text).not.toContain('Ada');
  });

  it('lässt FROM- und INTO-Tabellennamen stehen', () => {
    const auswahl = sqlOhneDaten("SELECT 'Ada' FROM konten WHERE name = 'O''Brien'");
    const eintrag = sqlOhneDaten("/* 'alt' */ INSERT INTO eintraege (titel) VALUES ('Mein Titel')");
    const genannt = sqlOhneDaten('SELECT id FROM "konten" WHERE name = \'Ada\'');
    expect(auswahl).not.toContain("'");
    expect(eintrag).not.toContain("'");
    expect(genannt).not.toContain('Ada');
    expect(auswahl).not.toContain('Brien');
    expect(eintrag).not.toContain('Mein Titel');
    expect(auswahl).toContain('WHERE');
    expect(genannt).toContain('"konten"');
    expect(eintrag).toContain('VALUES');
    expect(auswahl).toContain('FROM konten');
    expect(eintrag).toContain('INTO eintraege');
  });

  it('schreibt die Verzögerung im Takt und lässt Werte unter der Schwelle weg', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    const zeilen: string[] = [];
    const stop = starteMessung((text) => zeilen.push(text), {
      liesVerzoegerungNs: () => (EREIGNIS_SCHWELLE_MS - 1) * NS_JE_MS,
      taktMs: 10_000,
    });
    stoppen.push(stop);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(zeilen).toEqual([]);
    stop();
    const weiter = starteMessung((text) => zeilen.push(text), {
      liesVerzoegerungNs: () => EREIGNIS_SCHWELLE_MS * NS_JE_MS,
      taktMs: 10_000,
    });
    stoppen.push(weiter);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(zeilen).toEqual([`Event-Loop-Verzögerung ${EREIGNIS_SCHWELLE_MS} ms`]);
  });

  it('protokolliert Abfragen ohne gebundene Werte und ohne Texte', () => {
    const zeilen: string[] = [];
    const stop = starteMessung((text) => zeilen.push(text), {
      datenbankSchwelleMs: 0,
      taktMs: 60_000,
      liesVerzoegerungNs: () => 0,
    });
    stoppen.push(stop);
    const db = new DatabaseSync(':memory:');
    try {
      db.exec('CREATE TABLE konten (name TEXT)');
      db.prepare('INSERT INTO konten (name) VALUES (?)').run('Ada Lovelace');
      db.prepare("SELECT name FROM konten WHERE name = 'geheim'").get();
    } finally {
      db.close();
      stop();
    }
    const text = zeilen.join('\n');
    expect(text).toContain('INTO konten');
    expect(text).toContain('FROM konten');
    expect(text).not.toContain('Ada');
    expect(text).not.toContain('Lovelace');
    expect(text).not.toContain('geheim');
    expect(text).not.toContain("'");
  });
});
