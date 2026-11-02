import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { HINWEIS_SCHLUESSEL } from '../../../shared/spiel/hinweis.ts';
import { alle, ausfuehren, eine, mitWelt, schliesseWelt } from '../../db.ts';
import { aendereEinstellungen, ladeEinstellungen } from './einstellungen.ts';
import {
  leseHinweisAngebotGesehen,
  leseHinweisAngebotTesten,
  leseHinweisNichtVor,
  leseHinweisRuhe,
  leseHinweisSchalter,
  schreibeHinweisAngebotGesehen,
  schreibeHinweisAngebotTesten,
  schreibeHinweisRuhe,
  schreibeHinweisSchalter,
  setzeHinweisNichtVorWennFehlt,
  type HinweisSchalter,
} from './hinweisSchluessel.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-hinweis-schluessel-'));
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

function hinweisZeilen(): string[] {
  return alle<{ schluessel: string }>(
    `SELECT schluessel FROM einstellungen WHERE schluessel LIKE 'hinweis_%' ORDER BY schluessel`,
  ).map((zeile) => zeile.schluessel);
}

function roh(schluessel: string): unknown {
  const zeile = eine<{ wert: string }>('SELECT wert FROM einstellungen WHERE schluessel = ?', schluessel);
  return zeile ? (JSON.parse(zeile.wert) as unknown) : undefined;
}

function mitUmgebung(wert: string | undefined, arbeit: () => void): void {
  const vorher = process.env.STRIDE_TEST;
  if (wert === undefined) {
    delete process.env.STRIDE_TEST;
  } else {
    process.env.STRIDE_TEST = wert;
  }
  try {
    arbeit();
  } finally {
    if (vorher === undefined) {
      delete process.env.STRIDE_TEST;
    } else {
      process.env.STRIDE_TEST = vorher;
    }
  }
}

describe('Hinweis-Schlüssel', () => {
  it('liest Vorgaben, ohne eine Zeile zu schreiben', () => {
    mitWelt(welt(), () => {
      expect(leseHinweisRuhe()).toEqual({ von: '22:00', bis: '08:00' });
      expect(leseHinweisSchalter()).toEqual({ streak: false, rueckkehr: false, boss: false });
      expect(leseHinweisAngebotGesehen()).toBe(false);
      expect(leseHinweisNichtVor()).toBeNull();
      expect(leseHinweisAngebotTesten()).toBe(false);
      expect(hinweisZeilen()).toEqual([]);
      expect(JSON.stringify(ladeEinstellungen())).not.toContain('hinweis_');
    });
  });

  it('behält eine ungültige Ruhezeit und fällt beim Lesen auf die Vorgabe zurück', () => {
    mitWelt(welt(), () => {
      ausfuehren(
        'INSERT INTO einstellungen (schluessel, wert) VALUES (?, ?)',
        HINWEIS_SCHLUESSEL.ruheVon,
        JSON.stringify('25:00'),
      );
      expect(leseHinweisRuhe().von).toBe('22:00');
      expect(roh(HINWEIS_SCHLUESSEL.ruheVon)).toBe('25:00');
      schreibeHinweisRuhe('24:00', '07:00');
      expect(roh(HINWEIS_SCHLUESSEL.ruheVon)).toBe('25:00');
      expect(roh(HINWEIS_SCHLUESSEL.ruheBis)).toBeUndefined();
    });
  });

  it('schreibt Ruhezeit, Schalter und Angebot als eigene Zeilen', () => {
    mitWelt(welt(), () => {
      schreibeHinweisRuhe('23:15', '06:40');
      schreibeHinweisRuhe('08:00', '08:00');
      expect(leseHinweisRuhe()).toEqual({ von: '08:00', bis: '08:00' });
      schreibeHinweisSchalter({ streak: true });
      schreibeHinweisSchalter({ faellig: true, training: true, streak: false, boss: true } as Partial<HinweisSchalter>);
      expect(leseHinweisSchalter()).toEqual({ streak: false, rueckkehr: false, boss: true });
      schreibeHinweisAngebotGesehen();
      schreibeHinweisAngebotGesehen();
      expect(leseHinweisAngebotGesehen()).toBe(true);
      expect(roh(HINWEIS_SCHLUESSEL.angebot)).toBe('gesehen');
      expect(hinweisZeilen()).toEqual([
        'hinweis_angebot',
        'hinweis_boss',
        'hinweis_ruhe_bis',
        'hinweis_ruhe_von',
        'hinweis_streak',
      ]);
      expect(hinweisZeilen()).not.toContain('hinweis_faellig');
      expect(hinweisZeilen()).not.toContain('hinweis_training');
    });
  });

  it('schreibt den Testschlüssel nur unter STRIDE_TEST', () => {
    mitWelt(welt(), () => {
      mitUmgebung(undefined, () => {
        schreibeHinweisAngebotTesten(true);
        expect(leseHinweisAngebotTesten()).toBe(false);
        expect(roh(HINWEIS_SCHLUESSEL.angebotTesten)).toBeUndefined();
      });
      mitUmgebung('1', () => {
        schreibeHinweisAngebotTesten(true);
        expect(leseHinweisAngebotTesten()).toBe(true);
        schreibeHinweisAngebotTesten(false);
        expect(leseHinweisAngebotTesten()).toBe(false);
        expect(roh(HINWEIS_SCHLUESSEL.angebotTesten)).toBeUndefined();
      });
    });
  });

  it('setzt nicht_vor bei der ersten Anlage auf jetzt plus 60 Sekunden und lässt eine vorhandene Zeile', () => {
    mitWelt(welt(), () => {
      setzeHinweisNichtVorWennFehlt(new Date('2026-10-28T12:00:00.000Z'));
      expect(leseHinweisNichtVor()).toBe('2026-10-28T12:01:00.000Z');
      setzeHinweisNichtVorWennFehlt(new Date('2026-10-28T18:00:00.000Z'));
      expect(leseHinweisNichtVor()).toBe('2026-10-28T12:01:00.000Z');
    });
    mitWelt(welt(), () => {
      ausfuehren(
        'INSERT INTO einstellungen (schluessel, wert) VALUES (?, ?)',
        HINWEIS_SCHLUESSEL.nichtVor,
        JSON.stringify('1999-01-01T00:00:00.000Z'),
      );
      aendereEinstellungen({ profilAngelegt: true });
      expect(leseHinweisNichtVor()).toBe('1999-01-01T00:00:00.000Z');
    });
    mitWelt(welt(), () => {
      const vorher = Date.now();
      const geladen = aendereEinstellungen({ profilAngelegt: true });
      const iso = leseHinweisNichtVor();
      expect(iso).not.toBeNull();
      const abstand = Date.parse(iso ?? '') - vorher;
      expect(abstand).toBeGreaterThanOrEqual(60_000);
      expect(abstand).toBeLessThan(65_000);
      expect(Object.keys(geladen).some((name) => name.includes('hinweis'))).toBe(false);
      expect(JSON.stringify(geladen.funktionen)).not.toContain('hinweis');
      const funktionen = roh('funktionen');
      if (funktionen !== undefined) {
        expect(JSON.stringify(funktionen)).not.toContain('hinweis_');
      }
      expect(hinweisZeilen()).toEqual(['hinweis_nicht_vor']);
      const fest = leseHinweisNichtVor();
      aendereEinstellungen({ profilAngelegt: true, sound: false });
      expect(leseHinweisNichtVor()).toBe(fest);
    });
  });

  it('legt den Schlüssel nicht an, wenn die Anlage scheitert oder das Profil schon da ist', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ sound: false });
      expect(leseHinweisNichtVor()).toBeNull();
      expect(hinweisZeilen()).toEqual([]);
    });
    mitWelt(welt(), () => {
      expect(() =>
        aendereEinstellungen({
          profilAngelegt: true,
          zielstrebigkeit: 'einfach',
          startZiel: { art: 'vision', name: 'Daneben' },
        }),
      ).toThrow(/Das erste Ziel passt nicht/);
      expect(ladeEinstellungen().profilAngelegt).toBe(false);
      expect(leseHinweisNichtVor()).toBeNull();
      expect(hinweisZeilen()).toEqual([]);
    });
  });

  it('nimmt Hinweis-Schlüssel nicht in den Funktionen-Speicher', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({
        funktionen: { hinweis_faellig: true, hinweis_training: true, hinweis_streak: true } as never,
      });
      const gespeichert = roh('funktionen');
      expect(JSON.stringify(gespeichert)).not.toContain('hinweis_');
      expect(hinweisZeilen()).toEqual([]);
      expect(leseHinweisSchalter()).toEqual({ streak: false, rueckkehr: false, boss: false });
    });
  });
});
