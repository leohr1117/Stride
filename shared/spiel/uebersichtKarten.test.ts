import { describe, expect, it } from 'vitest';
import { karteGewaehlt, kartenWahl, UEBERSICHT_KARTEN, UEBERSICHT_KARTEN_IDS } from './uebersichtKarten.ts';

describe('UEBERSICHT_KARTEN', () => {
  it('listet die Karten und verweist nur auf den bestehenden Schalter', () => {
    expect(UEBERSICHT_KARTEN.map((karte) => karte.id)).toEqual([...UEBERSICHT_KARTEN_IDS]);
    expect(UEBERSICHT_KARTEN.find((karte) => karte.id === 'identitaet')?.nach).toBeUndefined();
    expect(UEBERSICHT_KARTEN.find((karte) => karte.id === 'aktivitaet')?.nach).toBeUndefined();
    expect(UEBERSICHT_KARTEN.find((karte) => karte.id === 'bosse')?.nach).toBe('/mehr/funktionen#funktion-bossAngriffe');
    expect(UEBERSICHT_KARTEN.find((karte) => karte.id === 'comeback')?.nach).toBe('/mehr/funktionen#ziel-stufen');
    expect(UEBERSICHT_KARTEN.find((karte) => karte.id === 'basis')?.nach).toBe('/mehr/funktionen#funktion-basis');
    expect(UEBERSICHT_KARTEN.find((karte) => karte.id === 'werte')?.nach).toBe('/mehr/funktionen#funktion-koennen');
    expect(UEBERSICHT_KARTEN.every((karte) => !karte.nach?.startsWith('/mehr/uebersicht'))).toBe(true);
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
