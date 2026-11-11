export const VERFALL_STUFEN = ['aus', 'leicht', 'mittel', 'stark'] as const;
export type VerfallStufe = (typeof VERFALL_STUFEN)[number];

export const VERFALL_STUFE_LABEL: Record<VerfallStufe, string> = {
  aus: 'Aus',
  leicht: 'Leicht',
  mittel: 'Mittel',
  stark: 'Stark',
};

export const BELASTUNG_ANTEIL: Record<VerfallStufe, number> = {
  aus: 0,
  leicht: 0.05,
  mittel: 0.1,
  stark: 0.2,
};

export const ZEITVERFALL_ANTEIL: Record<VerfallStufe, number> = {
  aus: 0,
  leicht: 0.05,
  mittel: 0.1,
  stark: 0.25,
};

export type VerfallArt = 'belastung' | 'zeit';

export function verfallAnteil(art: VerfallArt, stufe: VerfallStufe): number {
  return art === 'belastung' ? BELASTUNG_ANTEIL[stufe] : ZEITVERFALL_ANTEIL[stufe];
}

/** Ganze Prozentpunkte der heutigen Voreinstellung. Aus ist 0. */
export function verfallProzent(art: VerfallArt, stufe: VerfallStufe): number {
  return Math.round(verfallAnteil(art, stufe) * 100);
}

export function verfallAlsText(art: VerfallArt, stufe: VerfallStufe): string {
  return String(verfallProzent(art, stufe));
}

/** Leerer Text und 0 sind Aus. Eine Zahl ohne Stufe ist null. */
export function verfallAusText(art: VerfallArt, text: string): VerfallStufe | null {
  const roh = text.trim().replace(',', '.');
  if (roh === '') {
    return 'aus';
  }
  if (!/^\d+$/.test(roh)) {
    return null;
  }
  const prozent = Number(roh);
  if (prozent === 0) {
    return 'aus';
  }
  for (const stufe of VERFALL_STUFEN) {
    if (stufe !== 'aus' && verfallProzent(art, stufe) === prozent) {
      return stufe;
    }
  }
  return null;
}

export const ERSCHOEPFUNG = {
  abVerhaeltnis: 0.5,
  maxAbzug: 0.15,
  abHoechstemLevel: 10,
  rundung: 100,
} as const;

export function istBelastend(vorlageAttributIds: number[], attributId: number): boolean {
  return !vorlageAttributIds.includes(attributId);
}

export function belastungXp(eintragXp: number, vorhandeneXp: number, stufe: VerfallStufe): number {
  const betrag = Math.round(Math.max(0, eintragXp) * BELASTUNG_ANTEIL[stufe]);
  return Math.min(betrag, Math.max(0, vorhandeneXp));
}

/** Anteil der Grund-XP, gekappt auf die vorhandene XP. Nie unter 0. */
export function abzugXp(grundXp: number, prozent: number, vorhandeneXp: number): number {
  const betrag = Math.round((Math.max(0, grundXp) * prozent) / 100);
  return Math.min(betrag, Math.max(0, vorhandeneXp));
}

export function zeitverfallXp(
  inaktiveTage: number,
  xpFuerAufstieg: number,
  vorhandeneXp: number,
  stufe: VerfallStufe,
): number {
  const betrag = Math.round(Math.max(0, inaktiveTage) * xpFuerAufstieg * ZEITVERFALL_ANTEIL[stufe]);
  return Math.min(betrag, Math.max(0, vorhandeneXp));
}

export const ERSCHOEPFUNG_SCHALTER = 'Zu niedrig senkt XP anderer Attribute';

export interface ErschoepfungsRegelBild {
  quelleId: number;
  zielId: number | null;
  faktor: number;
}

export interface ErschoepfungsBild {
  /** Ein gemeinsamer Abzug, wenn die Regeln für alles gelten. Sonst null. */
  allgemein: number | null;
  jeZiel: { zielId: number; prozent: number }[];
  ursachen: number[];
}

function abzugProzent(faktor: number): number {
  return Math.round((1 - faktor) * 100);
}

/** Mehrere Regeln multiplizieren sich. Jede Ursache unter 1 wird markiert. */
export function erschoepfungsBild(regeln: readonly ErschoepfungsRegelBild[]): ErschoepfungsBild {
  const ursachen: number[] = [];
  let global = 1;
  const ziele = new Map<number, number>();
  for (const regel of regeln) {
    if (regel.faktor >= 1) {
      continue;
    }
    ursachen.push(regel.quelleId);
    if (regel.zielId === null) {
      global *= regel.faktor;
    } else {
      ziele.set(regel.zielId, (ziele.get(regel.zielId) ?? 1) * regel.faktor);
    }
  }
  const allgemein = abzugProzent(global);
  const jeZiel = [...ziele.entries()]
    .map(([zielId, faktor]) => ({ zielId, prozent: abzugProzent(faktor) }))
    .filter((eintrag) => eintrag.prozent > 0);
  return { allgemein: allgemein > 0 ? allgemein : null, jeZiel, ursachen };
}

export function abzugNebenNamen(bild: ErschoepfungsBild, attributId: number): number | null {
  const gezielt = bild.jeZiel.find((eintrag) => eintrag.zielId === attributId)?.prozent ?? 0;
  return gezielt > 0 ? gezielt : null;
}

export function erschoepfungsFaktor(level: number, hoechstesAnderesLevel: number): number {
  if (hoechstesAnderesLevel < ERSCHOEPFUNG.abHoechstemLevel) {
    return 1;
  }
  const verhaeltnis = level / hoechstesAnderesLevel;
  if (verhaeltnis >= ERSCHOEPFUNG.abVerhaeltnis) {
    return 1;
  }
  const faktor = 1 - ERSCHOEPFUNG.maxAbzug * (1 - verhaeltnis / ERSCHOEPFUNG.abVerhaeltnis);
  return Math.round(faktor * ERSCHOEPFUNG.rundung) / ERSCHOEPFUNG.rundung;
}
