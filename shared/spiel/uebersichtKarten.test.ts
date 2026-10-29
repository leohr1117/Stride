import { describe, expect, it } from 'vitest';
import { karteGewaehlt, kartenWahl, UEBERSICHT_KARTEN, UEBERSICHT_KARTEN_IDS } from './uebersichtKarten.ts';

describe('UEBERSICHT_KARTEN', () => {
  it('listet die Karten ohne Sprung zum Schalter', () => {
    expect(UEBERSICHT_KARTEN.map((karte) => karte.id)).toEqual([...UEBERSICHT_KARTEN_IDS]);
    expect(UEBERSICHT_KARTEN.every((karte) => !('nach' in karte))).toBe(true);
  });

  it('blendet nur eine ausdrücklich ausgeschaltete Karte aus', () => {
    expect(kartenWahl(undefined)).toEqual({
      identitaet: true,
      bosse: true,
      comeback: true,
      basis: true,
      werte: true,
      aktivitaet: true,
    });
    const aus = kartenWahl({ aktivitaet: false, fremd: true, identitaet: 'nein' });
    expect(aus.aktivitaet).toBe(false);
    expect(aus.identitaet).toBe(true);
    expect(aus).not.toHaveProperty('fremd');
    expect(karteGewaehlt('aktivitaet', { aktivitaet: false })).toBe(false);
    expect(karteGewaehlt('bosse', { aktivitaet: false })).toBe(true);
    expect(karteGewaehlt('bosse', undefined)).toBe(true);
  });
});
