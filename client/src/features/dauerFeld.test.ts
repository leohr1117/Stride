import { afterEach, describe, expect, it } from 'vitest';
import { setzeAktiveSprache } from '../../../shared/sprache/index.ts';
import {
  bereinigeDauer,
  dauerAnfang,
  dauerInSchreibweise,
  dauerTextZuZahl,
  schreibweiseAusRoh,
} from './dauerFeld.ts';

describe('dauerTextZuZahl und bereinigeDauer', () => {
  afterEach(() => {
    setzeAktiveSprache('de');
  });

  it('nimmt 0,25 und 24 an und weist 0,2 und 24,5 ab', () => {
    expect(dauerTextZuZahl('')).toMatchObject({ stunden: null, fehler: null, unfertig: false });
    expect(dauerTextZuZahl(bereinigeDauer('0,25'))).toMatchObject({ stunden: 0.25, fehler: null, unfertig: false });
    expect(dauerTextZuZahl('0.25').stunden).toBe(0.25);
    expect(dauerTextZuZahl('0.2').fehler).toBeTruthy();
    expect(dauerTextZuZahl('0.2').stunden).toBeNull();
    expect(dauerTextZuZahl('24')).toMatchObject({ stunden: 24, fehler: null, unfertig: false });
    expect(dauerTextZuZahl('24.5').fehler).toBeTruthy();
    expect(dauerTextZuZahl('24.5').stunden).toBeNull();
  });

  it('rechnet 1,5 als 1.5 und lässt 1. unfertig', () => {
    expect(bereinigeDauer('1,5')).toBe('1.5');
    expect(dauerTextZuZahl(bereinigeDauer('1,5')).stunden).toBe(1.5);
    expect(dauerTextZuZahl('1.')).toMatchObject({ stunden: null, fehler: null, unfertig: true });
    expect(dauerTextZuZahl(bereinigeDauer('1,')).unfertig).toBe(true);
  });
});

describe('Schreibweise der Dauer', () => {
  afterEach(() => {
    setzeAktiveSprache('de');
  });

  it('schreibt Komma in de, es, fr und ru und Punkt in en, zh und ja', () => {
    for (const sprache of ['de', 'es', 'fr', 'ru'] as const) {
      setzeAktiveSprache(sprache);
      expect(dauerInSchreibweise(0.25)).toBe('0,25');
      expect(dauerInSchreibweise(4)).toBe('4');
      expect(schreibweiseAusRoh('1.5')).toBe('1,5');
      expect(schreibweiseAusRoh('1,')).toBe('1,');
    }
    for (const sprache of ['en', 'zh', 'ja'] as const) {
      setzeAktiveSprache(sprache);
      expect(dauerInSchreibweise(0.25)).toBe('0.25');
      expect(dauerInSchreibweise(4)).toBe('4');
      expect(schreibweiseAusRoh('1,5')).toBe('1.5');
      expect(schreibweiseAusRoh('1.')).toBe('1.');
    }
  });

  it('legt eine kurze Dauer auf den Chip und alles andere ins eigene Feld', () => {
    setzeAktiveSprache('de');
    expect(dauerAnfang(null)).toEqual({ stunden: null, text: '', eigene: false });
    expect(dauerAnfang(0.25)).toEqual({ stunden: 0.25, text: '', eigene: false });
    expect(dauerAnfang(0.5).eigene).toBe(false);
    expect(dauerAnfang(1).eigene).toBe(false);
    expect(dauerAnfang(2).eigene).toBe(false);
    expect(dauerAnfang(4)).toEqual({ stunden: 4, text: '4', eigene: true });
    expect(dauerAnfang(1.5)).toEqual({ stunden: 1.5, text: '1,5', eigene: true });
    setzeAktiveSprache('en');
    expect(dauerAnfang(4)).toEqual({ stunden: 4, text: '4', eigene: true });
    expect(dauerAnfang(0.25)).toEqual({ stunden: 0.25, text: '', eigene: false });
    expect(dauerAnfang(1.5).text).toBe('1.5');
  });
});
