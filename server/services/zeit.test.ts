import { describe, expect, it } from 'vitest';
import { datumPlus, lokalesDatum, tagesbeginn, zeitpunktFuerEintrag } from './zeit.ts';

const JETZT = new Date(2026, 9, 19, 18, 30);

describe('tagesbeginn', () => {
  it('liefert Mitternacht des Tages und rechnet Tage zurück', () => {
    expect(tagesbeginn(JETZT)).toEqual(new Date(2026, 9, 19));
    expect(tagesbeginn(JETZT, 6)).toEqual(new Date(2026, 9, 13));
  });
});

describe('lokalesDatum', () => {
  it('formatiert mit führenden Nullen', () => {
    expect(lokalesDatum(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('datumPlus', () => {
  it('zählt Tage über Monatsgrenzen', () => {
    expect(datumPlus('2026-10-22', 30)).toBe('2026-11-21');
    expect(datumPlus('2026-01-31', 1)).toBe('2026-02-01');
  });
});

describe('zeitpunktFuerEintrag', () => {
  it('nutzt jetzt ohne Datum oder für heute', () => {
    expect(zeitpunktFuerEintrag(null, JETZT)).toBe(JETZT);
    expect(zeitpunktFuerEintrag('2026-10-19', JETZT)).toBe(JETZT);
  });

  it('legt nachgetragene Tage auf die Mittagszeit', () => {
    expect(zeitpunktFuerEintrag('2026-10-17', JETZT)).toEqual(new Date(2026, 9, 17, 12));
  });

  it('lehnt Zukunft, ungültige Daten und falsche Formate ab', () => {
    expect(() => zeitpunktFuerEintrag('2026-10-20', JETZT)).toThrow('Zukunft');
    expect(() => zeitpunktFuerEintrag('2026-02-31', JETZT)).toThrow('existiert nicht');
    expect(() => zeitpunktFuerEintrag('19.10.2026', JETZT)).toThrow('Format');
  });
});
