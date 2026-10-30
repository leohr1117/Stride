import { describe, expect, it } from 'vitest';
import { anteileInProzent } from './anteile.ts';

function summe(werte: readonly number[]): number {
  let gesamt = 0;
  for (const wert of werte) {
    gesamt += wert;
  }
  return gesamt;
}

describe('anteileInProzent', () => {
  it('gibt ohne Gewicht nichts und bei einem Gewicht 100', () => {
    expect(anteileInProzent([])).toEqual([]);
    expect(anteileInProzent([0, 0])).toEqual([0, 0]);
    expect(anteileInProzent([40])).toEqual([100]);
    expect(anteileInProzent([0, 5, 5])).toEqual([0, 50, 50]);
  });

  it('trifft genaue Hälften und verteilt den Rest nach dem größten Rundungsrest', () => {
    expect(anteileInProzent([50, 50])).toEqual([50, 50]);
    expect(anteileInProzent([1, 1, 1])).toEqual([34, 33, 33]);
    expect(anteileInProzent([50, 30, 30, 30])).toEqual([36, 22, 21, 21]);
    expect(summe(anteileInProzent([50, 30, 30, 30]))).toBe(100);
  });

  it('bleibt bei sechs gleichen Gewichten bei 100, wo Runden auf 102 käme', () => {
    const anteile = anteileInProzent([1, 1, 1, 1, 1, 1]);
    expect(anteile).toEqual([17, 17, 17, 17, 16, 16]);
    expect(summe(anteile)).toBe(100);
  });
});
