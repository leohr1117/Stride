/** Letzte vier Kalenderwochen. Der Schnitt teilt die Summe immer durch vier. */
export const VORSCHLAG_WOCHEN = 4;
export const VORSCHLAG_MIN_XP = 50;
export const VORSCHLAG_RUNDUNG = 50;
/** Darunter gelten die festen Beispiele, ohne Zeitraum. */
export const VORSCHLAG_MIN_WOCHEN = 2;
export const FESTE_BETRAEGE = [100, 300, 800] as const;

export type BetragZielArt = 'vision' | 'projekt' | 'attribut';
export type BetragZeitraum = 'woche' | 'monat' | 'quartal';

export interface BetragVorschlag {
  xp: number;
  /** null bei den festen Beträgen. */
  zeitraum: BetragZeitraum | null;
}

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

/** Nächste 50, mindestens 50. 0 und Negatives werden zur Untergrenze. */
export function rundeBetrag(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) {
    return VORSCHLAG_MIN_XP;
  }
  const stufen = Math.round(xp / VORSCHLAG_RUNDUNG) * VORSCHLAG_RUNDUNG;
  return Math.max(VORSCHLAG_MIN_XP, stufen);
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

export function betragVorschlaege(
  posten: readonly BetragPosten[],
  bonusAttributId: number | null,
  auch: { art: BetragZielArt; id: number } | null,
  wochenMitEintraegen: number,
): BetragVorschlag[] {
  if (wochenMitEintraegen < VORSCHLAG_MIN_WOCHEN) {
    return FESTE_BETRAEGE.map((xp) => ({ xp, zeitraum: null }));
  }
  const woche = wochenXp(posten, bonusAttributId, auch);
  return [
    { xp: rundeBetrag(woche), zeitraum: 'woche' },
    { xp: rundeBetrag(4 * woche), zeitraum: 'monat' },
    { xp: rundeBetrag(13 * woche), zeitraum: 'quartal' },
  ];
}
