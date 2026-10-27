import { describe, expect, it } from 'vitest';
import { UEBERSICHT_KARTEN, UEBERSICHT_KARTEN_IDS } from './uebersichtKarten.ts';

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
});
