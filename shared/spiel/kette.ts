export const ERLAUBTE_PAUSENTAGE = 1;

const MS_PRO_TAG = 24 * 60 * 60 * 1000;

export interface KettenStand {
  laenge: number;
  angeknackst: boolean;
}

function alsUtcTag(tag: string): number {
  const [jahr, monat, tagImMonat] = tag.split('-').map(Number);
  return Date.UTC(jahr, monat - 1, tagImMonat);
}

export function tageZwischen(von: string, bis: string): number {
  return Math.round((alsUtcTag(bis) - alsUtcTag(von)) / MS_PRO_TAG);
}

function eindeutigSortiert(tage: string[], bisTag: string): string[] {
  return [...new Set(tage)].filter((tag) => tag <= bisTag).sort();
}

export function kettenLaenge(aktiveTage: string[], bisTag: string): number {
  const tage = eindeutigSortiert(aktiveTage, bisTag);
  if (tage.length === 0 || tage[tage.length - 1] !== bisTag) {
    return 0;
  }

  let laenge = 1;
  for (let index = tage.length - 1; index > 0; index--) {
    if (tageZwischen(tage[index - 1], tage[index]) > ERLAUBTE_PAUSENTAGE + 1) {
      break;
    }
    laenge++;
  }
  return laenge;
}

export function laengsteKette(aktiveTage: string[]): number {
  const tage = [...new Set(aktiveTage)].sort();
  let laengste = 0;
  let aktuell = 0;
  for (let index = 0; index < tage.length; index++) {
    const verbunden = index > 0 && tageZwischen(tage[index - 1], tage[index]) <= ERLAUBTE_PAUSENTAGE + 1;
    aktuell = verbunden ? aktuell + 1 : 1;
    laengste = Math.max(laengste, aktuell);
  }
  return laengste;
}

export function kettenStand(aktiveTage: string[], heute: string): KettenStand {
  const tage = eindeutigSortiert(aktiveTage, heute);
  const letzterTag = tage[tage.length - 1];
  if (letzterTag === undefined) {
    return { laenge: 0, angeknackst: false };
  }

  const abstand = tageZwischen(letzterTag, heute);
  if (abstand > ERLAUBTE_PAUSENTAGE + 1) {
    return { laenge: 0, angeknackst: false };
  }
  return { laenge: kettenLaenge(tage, letzterTag), angeknackst: abstand === ERLAUBTE_PAUSENTAGE + 1 };
}
