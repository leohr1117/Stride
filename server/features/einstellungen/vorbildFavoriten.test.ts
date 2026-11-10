import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ausfuehren, eine, mitWelt, schliesseWelt } from '../../db.ts';
import { exportiereDaten, importiereDaten } from '../daten/datensicherung.ts';
import { setzeProfilZurueck } from '../../services/profilZurueck.ts';
import { einstellungenAenderungSchema } from '../../validierung.ts';
import { aendereEinstellungen, ladeEinstellungen } from './einstellungen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-favoriten-'));
const offen: string[] = [];
let nummer = 0;

function welt(): string {
  nummer += 1;
  const datei = path.join(ordner, `${nummer}.db`);
  offen.push(datei);
  return datei;
}

afterEach(() => {
  for (const datei of offen) {
    schliesseWelt(datei);
  }
  offen.length = 0;
});

function setzeRoh(schluessel: string, wert: unknown): void {
  ausfuehren(
    `INSERT INTO einstellungen (schluessel, wert) VALUES (?, ?)
     ON CONFLICT (schluessel) DO UPDATE SET wert = excluded.wert`,
    schluessel,
    JSON.stringify(wert),
  );
}

describe('Vorbild-Favoriten', () => {
  it('hängt an, setzt zurück und lässt einen zweiten Tipp liegen', () => {
    const datei = welt();
    mitWelt(datei, () => {
      expect(ladeEinstellungen().vorbildFavoriten).toEqual([]);
      expect(aendereEinstellungen({ vorbildFavoritDazu: 'einstein' }).vorbildFavoriten).toEqual(['einstein']);
      expect(aendereEinstellungen({ vorbildFavoritDazu: 'einstein' }).vorbildFavoriten).toEqual(['einstein']);
      expect(aendereEinstellungen({ vorbildFavoritDazu: 'ali' }).vorbildFavoriten).toEqual(['einstein', 'ali']);
      expect(aendereEinstellungen({ vorbildFavoritWeg: 'einstein' }).vorbildFavoriten).toEqual(['ali']);
      expect(aendereEinstellungen({ vorbildFavoritWeg: 'einstein' }).vorbildFavoriten).toEqual(['ali']);
      expect(aendereEinstellungen({ vorbildFavoritDazu: 'einstein', vorbildFavoritIndex: 0 }).vorbildFavoriten).toEqual([
        'einstein',
        'ali',
      ]);
      expect(aendereEinstellungen({ vorbildFavoritDazu: 'einstein', vorbildFavoritIndex: 5 }).vorbildFavoriten).toEqual([
        'einstein',
        'ali',
      ]);
    });
  });

  it('lehnt den Durchschnitt und unbekannte Schlüssel ab', () => {
    const datei = welt();
    mitWelt(datei, () => {
      aendereEinstellungen({ vorbildFavoritDazu: 'einstein' });
      expect(() => aendereEinstellungen({ vorbildFavoritDazu: 'durchschnitt' })).toThrow(/unbekannt/);
      expect(() => aendereEinstellungen({ vorbildFavoritWeg: 'geist' })).toThrow(/unbekannt/);
      expect(ladeEinstellungen().vorbildFavoriten).toEqual(['einstein']);
      expect(einstellungenAenderungSchema.safeParse({ vorbildFavoritDazu: '' }).success).toBe(false);
      expect(einstellungenAenderungSchema.safeParse({ vorbildFavoritIndex: -1 }).success).toBe(false);
      expect(einstellungenAenderungSchema.parse({ vorbildFavoritDazu: ' einstein ' }).vorbildFavoritDazu).toBe('einstein');
      expect(einstellungenAenderungSchema.parse({ vorbildFavoriten: ['ali'] })).not.toHaveProperty('vorbildFavoriten');
    });
  });

  it('entfernt beim Lesen Schlüssel, die nicht mehr im Katalog stehen', () => {
    const datei = welt();
    mitWelt(datei, () => {
      setzeRoh('vorbildFavoriten', ['einstein', 'geist', 'durchschnitt', 'einstein', 'ronaldo']);
      expect(ladeEinstellungen().vorbildFavoriten).toEqual(['einstein']);
      const roh = eine<{ wert: string }>('SELECT wert FROM einstellungen WHERE schluessel = ?', 'vorbildFavoriten');
      expect(JSON.parse(roh?.wert ?? '[]')).toEqual(['einstein']);
    });
  });

  it('hält die Favoriten der Konten auseinander', () => {
    const anna = welt();
    const ben = welt();
    mitWelt(anna, () => aendereEinstellungen({ vorbildFavoritDazu: 'einstein' }));
    mitWelt(ben, () => aendereEinstellungen({ vorbildFavoritDazu: 'ali' }));
    expect(mitWelt(anna, () => ladeEinstellungen().vorbildFavoriten)).toEqual(['einstein']);
    expect(mitWelt(ben, () => ladeEinstellungen().vorbildFavoriten)).toEqual(['ali']);
  });

  it('geht in Sicherung und Import mit und verschwindet beim Zurücksetzen', () => {
    const datei = welt();
    mitWelt(datei, () => {
      aendereEinstellungen({ vorbildFavoritDazu: 'einstein' });
      const sicherung = exportiereDaten(new Date('2026-11-02T12:00:00.000Z'));
      const zeile = sicherung.tabellen.einstellungen?.find((eintrag) => eintrag.schluessel === 'vorbildFavoriten');
      expect(JSON.parse(String(zeile?.wert))).toEqual(['einstein']);
      aendereEinstellungen({ vorbildFavoritWeg: 'einstein' });
      expect(ladeEinstellungen().vorbildFavoriten).toEqual([]);
      importiereDaten(sicherung, new Date());
      expect(ladeEinstellungen().vorbildFavoriten).toEqual(['einstein']);
      expect(setzeProfilZurueck().vorbildFavoriten).toEqual([]);
    });
  });
});
