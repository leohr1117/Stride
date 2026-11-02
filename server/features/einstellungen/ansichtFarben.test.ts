import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { standardVorlage } from '../../../shared/features/darstellung/paletten.ts';
import { ausfuehren, mitWelt, schliesseWelt } from '../../db.ts';
import { aendereEinstellungen, ladeEinstellungen } from './einstellungen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-ansicht-farben-'));
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

const minimal = { primaer: '#112233', akzent: '#445566', hintergrund: '#778899' };
const jade = { primaer: '#abcdef', akzent: '#123456', hintergrund: '#0a0a0a' };

describe('eigene Farben pro Ansicht', () => {
  it('behält die Farben der vorigen Ansicht beim Wechsel', () => {
    const datei = welt();
    mitWelt(datei, () => {
      aendereEinstellungen({ stil: 'minimal', ...minimal });
      const weg = aendereEinstellungen({ stil: 'jade' });
      expect(weg.stil).toBe('jade');
      expect(weg.eigeneFarben).toBe(false);
      expect(weg.primaer).toBe(standardVorlage('jade', false).primaer);
      expect(weg.ansichtFarben.minimal).toEqual(minimal);
      expect(weg.ansichtFarben.jade).toBeUndefined();

      aendereEinstellungen(jade);
      const holo = aendereEinstellungen({ stil: 'holo' });
      expect(holo.eigeneFarben).toBe(false);
      expect(holo.ansichtFarben.minimal).toEqual(minimal);
      expect(holo.ansichtFarben.jade).toEqual(jade);

      const zurueck = aendereEinstellungen({ stil: 'minimal' });
      expect(zurueck.eigeneFarben).toBe(true);
      expect(zurueck.primaer).toBe(minimal.primaer);
      expect(zurueck.akzent).toBe(minimal.akzent);
      expect(zurueck.hintergrund).toBe(minimal.hintergrund);

      const wiederJade = aendereEinstellungen({ stil: 'jade' });
      expect(wiederJade.primaer).toBe(jade.primaer);
      expect(wiederJade.eigeneFarben).toBe(true);
    });
  });

  it('setzt nur die aktuelle Ansicht zurück', () => {
    const datei = welt();
    mitWelt(datei, () => {
      aendereEinstellungen({ stil: 'minimal', ...minimal });
      aendereEinstellungen({ stil: 'jade', ...jade });
      const leer = aendereEinstellungen({ farbenZuruecksetzen: true });
      expect(leer.stil).toBe('jade');
      expect(leer.eigeneFarben).toBe(false);
      expect(leer.primaer).toBe(standardVorlage('jade', false).primaer);
      expect(leer.ansichtFarben.jade).toBeUndefined();
      expect(leer.ansichtFarben.minimal).toEqual(minimal);
      const minimalWieder = aendereEinstellungen({ stil: 'minimal' });
      expect(minimalWieder.primaer).toBe(minimal.primaer);
    });
  });

  it('rechnet ein altes Tripel der aktuellen Ansicht zu', () => {
    const datei = welt();
    mitWelt(datei, () => {
      setzeRoh('stil', 'antik');
      setzeRoh('primaer', '#8b7dff');
      setzeRoh('akzent', '#f5b942');
      setzeRoh('hintergrund', '#0e0e12');
      const geladen = ladeEinstellungen();
      expect(geladen.stil).toBe('antik');
      expect(geladen.eigeneFarben).toBe(true);
      expect(geladen.ansichtFarben.antik).toEqual({ primaer: '#8b7dff', akzent: '#f5b942', hintergrund: '#0e0e12' });

      const weg = aendereEinstellungen({ stil: 'minimal' });
      expect(weg.eigeneFarben).toBe(false);
      expect(weg.ansichtFarben.antik?.primaer).toBe('#8b7dff');
      const zurueck = aendereEinstellungen({ stil: 'antik' });
      expect(zurueck.eigeneFarben).toBe(true);
      expect(zurueck.akzent).toBe('#f5b942');
    });
  });
});
