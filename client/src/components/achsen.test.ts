import { describe, expect, it } from 'vitest';
import { achsenSchritte, xIntervall, yAchse } from './achsen.ts';

function ausReihe(schritt: number): boolean {
  const zehner = 10 ** Math.floor(Math.log10(schritt));
  const norm = Math.round((schritt / zehner) * 1e6) / 1e6;
  return norm === 1 || norm === 2 || norm === 5;
}

describe('achsenSchritte', () => {
  it('gehört zur 1-2-5-Reihe und reicht über das Maximum', () => {
    const proben = [0, 1, 3, 4, 17, 50, 100, 850, 999, 1700, 2600, 3400, 8000, 10000, 123456];
    for (const maximum of proben) {
      const werte = achsenSchritte(maximum);
      expect(werte[0]).toBe(0);
      expect(werte[werte.length - 1]).toBeGreaterThanOrEqual(maximum);
      expect(werte.length).toBeLessThan(12);
      for (let index = 1; index < werte.length; index += 1) {
        const schritt = werte[index] - werte[index - 1];
        expect(schritt).toBe(werte[1] - werte[0]);
        expect(ausReihe(schritt)).toBe(true);
      }
    }
  });

  it('ersetzt krumme Tausender durch glatte Schritte', () => {
    expect(achsenSchritte(3400)).toEqual([0, 1000, 2000, 3000, 4000]);
    expect(achsenSchritte(8000)).toEqual([0, 2000, 4000, 6000, 8000]);
  });

  it('hält die gezeichnete Achse auf denselben Schritten', () => {
    const achse = yAchse([850, 1700, 2600, 3400]);
    expect(achse.ticks).toEqual([0, 1000, 2000, 3000, 4000]);
    expect(achse.domain[1]).toBeGreaterThanOrEqual(3400);
  });

  it('setzt bei Wochen jede zweite Beschriftung', () => {
    expect(xIntervall(true)).toBe(1);
    expect(xIntervall(false)).toBe('preserveStartEnd');
  });
});
