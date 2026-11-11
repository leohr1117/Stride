import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { alle, mitWelt, schliesseWelt } from '../../db.ts';
import { leseJetzt, setzeTestzeit } from '../../services/zeit.ts';
import { lokalesDatum } from '../../../shared/spiel/datum.ts';
import { aendereEinstellungen, ladeEinstellungen } from './einstellungen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-streak-schalter-'));
const offen: string[] = [];
let nummer = 0;

function welt(): string {
  nummer += 1;
  const datei = path.join(ordner, `${nummer}.db`);
  offen.push(datei);
  return datei;
}

afterEach(() => {
  setzeTestzeit(null);
  for (const datei of offen) {
    schliesseWelt(datei);
  }
  offen.length = 0;
});

function pausen(): { von: string; bis: string | null }[] {
  return alle<{ von: string; bis: string | null }>('SELECT von, bis FROM streak_pausen ORDER BY id');
}

function mitDatum(datum: string, arbeit: () => void): void {
  const vorher = process.env.STRIDE_TEST;
  process.env.STRIDE_TEST = '1';
  setzeTestzeit(datum);
  try {
    mitWelt(welt(), arbeit);
  } finally {
    setzeTestzeit(null);
    if (vorher === undefined) {
      delete process.env.STRIDE_TEST;
    } else {
      process.env.STRIDE_TEST = vorher;
    }
  }
}

describe('Streak-Schalter', () => {
  it('öffnet beim Ausschalten eine Pause und legt beim gleichen Wert keine zweite an', () => {
    mitDatum('2026-05-02', () => {
      expect(lokalesDatum(leseJetzt())).toBe('2026-05-02');
      expect(aendereEinstellungen({ funktionen: { basis: true } }).funktionen.streak).toBe(true);
      expect(pausen()).toEqual([]);
      expect(aendereEinstellungen({ funktionen: { streak: false } }).funktionen.streak).toBe(false);
      expect(pausen()).toEqual([{ von: '2026-05-02', bis: null }]);
      aendereEinstellungen({ funktionen: { streak: false } });
      aendereEinstellungen({ funktionen: { basis: false } });
      expect(ladeEinstellungen().funktionen.streak).toBe(false);
      expect(pausen()).toEqual([{ von: '2026-05-02', bis: null }]);
    });
  });

  it('nimmt die Pause am selben Tag weg und setzt bis, wenn später wieder eingeschaltet wird', () => {
    mitDatum('2026-04-10', () => {
      aendereEinstellungen({ funktionen: { streak: false } });
      expect(aendereEinstellungen({ funktionen: { streak: true } }).funktionen.streak).toBe(true);
      expect(pausen()).toEqual([]);
      aendereEinstellungen({ funktionen: { streak: true } });
      expect(pausen()).toEqual([]);
    });
    mitDatum('2026-03-01', () => {
      aendereEinstellungen({ funktionen: { streak: false } });
      expect(pausen()).toEqual([{ von: '2026-03-01', bis: null }]);
      setzeTestzeit('2026-03-05');
      expect(aendereEinstellungen({ funktionen: { streak: true } }).funktionen.streak).toBe(true);
      expect(pausen()).toEqual([{ von: '2026-03-01', bis: '2026-03-04' }]);
    });
  });

  it('lässt Schalter und Pause stehen, wenn das Speichern scheitert', () => {
    mitDatum('2026-06-04', () => {
      expect(() => aendereEinstellungen({ funktionen: { streak: false }, zeitzone: 'Keine/Zone' })).toThrow(/Zeitzone/);
      expect(ladeEinstellungen().funktionen.streak).toBe(true);
      expect(pausen()).toEqual([]);
    });
  });
});
