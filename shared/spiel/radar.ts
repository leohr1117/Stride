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

/**
 * Anteil des Außenrings für den höchsten eigenen Wert.
 * Die Zahlen bleiben die echten Level. Liegt der höchste eigene Wert darunter,
 * wird nur die gezeichnete Form angehoben, damit die Fläche sichtbar bleibt.
 */
export const DU_RING_MIN = 0.62;

/** Zeichenwert auf der gemeinsamen Achse. Form innerhalb der eigenen Werte bleibt. */
export function duZeichenwert(wert: number, duMax: number, achse: number): number {
  if (!(wert > 0) || !(duMax > 0) || !(achse > 0)) {
    return 0;
  }
  const echt = Math.min(1, duMax / achse);
  const ziel = Math.max(echt, DU_RING_MIN);
  return (wert / duMax) * ziel * achse;
}

export function radarMaximum(levels: LevelInfo[]): number {
  return achsenMaximum(levels.map((eintrag) => radarWert(eintrag)));
}

/** Polygon im Uhrzeigersinn, erster Punkt oben. radius ist der Außenring. */
export function radarPunkte(
  werte: readonly number[],
  radius: number,
  mitte: { x: number; y: number } = { x: 0, y: 0 },
): { x: number; y: number }[] {
  const aussen = achsenMaximum(werte);
  const n = werte.length;
  if (n === 0 || !(radius > 0)) {
    return [];
  }
  return werte.map((wert, index) => {
    const anteil = Math.max(0, wert) / aussen;
    const winkel = -Math.PI / 2 + (2 * Math.PI * index) / n;
    const reichweite = radius * anteil;
    return {
      x: mitte.x + Math.cos(winkel) * reichweite,
      y: mitte.y + Math.sin(winkel) * reichweite,
    };
  });
}
