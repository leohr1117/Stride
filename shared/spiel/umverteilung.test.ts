import { describe, expect, it } from 'vitest';
import { planeUmverteilung, zielXpNachAnteil } from './umverteilung.ts';

function summe(anteile: { xp: number }[]): number {
  let gesamt = 0;
  for (const anteil of anteile) {
    gesamt += anteil.xp;
  }
  return gesamt;
}

describe('planeUmverteilung', () => {
  const staende = [
    { attributId: 1, xp: 100 },
    { attributId: 2, xp: 6000 },
    { attributId: 3, xp: 3000 },
  ];

  it('hebt das Ziel an und nimmt die XP anteilig von den anderen', () => {
    const plan = planeUmverteilung(1, 1000, staende);
    expect(plan[0]).toEqual({ attributId: 1, xp: 900 });
    expect(plan.find((anteil) => anteil.attributId === 2)?.xp).toBe(-600);
    expect(plan.find((anteil) => anteil.attributId === 3)?.xp).toBe(-300);
    expect(summe(plan)).toBe(0);
  });

  it('gibt beim Senken die XP anteilig an die anderen ab', () => {
    const plan = planeUmverteilung(2, 3000, staende);
    expect(plan[0]).toEqual({ attributId: 2, xp: -3000 });
    expect(summe(plan)).toBe(0);
  });

  it('ändert nichts, wenn das Ziel schon erreicht ist', () => {
    expect(planeUmverteilung(1, 100, staende)).toEqual([]);
  });
});

describe('zielXpNachAnteil', () => {
  it('rechnet den früheren Anteil auf die heutigen Gesamt-XP um', () => {
    expect(zielXpNachAnteil(0.2, 10000)).toBe(2000);
  });
});
