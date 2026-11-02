import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { standardVorlage } from '../../../shared/features/darstellung/paletten.ts';
import { ausfuehren, mitWelt, schliesseWelt } from '../../db.ts';
import { einstellungenAenderungSchema } from '../../validierung.ts';
import { aendereEinstellungen, ladeEinstellungen } from './einstellungen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-paletten-'));
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

const trio = { primaer: '#d0d0d0', akzent: '#9a9a9a', hintergrund: '#141414' };

describe('eigene Paletten', () => {
  it('nutzt Standard, wenn noch keine Ansicht gespeichert ist', () => {
    const datei = welt();
    mitWelt(datei, () => {
      const daten = ladeEinstellungen();
      const vorlage = standardVorlage('standard', false);
      expect(daten.stil).toBe('standard');
      expect(daten.primaer).toBe(vorlage.primaer);
      expect(daten.akzent).toBe(vorlage.akzent);
      expect(daten.hintergrund).toBe(vorlage.hintergrund);
      expect(daten.paletten).toEqual([]);
    });
  });

  it('legt an, lehnt doppelte Namen ab und löscht wiederholbar', () => {
    const datei = welt();
    mitWelt(datei, () => {
      const angelegt = aendereEinstellungen({ paletteNeu: { name: '  Morgenrot ', primaer: '#AABBCC', akzent: '#445566', hintergrund: '#778899' } });
      expect(angelegt.paletten).toHaveLength(1);
      expect(angelegt.paletten[0]?.name).toBe('Morgenrot');
      expect(angelegt.paletten[0]?.primaer).toBe('#aabbcc');
      const id = angelegt.paletten[0]?.id ?? '';
      expect(id.length).toBeGreaterThan(0);

      expect(() => aendereEinstellungen({ paletteNeu: { name: 'morgenrot', ...trio } })).toThrow(/Der Name ist schon vergeben/);
      expect(ladeEinstellungen().paletten).toHaveLength(1);

      const umbenannt = aendereEinstellungen({ paletteAendern: { id, name: 'Abendrot', ...trio } });
      expect(umbenannt.paletten[0]?.name).toBe('Abendrot');
      expect(umbenannt.paletten[0]?.id).toBe(id);

      expect(() =>
        aendereEinstellungen({ paletteAendern: { id: 'fehlt', name: 'Andere', ...trio } }),
      ).toThrow(/Die Palette wurde nicht gefunden/);
      expect(ladeEinstellungen().paletten).toHaveLength(1);

      const weg = aendereEinstellungen({ paletteLoeschen: id });
      expect(weg.paletten).toEqual([]);
      expect(aendereEinstellungen({ paletteLoeschen: id }).paletten).toEqual([]);
    });
  });

  it('behält die Liste beim Ansichtswechsel und verwirft kaputte Einträge', () => {
    const datei = welt();
    mitWelt(datei, () => {
      const angelegt = aendereEinstellungen({ paletteNeu: { name: 'Morgenrot', ...trio } });
      aendereEinstellungen({ stil: 'jade', primaer: '#112233', akzent: '#445566', hintergrund: '#778899' });
      const zurueck = aendereEinstellungen({ stil: 'standard', farbenZuruecksetzen: true });
      expect(zurueck.paletten).toEqual(angelegt.paletten);
      expect(zurueck.stil).toBe('standard');
      expect(zurueck.ansichtFarben.standard).toBeUndefined();
      expect(zurueck.ansichtFarben.jade).toEqual({ primaer: '#112233', akzent: '#445566', hintergrund: '#778899' });

      setzeRoh('paletten', [
        { id: 'a', name: 'Gut', primaer: '#112233', akzent: '#445566', hintergrund: '#778899' },
        { id: 'b', name: '', primaer: 'nein', akzent: '#445566', hintergrund: '#778899' },
        { id: 'a', name: 'Doppelt', primaer: '#112233', akzent: '#445566', hintergrund: '#778899' },
      ]);
      expect(ladeEinstellungen().paletten).toEqual([
        { id: 'a', name: 'Gut', primaer: '#112233', akzent: '#445566', hintergrund: '#778899' },
      ]);
    });
  });

  it('liest gespeichertes schlicht als Standard, auch die Farben', () => {
    const datei = welt();
    mitWelt(datei, () => {
      setzeRoh('stil', 'schlicht');
      setzeRoh('ansichtFarben', { schlicht: { primaer: '#112233', akzent: '#445566', hintergrund: '#778899' } });
      const daten = ladeEinstellungen();
      expect(daten.stil).toBe('standard');
      expect(daten.ansichtFarben.standard).toEqual({ primaer: '#112233', akzent: '#445566', hintergrund: '#778899' });
      expect(daten.ansichtFarben).not.toHaveProperty('schlicht');
      expect(einstellungenAenderungSchema.parse({ stil: 'schlicht' }).stil).toBe('standard');
    });
  });

  it('stoppt bei 24 und lehnt eine ungültige Farbe ab', () => {
    const datei = welt();
    mitWelt(datei, () => {
      for (let index = 0; index < 24; index += 1) {
        aendereEinstellungen({ paletteNeu: { name: `Palette ${index}`, ...trio } });
      }
      expect(ladeEinstellungen().paletten).toHaveLength(24);
      expect(() => aendereEinstellungen({ paletteNeu: { name: 'Zu viel', ...trio } })).toThrow(/Höchstens 24/);
      expect(ladeEinstellungen().paletten).toHaveLength(24);
      expect(() =>
        einstellungenAenderungSchema.parse({ paletteNeu: { name: 'A', primaer: 'rot', akzent: '#112233', hintergrund: '#445566' } }),
      ).toThrow();
      const ohneListe = einstellungenAenderungSchema.parse({ paletten: [] });
      expect(ohneListe).not.toHaveProperty('paletten');
    });
  });
});
