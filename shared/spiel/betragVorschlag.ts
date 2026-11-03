/** Letzte vier Kalenderwochen. Der Schnitt teilt die Summe immer durch vier. */
export const VORSCHLAG_WOCHEN = 4;
/** Darunter gelten die festen Beträge 100, 300 und 800. */
export const VORSCHLAG_MIN_XP = 50;
export const VORSCHLAG_RUNDUNG = 50;
/** Darunter gelten die festen Beträge, ohne Bezug auf den Verlauf. */
export const VORSCHLAG_MIN_WOCHEN = 2;
export const FESTE_BETRAEGE = [100, 300, 800] as const;

export type BetragZielArt = 'vision' | 'projekt' | 'attribut';

export interface BetragPosten {
  art: BetragZielArt;
  id: number;
  /** Positive XP in den letzten vier Wochen, als Summe. */
  xp: number;
}

export interface InvestitionsRhythmus {
  wochenMitEintraegen: number;
  posten: BetragPosten[];
}

function schluessel(art: BetragZielArt, id: number): string {
  return `${art}:${id}`;
}

/** Nächste 50. 0 und nicht Endliches bleiben 0; die Chips haben keine eigene Untergrenze. */
export function rundeBetrag(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) {
    return 0;
  }
  return Math.round(xp / VORSCHLAG_RUNDUNG) * VORSCHLAG_RUNDUNG;
}

/** Wochenwert W der Attribute und des Ziels unter „Bonus für“ und „Auch für“. Dasselbe Ziel zählt einmal. */
export function wochenXp(
  posten: readonly BetragPosten[],
  bonusAttributId: number | null,
  auch: { art: BetragZielArt; id: number } | null,
): number {
  const gewaehlt = new Set<string>();
  if (bonusAttributId !== null) {
    gewaehlt.add(schluessel('attribut', bonusAttributId));
  }
  if (auch) {
    gewaehlt.add(schluessel(auch.art, auch.id));
  }
  let summe = 0;
  const gesehen = new Set<string>();
  for (const eintrag of posten) {
    const key = schluessel(eintrag.art, eintrag.id);
    if (!gewaehlt.has(key) || gesehen.has(key)) {
      continue;
    }
    gesehen.add(key);
    summe += Math.max(0, eintrag.xp);
  }
  return summe / VORSCHLAG_WOCHEN;
}

function ausWoche(woche: number): readonly number[] {
  if (!Number.isFinite(woche) || woche < VORSCHLAG_MIN_XP) {
    return FESTE_BETRAEGE;
  }
  const werte = [rundeBetrag(woche), rundeBetrag(4 * woche), rundeBetrag(13 * woche)];
  if (werte[0] >= werte[1] || werte[1] >= werte[2]) {
    return FESTE_BETRAEGE;
  }
  return werte;
}

/** Drei verschiedene, aufsteigende XP-Beträge. Sonst 100, 300 und 800. */
export function betragVorschlaege(
  posten: readonly BetragPosten[],
  bonusAttributId: number | null,
  auch: { art: BetragZielArt; id: number } | null,
  wochenMitEintraegen: number,
): readonly number[] {
  if (!Number.isFinite(wochenMitEintraegen) || wochenMitEintraegen < VORSCHLAG_MIN_WOCHEN) {
    return FESTE_BETRAEGE;
  }
  return ausWoche(wochenXp(posten, bonusAttributId, auch));
}
