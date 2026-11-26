import { describe, expect, it } from 'vitest';
import { vergleichSpalten, wochenSchluessel } from './wochenvergleich.ts';

describe('Wochenvergleich auf dem Verlauf', () => {
  it('legt diese Woche nach links und die Vorwoche nach rechts', () => {
    expect(vergleichSpalten(640, 520)).toEqual([
      { seite: 'diese', xp: 640 },
      { seite: 'vor', xp: 520 },
    ]);
    expect(vergleichSpalten(0, 0)).toEqual([
      { seite: 'diese', xp: 0 },
      { seite: 'vor', xp: 0 },
    ]);
  });

  it('nimmt dieselbe Montagswoche wie der Rückblick', () => {
    const donnerstag = new Date(2026, 9, 22, 12, 0, 0);
    const sonntag = new Date(2026, 9, 25, 23, 0, 0);
    const montag = new Date(2026, 9, 26, 0, 0, 0);
    expect(wochenSchluessel(donnerstag)).toBe('2026-10-19');
    expect(wochenSchluessel(sonntag)).toBe('2026-10-19');
    expect(wochenSchluessel(montag)).toBe('2026-10-26');
  });
});
