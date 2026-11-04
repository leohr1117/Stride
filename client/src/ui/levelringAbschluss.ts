export const RING_MITTE = 50;
export const RING_RADIUS = 42;
export const RING_STRICH = 8;
export const RING_HEUTE = 64;
export const RING_HEUTE_STRICH_PX = 6;
export const RING_SCHRIFT_AB = 96;
export const RING_UMFANG = 2 * Math.PI * RING_RADIUS;
export const RING_VERLAUF_PX = 24;
export const RING_SPITZE_PX = 2;

const START_OBEN = RING_UMFANG * 0.75;

export function strichWeite(groesse: number): number {
  if (groesse === RING_HEUTE) {
    return (RING_HEUTE_STRICH_PX * 100) / groesse;
  }
  return RING_STRICH;
}

export interface RingPunkt {
  x: number;
  y: number;
}

export interface RingAbschluss {
  anteil: number;
  bogen: number;
  spitze: number;
  verlauf: number | null;
  versatzSpitze: number;
  versatzVerlauf: number | null;
  verlaufVon: RingPunkt | null;
  verlaufNach: RingPunkt | null;
}

function punkt(vonOben: number): RingPunkt {
  const winkel = -Math.PI / 2 + vonOben * 2 * Math.PI;
  return {
    x: RING_MITTE + RING_RADIUS * Math.cos(winkel),
    y: RING_MITTE + RING_RADIUS * Math.sin(winkel),
  };
}

export function ringAbschluss(anteil: number, groesse: number): RingAbschluss | null {
  const begrenzt = Math.min(1, Math.max(0, anteil));
  if (begrenzt <= 0 || groesse <= 0) {
    return null;
  }
  const anteilBogen = begrenzt >= 0.999 ? 1 : begrenzt;
  const umfangPx = (RING_UMFANG * groesse) / 100;
  const bogen = anteilBogen * RING_UMFANG;
  const spitze = Math.min((RING_SPITZE_PX * 100) / groesse, bogen);
  const verlaufLaenge = (RING_VERLAUF_PX * 100) / groesse;
  const hatVerlauf = anteilBogen * umfangPx >= RING_VERLAUF_PX;
  const vonOben = anteilBogen;
  return {
    anteil: anteilBogen,
    bogen,
    spitze,
    verlauf: hatVerlauf ? verlaufLaenge : null,
    versatzSpitze: -(START_OBEN + bogen - spitze),
    versatzVerlauf: hatVerlauf ? -(START_OBEN + bogen - verlaufLaenge) : null,
    verlaufVon: hatVerlauf ? punkt(vonOben - RING_VERLAUF_PX / umfangPx) : null,
    verlaufNach: hatVerlauf ? punkt(vonOben) : null,
  };
}
