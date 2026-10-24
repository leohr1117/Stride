import { describe, expect, it } from 'vitest';
import { momentumFuerSerie } from './momentum.ts';

describe('momentumFuerSerie', () => {
  it('ist ohne Streak neutral', () => {
    expect(momentumFuerSerie(0)).toBe(1);
    expect(momentumFuerSerie(-3)).toBe(1);
  });

  it('wächst mit dem Streak', () => {
    expect(momentumFuerSerie(7)).toBe(1.25);
    expect(momentumFuerSerie(21)).toBe(1.5);
    expect(momentumFuerSerie(100)).toBeCloseTo(1.98);
  });

  it('wächst immer langsamer, aber ohne Obergrenze', () => {
    const jahr = momentumFuerSerie(365);
    const dreiJahre = momentumFuerSerie(3 * 365);
    expect(dreiJahre).toBeGreaterThan(jahr);
    expect(dreiJahre - jahr).toBeLessThan(jahr - momentumFuerSerie(100));
  });
});
