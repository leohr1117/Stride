import type { LevelInfo } from './level.ts';

/** Unter drei Achsen ist ein Radar keine Fläche mehr. */
export const MIN_RADAR_ACHSEN = 3;

export function radarWert(level: LevelInfo): number {
  return level.level + level.fortschritt;
}

/** Größter tatsächlicher Wert. Keine Streckung, kein Ausgleich auf den Rand. */
export function achsenMaximum(werte: readonly number[]): number {
  let groesster = 0;
  for (const wert of werte) {
    if (Number.isFinite(wert) && wert > groesster) {
      groesster = wert;
    }
  }
  return groesster > 0 ? groesster : 1;
}

export function radarMaximum(levels: LevelInfo[]): number {
  return achsenMaximum(levels.map((eintrag) => radarWert(eintrag)));
}
