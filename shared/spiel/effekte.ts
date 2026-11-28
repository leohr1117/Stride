export const EFFEKT_STUFEN = ['voll', 'reduziert', 'aus'] as const;
export type EffektStufe = (typeof EFFEKT_STUFEN)[number];
export const EFFEKT_STUFE_STANDARD: EffektStufe = 'voll';

export function istEffektStufe(wert: unknown): wert is EffektStufe {
  return wert === 'voll' || wert === 'reduziert' || wert === 'aus';
}

export function effektStufe(wert: unknown): EffektStufe {
  return istEffektStufe(wert) ? wert : EFFEKT_STUFE_STANDARD;
}

/** Aus bleibt aus. Sonst zieht prefers-reduced-motion die Stufe voll auf reduziert. */
export function wirksameEffektStufe(wahl: EffektStufe, systemReduziert: boolean): EffektStufe {
  if (wahl === 'aus') {
    return 'aus';
  }
  if (wahl === 'reduziert' || systemReduziert) {
    return 'reduziert';
  }
  return 'voll';
}

export const EFFEKT_GROESSEN = ['klein', 'mittel', 'gross'] as const;
export type EffektGroesse = (typeof EFFEKT_GROESSEN)[number];

const EFFEKT_RANG: Record<EffektGroesse, number> = { klein: 1, mittel: 2, gross: 3 };

export function groessterEffekt<T extends { groesse: EffektGroesse }>(effekte: readonly T[]): T | null {
  let bester: T | null = null;
  let rang = 0;
  for (const effekt of effekte) {
    const wert = EFFEKT_RANG[effekt.groesse];
    if (bester === null || wert > rang) {
      bester = effekt;
      rang = wert;
    }
  }
  return bester;
}

export function effektDarfFedern(stufe: EffektStufe): boolean {
  return stufe === 'voll';
}

export function groesstesFeierZiel(groessen: readonly EffektGroesse[], hatAufstieg: boolean): 'meldung' | 'aufstieg' | null {
  const liste: { groesse: EffektGroesse; ziel: 'meldung' | 'aufstieg' }[] = groessen.map((groesse) => ({
    groesse,
    ziel: 'meldung',
  }));
  if (hatAufstieg) {
    liste.push({ groesse: 'gross', ziel: 'aufstieg' });
  }
  return groessterEffekt(liste)?.ziel ?? null;
}

/** Tage, an denen die Flamme einen eigenen, etwas größeren Moment macht. */
export const KETTE_MEILENSTEINE = [7, 30, 100] as const;

export type KetteMoment = 'zucken' | 'meilenstein';

/** Nur bei genau einem Tag mehr. Ein Sprung, ein Rückgang oder derselbe Stand bleibt still. */
export function ketteMoment(vorher: number, nachher: number): KetteMoment | null {
  if (!Number.isInteger(vorher) || !Number.isInteger(nachher)) {
    return null;
  }
  if (nachher !== vorher + 1 || nachher < 1) {
    return null;
  }
  if ((KETTE_MEILENSTEINE as readonly number[]).includes(nachher)) {
    return 'meilenstein';
  }
  return 'zucken';
}

export function ketteMomentGroesse(moment: KetteMoment): EffektGroesse {
  return moment === 'meilenstein' ? 'mittel' : 'klein';
}

/**
 * Ein Effekt bewegt sich, wenn kein anderer streng größer ist.
 * Gleich große kleine Momente bleiben nebeneinander, ein Level-Aufstieg ist größer.
 */
export function effektDarfSichBewegen(eigene: EffektGroesse, andere: readonly EffektGroesse[]): boolean {
  const eigeneRang = EFFEKT_RANG[eigene];
  let hoechsteAndere = 0;
  for (const groesse of andere) {
    hoechsteAndere = Math.max(hoechsteAndere, EFFEKT_RANG[groesse]);
  }
  return eigeneRang >= hoechsteAndere;
}

export function ketteDarfSichBewegen(eigene: EffektGroesse, andere: readonly EffektGroesse[]): boolean {
  return effektDarfSichBewegen(eigene, andere);
}

/** Ein ruhiger Rückgang. Kleiner als Meilenstein und Level-Aufstieg. */
export function levelAbstiegGroesse(): EffektGroesse {
  return 'klein';
}

/** True, wenn die Stufe um mindestens eine ganze Zahl sinkt. Ein Anstieg bleibt still. */
export function levelAbstieg(vorher: number, nachher: number): boolean {
  if (!Number.isInteger(vorher) || !Number.isInteger(nachher)) {
    return false;
  }
  if (vorher < 0 || nachher < 0) {
    return false;
  }
  return nachher < vorher;
}

export interface LevelWeg {
  /** Grad ab 12 Uhr, im Uhrzeigersinn. */
  startGrad: number;
  /** Wieder 12 Uhr, das Ende des Wegs nach oben. */
  endeGrad: number;
}

/** Der ungelaufene Bogen von der Spitze im Uhrzeigersinn bis 12 Uhr. Ein voller Ring hat keinen Restweg. */
export function levelWeg(anteil: number): LevelWeg | null {
  if (!Number.isFinite(anteil)) {
    return null;
  }
  const stand = Math.min(1, Math.max(0, anteil));
  if (stand >= 0.999) {
    return null;
  }
  return { startGrad: stand * 360, endeGrad: 360 };
}

export interface LevelWegStrich {
  drehung: number;
  strich: number;
  luecke: number;
}

/** SVG-Kreis startet bei 3 Uhr. Die Drehung legt den Strichanfang auf startGrad ab 12 Uhr. */
export function levelWegStrich(weg: LevelWeg, radius: number): LevelWegStrich {
  const umfang = 2 * Math.PI * radius;
  const anteil = Math.min(1, Math.max(0, (weg.endeGrad - weg.startGrad) / 360));
  const strich = anteil * umfang;
  return {
    drehung: -90 + weg.startGrad,
    strich,
    luecke: umfang - strich,
  };
}
