import { mkdirSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KONFIG } from './config.ts';
import {
  eine,
  halteWelt,
  istWeltGeoeffnet,
  mitWelt,
  mitWeltAsync,
  schliesseUnbenutzteWelten,
  schliesseWelt,
  WELT_LEERLAUF_MS,
  WELT_OBERGRENZE,
} from './db.ts';

const basis = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'tmp-test', 'db-wartezeit');
mkdirSync(basis, { recursive: true });
const offen: string[] = [];

function welt(): string {
  const datei = path.join(mkdtempSync(path.join(basis, 'lauf-')), 'welt.db');
  offen.push(datei);
  return datei;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const datei of offen.splice(0)) {
    schliesseWelt(datei);
  }
});

function takt(start: number): { stelle: (wert: number) => void } {
  let wert = start;
  vi.spyOn(Date, 'now').mockImplementation(() => wert);
  return {
    stelle: (neu: number) => {
      wert = neu;
    },
  };
}

describe('oeffneDatenbank', () => {
  it('setzt busy_timeout der Welt auf 5000 Millisekunden', () => {
    const zeile = mitWelt(welt(), () => eine<{ timeout: number }>('PRAGMA busy_timeout'));
    expect(Number(zeile?.timeout)).toBe(5000);
  });
});

describe('Welt-Leerlauf', () => {
  it('schließt eine Welt nach 10 Minuten, nicht davor und nicht die Standard-Datenbank', () => {
    expect(WELT_LEERLAUF_MS).toBe(10 * 60 * 1000);
    const start = Date.now();
    const uhr = takt(start);
    const datei = welt();
    mitWelt(datei, () => {
      uhr.stelle(start + WELT_LEERLAUF_MS);
      schliesseUnbenutzteWelten();
      schliesseWelt(datei);
      expect(istWeltGeoeffnet(datei)).toBe(true);
      expect(eine<{ n: number }>('SELECT 1 AS n')?.n).toBe(1);
    });
    schliesseUnbenutzteWelten();
    expect(istWeltGeoeffnet(datei)).toBe(true);
    uhr.stelle(start + WELT_LEERLAUF_MS + WELT_LEERLAUF_MS - 1);
    schliesseUnbenutzteWelten();
    expect(istWeltGeoeffnet(datei)).toBe(true);
    uhr.stelle(start + WELT_LEERLAUF_MS + WELT_LEERLAUF_MS);
    schliesseUnbenutzteWelten();
    expect(istWeltGeoeffnet(datei)).toBe(false);
    expect(istWeltGeoeffnet(KONFIG.datenbankPfad)).toBe(true);
    expect(eine<{ n: number }>('SELECT 1 AS n')?.n).toBe(1);
    mitWelt(datei, () => {
      expect(eine<{ n: number }>('SELECT 1 AS n')?.n).toBe(1);
    });
    expect(istWeltGeoeffnet(datei)).toBe(true);
  });

  it('schließt nicht während mitWeltAsync und danach nach dem Leerlauf', async () => {
    const start = Date.now();
    const uhr = takt(start);
    const datei = welt();
    let offen = false;
    await mitWeltAsync(datei, async () => {
      await Promise.resolve();
      uhr.stelle(start + WELT_LEERLAUF_MS);
      schliesseUnbenutzteWelten();
      schliesseWelt(datei);
      offen = istWeltGeoeffnet(datei);
      expect(eine<{ n: number }>('SELECT 1 AS n')?.n).toBe(1);
    });
    expect(offen).toBe(true);
    uhr.stelle(start + WELT_LEERLAUF_MS + WELT_LEERLAUF_MS);
    schliesseUnbenutzteWelten();
    expect(istWeltGeoeffnet(datei)).toBe(false);
    expect(istWeltGeoeffnet(KONFIG.datenbankPfad)).toBe(true);
  });

  it('schließt nicht, solange die Anfrage die Welt hält', async () => {
    const start = Date.now();
    const uhr = takt(start);
    const datei = welt();
    let los = (): void => {};
    await new Promise<void>((fertig, abbruch) => {
      mitWelt(datei, () => {
        los = halteWelt(datei);
        void Promise.resolve().then(() => {
          try {
            uhr.stelle(start + WELT_LEERLAUF_MS);
            schliesseUnbenutzteWelten();
            schliesseWelt(datei);
            expect(istWeltGeoeffnet(datei)).toBe(true);
            expect(eine<{ n: number }>('SELECT 1 AS n')?.n).toBe(1);
            fertig();
          } catch (fehler) {
            abbruch(fehler);
          }
        });
      });
    });
    los();
    uhr.stelle(start + WELT_LEERLAUF_MS + WELT_LEERLAUF_MS);
    schliesseUnbenutzteWelten();
    expect(istWeltGeoeffnet(datei)).toBe(false);
  });
});

describe('Obergrenze offener Welten', () => {
  it('verdrängt die längst ungenutzte Welt und lässt eine genutzte offen', () => {
    expect(WELT_OBERGRENZE).toBe(32);
    const start = Date.now();
    let wert = start;
    vi.spyOn(Date, 'now').mockImplementation(() => wert);
    const dateien: string[] = [];
    for (let index = 0; index < WELT_OBERGRENZE; index += 1) {
      wert += 1000;
      const datei = welt();
      dateien.push(datei);
      mitWelt(datei, () => eine('SELECT 1 AS n'));
    }
    expect(istWeltGeoeffnet(dateien[0]!)).toBe(true);
    expect(istWeltGeoeffnet(KONFIG.datenbankPfad)).toBe(true);
    wert += 1000;
    const zusaetzlich = welt();
    mitWelt(dateien[0]!, () => {
      mitWelt(zusaetzlich, () => eine('SELECT 1 AS n'));
      expect(istWeltGeoeffnet(dateien[0]!)).toBe(true);
    });
    expect(istWeltGeoeffnet(dateien[1]!)).toBe(false);
    expect(istWeltGeoeffnet(dateien[2]!)).toBe(true);
    expect(istWeltGeoeffnet(zusaetzlich)).toBe(true);
    expect(istWeltGeoeffnet(KONFIG.datenbankPfad)).toBe(true);
    expect(eine<{ n: number }>('SELECT 1 AS n')?.n).toBe(1);
  }, 30000);
});
