import type { KetteHeute } from '../../../../shared/api/kette.ts';

export type StreakArt = 'lauf' | 'offen' | 'pause' | 'rueckkehr' | 'neu';

export const STREAK_ZEILE_ENG_BIS = 360;

export const STREAK_ZEILE_ENG = `(max-width: ${STREAK_ZEILE_ENG_BIS}px)`;

export function streakZeileEng(breite: number): boolean {
  return breite <= STREAK_ZEILE_ENG_BIS;
}

export function streakAbschnittSichtbar(art: StreakArt | null, schutzLaenge: number | null, fehler: boolean): boolean {
  return !(art === 'lauf' && schutzLaenge === null && !fehler);
}

export function streakArt(stand: KetteHeute): StreakArt | null {
  if (stand.rueckkehr) {
    return 'rueckkehr';
  }
  if (stand.serie.angeknackst) {
    return 'pause';
  }
  if (stand.heuteErfasst && stand.serie.laenge > 0) {
    return 'lauf';
  }
  if (stand.serie.laenge > 0) {
    return 'offen';
  }
  if (stand.schutz && stand.schutzLaenge !== null) {
    return null;
  }
  return 'neu';
}
