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
