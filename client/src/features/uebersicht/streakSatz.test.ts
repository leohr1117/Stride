import { describe, expect, it } from 'vitest';
import type { KetteHeute } from '../../../../shared/api/kette.ts';
import { streakArt } from './streakSatz.ts';

function stand(teil: Partial<KetteHeute> = {}): KetteHeute {
  return {
    schutz: false,
    schutzLaenge: null,
    rueckkehr: null,
    angeschlagen: null,
    heuteErfasst: false,
    serie: { laenge: 0, angeknackst: false },
    ...teil,
  };
}

describe('Streak-Satz', () => {
  it('nennt die Länge, wenn heute schon ein Eintrag liegt', () => {
    expect(streakArt(stand({ heuteErfasst: true, serie: { laenge: 4, angeknackst: false } }))).toBe('lauf');
  });

  it('bittet um einen Eintrag, solange der Streak heute noch offen ist', () => {
    expect(streakArt(stand({ serie: { laenge: 4, angeknackst: false } }))).toBe('offen');
  });

  it('nennt den freien Tag, sobald die Pause genutzt ist', () => {
    expect(streakArt(stand({ serie: { laenge: 1, angeknackst: true }, angeschlagen: null }))).toBe('pause');
    expect(streakArt(stand({ serie: { laenge: 5, angeknackst: true }, angeschlagen: { laenge: 5 } }))).toBe('pause');
  });

  it('stellt die Rückkehr über die anderen Sätze', () => {
    expect(
      streakArt(
        stand({
          rueckkehr: { fristAm: '2026-10-29' },
          schutz: true,
          schutzLaenge: 5,
          serie: { laenge: 0, angeknackst: false },
        }),
      ),
    ).toBe('rueckkehr');
  });

  it('beginnt neu, wenn nichts mehr hält', () => {
    expect(streakArt(stand())).toBe('neu');
  });

  it('lässt den Schutz allein stehen, ohne einen neuen Streak daneben', () => {
    expect(streakArt(stand({ schutz: true, schutzLaenge: 5 }))).toBeNull();
  });
});
