import { describe, expect, it } from 'vitest';
import { betragVorschlaege, rundeBetrag, wochenXp, type BetragPosten } from './betragVorschlag.ts';

const posten: BetragPosten[] = [
  { art: 'attribut', id: 1, xp: 240 },
  { art: 'attribut', id: 2, xp: 0 },
  { art: 'projekt', id: 9, xp: 520 },
  { art: 'vision', id: 4, xp: 80 },
];

describe('betragVorschlaege', () => {
  it('nimmt bei W = 0 die Untergrenze 50', () => {
    expect(betragVorschlaege([], 1, null, 4)).toEqual([
      { xp: 50, zeitraum: 'woche' },
      { xp: 50, zeitraum: 'monat' },
      { xp: 50, zeitraum: 'quartal' },
    ]);
    expect(wochenXp([{ art: 'attribut', id: 2, xp: 0 }], 2, null)).toBe(0);
  });

  it('rechnet W = 60 als Woche, Monat und drei Monate', () => {
    expect(wochenXp(posten, 1, null)).toBe(60);
    expect(betragVorschlaege(posten, 1, null, 2)).toEqual([
      { xp: 50, zeitraum: 'woche' },
      { xp: 250, zeitraum: 'monat' },
      { xp: 800, zeitraum: 'quartal' },
    ]);
  });

  it('rundet auf 50 und bleibt bei mindestens 50', () => {
    expect(rundeBetrag(0)).toBe(50);
    expect(rundeBetrag(25)).toBe(50);
    expect(rundeBetrag(40)).toBe(50);
    expect(rundeBetrag(160)).toBe(150);
    expect(rundeBetrag(520)).toBe(500);
    expect(rundeBetrag(325)).toBe(350);
    const vierzig: BetragPosten[] = [{ art: 'attribut', id: 3, xp: 160 }];
    expect(wochenXp(vierzig, 3, null)).toBe(40);
    expect(betragVorschlaege(vierzig, 3, null, 3)).toEqual([
      { xp: 50, zeitraum: 'woche' },
      { xp: 150, zeitraum: 'monat' },
      { xp: 500, zeitraum: 'quartal' },
    ]);
  });

  it('wechselt mit Bonus für und Auch für und zählt ein Ziel nur einmal', () => {
    expect(betragVorschlaege(posten, 2, null, 4)[0]).toEqual({ xp: 50, zeitraum: 'woche' });
    expect(wochenXp(posten, 2, { art: 'attribut', id: 1 })).toBe(60);
    expect(wochenXp(posten, 1, { art: 'attribut', id: 1 })).toBe(60);
    expect(wochenXp(posten, 2, { art: 'projekt', id: 9 })).toBe(130);
    expect(betragVorschlaege(posten, 2, { art: 'vision', id: 4 }, 4)).toEqual([
      { xp: 50, zeitraum: 'woche' },
      { xp: 100, zeitraum: 'monat' },
      { xp: 250, zeitraum: 'quartal' },
    ]);
    expect(betragVorschlaege(posten, 1, { art: 'projekt', id: 9 }, 1)).toEqual([
      { xp: 100, zeitraum: null },
      { xp: 300, zeitraum: null },
      { xp: 800, zeitraum: null },
    ]);
  });
});
