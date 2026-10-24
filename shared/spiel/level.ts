export interface LevelKurve {
  basis: number;
  zuwachs: number;
}

export const LEVEL_KURVEN = {
  charakter: { basis: 100, zuwachs: 2 },
  attribut: { basis: 50, zuwachs: 1 },
  status: { basis: 50, zuwachs: 1 },
  projekt: { basis: 75, zuwachs: 1.5 },
  organisation: { basis: 150, zuwachs: 3 },
  faehigkeit: { basis: 60, zuwachs: 1.2 },
} satisfies Record<string, LevelKurve>;

export interface LevelInfo {
  level: number;
  xpGesamt: number;
  xpImLevel: number;
  xpFuerNaechstes: number;
  fortschritt: number;
}

export function xpFuerAufstieg(level: number, kurve: LevelKurve): number {
  return Math.round(kurve.basis + kurve.zuwachs * (Math.max(1, level) - 1));
}

export function xpBisLevel(level: number, kurve: LevelKurve): number {
  let summe = 0;
  for (let stufe = 1; stufe < level; stufe++) {
    summe += xpFuerAufstieg(stufe, kurve);
  }
  return summe;
}

export function xpBisLevelStetig(level: number, kurve: LevelKurve): number {
  const stufen = Math.max(0, level - 1);
  return kurve.basis * stufen + (kurve.zuwachs * stufen * (stufen - 1)) / 2;
}

export function levelAusXpStetig(xp: number, kurve: LevelKurve): number {
  if (xp <= 0) {
    return 1;
  }
  if (kurve.zuwachs === 0) {
    return 1 + xp / kurve.basis;
  }
  const linear = kurve.basis - kurve.zuwachs / 2;
  return 1 + (-linear + Math.sqrt(linear * linear + 2 * kurve.zuwachs * xp)) / kurve.zuwachs;
}

export function berechneLevel(xpGesamt: number, kurve: LevelKurve): LevelInfo {
  const xp = Math.max(0, Math.floor(xpGesamt));
  let level = 1;
  let rest = xp;
  let benoetigt = xpFuerAufstieg(level, kurve);

  while (rest >= benoetigt) {
    rest -= benoetigt;
    level++;
    benoetigt = xpFuerAufstieg(level, kurve);
  }

  return {
    level,
    xpGesamt: xp,
    xpImLevel: rest,
    xpFuerNaechstes: benoetigt,
    fortschritt: rest / benoetigt,
  };
}

export interface VerlustBalken {
  /** Aktueller Fortschritt im Level, von 0 bis 1. */
  stand: number;
  /** Ende des abgeschwächten Verlusts, von 0 bis 1. Gleich dem Stand, wenn nichts fehlt. */
  verlustBis: number;
  /** Ganze Level über dem aktuellen Level, die mit verloren gingen. */
  verloreneLevel: number;
}

/**
 * Der Balken zeigt den Stand im aktuellen Level und daneben, was davon verloren ging.
 * Fällt der höchste Stand um ein oder mehrere Level, reicht der Verlust bis zum Ende des Balkens.
 * Was darüber hinaus fehlt, liegt über der Level-Grenze und macht den Balken nicht länger.
 */
export function verlustBalken(xp: number, hoechstXp: number, kurve: LevelKurve): VerlustBalken {
  const aktuell = berechneLevel(xp, kurve);
  const hoechst = berechneLevel(Math.max(aktuell.xpGesamt, hoechstXp), kurve);
  if (hoechst.level === aktuell.level) {
    return {
      stand: aktuell.fortschritt,
      verlustBis: Math.max(aktuell.fortschritt, hoechst.fortschritt),
      verloreneLevel: 0,
    };
  }
  return {
    stand: aktuell.fortschritt,
    verlustBis: 1,
    verloreneLevel: hoechst.level - aktuell.level,
  };
}
