/** Reihenfolge der Benachrichtigung. Fällig und Training gibt es nicht mehr. */
export const HINWEIS_REIHENFOLGE = ['streak', 'rueckkehr', 'boss'] as const;

export type HinweisArt = (typeof HINWEIS_REIHENFOLGE)[number];

export interface HinweisAnlass {
  art: HinweisArt;
  name: string;
  ziel: '/';
  bezugId: number | null;
}

export interface HinweisEingabe {
  stunde: number;
  minute: number;
  ruheVon: string;
  ruheBis: string;
  schalter: Record<HinweisArt, boolean>;
  schonGesendet: boolean;
  anlaesse: HinweisAnlass[];
}

const UHR = /^([01]\d|2[0-3]):([0-5]\d)$/;

function minutenAusUhr(zeit: string): number | null {
  const treffer = UHR.exec(zeit);
  if (!treffer) {
    return null;
  }
  return Number(treffer[1]) * 60 + Number(treffer[2]);
}

/** Von gleich Bis ist nie Ruhe. Das Ende ist exklusiv, der Anfang zählt mit. Über Mitternacht, wenn Von nach Bis liegt. */
function inRuhezeit(stunde: number, minute: number, ruheVon: string, ruheBis: string): boolean {
  const von = minutenAusUhr(ruheVon);
  const bis = minutenAusUhr(ruheBis);
  if (von === null || bis === null || von === bis) {
    return false;
  }
  const jetzt = stunde * 60 + minute;
  if (!Number.isFinite(jetzt)) {
    return false;
  }
  if (von < bis) {
    return jetzt >= von && jetzt < bis;
  }
  return jetzt >= von || jetzt < bis;
}

/**
 * Erster Anlass in der Reihenfolge, dessen Schalter an ist.
 * null heißt nicht senden und keine Zeile schreiben. Die Ruhezeit markiert den Tag nicht.
 */
export function waehleHinweis(eingabe: HinweisEingabe): HinweisAnlass | null {
  if (eingabe.schonGesendet) {
    return null;
  }
  if (inRuhezeit(eingabe.stunde, eingabe.minute, eingabe.ruheVon, eingabe.ruheBis)) {
    return null;
  }
  for (const art of HINWEIS_REIHENFOLGE) {
    if (!eingabe.schalter[art]) {
      continue;
    }
    const treffer = eingabe.anlaesse.find((anlass) => anlass.art === art);
    if (treffer) {
      return treffer;
    }
  }
  return null;
}
