import { describe, expect, it } from 'vitest';
import { betragVorschlaege, rundeBetrag, wochenXp, type BetragPosten } from './betragVorschlag.ts';

const posten: BetragPosten[] = [
  { art: 'attribut', id: 1, xp: 240 },
  { art: 'attribut', id: 2, xp: 0 },
  { art: 'projekt', id: 9, xp: 520 },
  { art: 'vision', id: 4, xp: 80 },
];

const fest = [100, 300, 800];

function woche(xp: number, id = 3): BetragPosten[] {
  return [{ art: 'attribut', id, xp }];
}

describe('betragVorschlaege', () => {
  it('nimmt bei W = 0 die festen Beträge', () => {
    expect(wochenXp([{ art: 'attribut', id: 2, xp: 0 }], 2, null)).toBe(0);
    expect(betragVorschlaege([], 1, null, 4)).toEqual(fest);
  });

  it('nimmt bei W = 10 den Fallback', () => {
    expect(wochenXp(woche(40), 3, null)).toBe(10);
    expect(betragVorschlaege(woche(40), 3, null, 4)).toEqual(fest);
  });

  it('rechnet W = 200 als 200, 800 und 2600', () => {
    expect(wochenXp(woche(800, 7), 7, null)).toBe(200);
    expect(betragVorschlaege(woche(800, 7), 7, null, 4)).toEqual([200, 800, 2600]);
  });

  it('liefert nie doppelte Werte, auch wenn die Rundung zusammenfiele', () => {
    expect(wochenXp(woche(16), 3, null)).toBe(4);
    expect(rundeBetrag(4)).toBe(0);
    expect(rundeBetrag(16)).toBe(0);
    expect(rundeBetrag(52)).toBe(50);
    expect(betragVorschlaege(woche(16), 3, null, 4)).toEqual(fest);

    const ueberlauf: BetragPosten[] = [{ art: 'attribut', id: 3, xp: Number.MAX_VALUE }];
    const grenze = wochenXp(ueberlauf, 3, null);
    expect(grenze).toBeGreaterThanOrEqual(50);
    const roh = [rundeBetrag(grenze), rundeBetrag(4 * grenze), rundeBetrag(13 * grenze)];
    expect(roh[0]! < roh[1]! && roh[1]! < roh[2]!).toBe(false);
    const werte = betragVorschlaege(ueberlauf, 3, null, 4);
    expect(werte).toEqual(fest);
    expect(new Set(werte).size).toBe(3);
  });

  it('bleibt bei normalen Wochenwerten streng aufsteigend', () => {
    for (const w of [50, 60, 74, 75, 130, 190, 200, 325, 999]) {
      const werte = betragVorschlaege(woche(w * 4), 3, null, 4);
      expect(werte, `W=${w}`).toHaveLength(3);
      expect(new Set(werte).size, `W=${w}`).toBe(3);
      expect(werte[0], `W=${w}`).toBeLessThan(werte[1]!);
      expect(werte[1], `W=${w}`).toBeLessThan(werte[2]!);
    }
  });

  it('rundet auf 50', () => {
    expect(rundeBetrag(0)).toBe(0);
    expect(rundeBetrag(25)).toBe(50);
    expect(rundeBetrag(40)).toBe(50);
    expect(rundeBetrag(160)).toBe(150);
    expect(rundeBetrag(520)).toBe(500);
    expect(rundeBetrag(325)).toBe(350);
    expect(rundeBetrag(2600)).toBe(2600);
  });

  it('rechnet W = 60 als 50, 250 und 800', () => {
    expect(wochenXp(posten, 1, null)).toBe(60);
    expect(betragVorschlaege(posten, 1, null, 2)).toEqual([50, 250, 800]);
  });

  it('wechselt mit Bonus für und Auch für und zählt ein Ziel nur einmal', () => {
    expect(betragVorschlaege(posten, 2, null, 4)).toEqual(fest);
    expect(wochenXp(posten, 2, { art: 'attribut', id: 1 })).toBe(60);
    expect(wochenXp(posten, 1, { art: 'attribut', id: 1 })).toBe(60);
    expect(wochenXp(posten, 2, { art: 'projekt', id: 9 })).toBe(130);
    expect(wochenXp(posten, null, { art: 'projekt', id: 9 })).toBe(130);
    expect(wochenXp(posten, null, { art: 'vision', id: 4 })).toBe(20);
    expect(betragVorschlaege(posten, null, { art: 'projekt', id: 9 }, 4)).toEqual([150, 500, 1700]);
    expect(betragVorschlaege(posten, 2, { art: 'vision', id: 4 }, 4)).toEqual(fest);
    expect(betragVorschlaege(posten, 1, { art: 'projekt', id: 9 }, 1)).toEqual(fest);
    expect(betragVorschlaege(posten, 2, { art: 'projekt', id: 9 }, 4)).toEqual([150, 500, 1700]);
  });

  it('nimmt unter zwei Wochen die festen Beträge', () => {
    expect(betragVorschlaege(woche(800, 7), 7, null, 1)).toEqual(fest);
    expect(betragVorschlaege(woche(800, 7), 7, null, 0)).toEqual(fest);
  });
});
