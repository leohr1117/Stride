import { describe, expect, it } from 'vitest';
import type { LevelInfo } from './level.ts';
import { achsenMaximum, radarMaximum, radarWert } from './radar.ts';

function level(stufe: number, fortschritt = 0): LevelInfo {
  return { level: stufe, xpGesamt: 100, xpImLevel: 0, xpFuerNaechstes: 100, fortschritt };
}

describe('radarMaximum', () => {
  it('nimmt den größten Level und streckt nicht auf den Rand', () => {
    expect(radarWert(level(4, 0.25))).toBeCloseTo(4.25);
    expect(radarMaximum([level(2), level(40), level(10)])).toBe(40);
    expect(radarMaximum([level(20), level(20), level(20)])).toBe(20);
    expect(radarMaximum([level(1, 0), level(1, 0), level(1, 0)])).toBe(1);
    expect(achsenMaximum([0, 0])).toBe(1);
  });

  it('lässt niedrige Level klein, Verhältnisse bleiben', () => {
    const klein = radarMaximum([level(1), level(5), level(3)]);
    const gross = radarMaximum([level(10), level(50), level(30)]);
    expect(klein).toBe(5);
    expect(gross).toBe(50);
    expect(1 / klein).toBeCloseTo(10 / gross);
    const gemischt = achsenMaximum([2, 2, 2, 40]);
    expect(gemischt).toBe(40);
    expect(2 / gemischt).toBe(0.05);
  });
});
