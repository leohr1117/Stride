import { MS_PRO_TAG, tagPlus } from './datum.ts';

export const ERLAUBTE_PAUSENTAGE = 1;

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

export function brueckentag(letzterEintrag: string): string {
  return tagPlus(letzterEintrag, ERLAUBTE_PAUSENTAGE + 1);
}

export function bruchtag(letzterEintrag: string): string {
  return tagPlus(letzterEintrag, ERLAUBTE_PAUSENTAGE + 2);
}

export function brueckeVerbindet(von: string, bis: string, bruecken: readonly string[]): boolean {
  const abstand = tageZwischen(von, bis);
  if (abstand >= 1 && abstand <= ERLAUBTE_PAUSENTAGE + 1) {
    return true;
  }
  if (abstand === ERLAUBTE_PAUSENTAGE + 2) {
    return bruecken.includes(brueckentag(von));
  }
  return false;
}

function eindeutigSortiert(tage: readonly string[], bisTag: string): string[] {
  return [...new Set(tage)].filter((tag) => tag <= bisTag).sort();
}

export function kettenLaenge(aktiveTage: readonly string[], bisTag: string, bruecken: readonly string[] = []): number {
  const tage = eindeutigSortiert(aktiveTage, bisTag);
  if (tage.length === 0 || tage[tage.length - 1] !== bisTag) {
    return 0;
  }

  let laenge = 1;
  for (let index = tage.length - 1; index > 0; index--) {
    if (!brueckeVerbindet(tage[index - 1], tage[index], bruecken)) {
      break;
    }
    laenge++;
  }
  return laenge;
}

export function laengsteKette(aktiveTage: readonly string[], bruecken: readonly string[] = []): number {
  const tage = [...new Set(aktiveTage)].sort();
  let laengste = 0;
  let aktuell = 0;
  for (let index = 0; index < tage.length; index++) {
    const verbunden = index > 0 && brueckeVerbindet(tage[index - 1], tage[index], bruecken);
    aktuell = verbunden ? aktuell + 1 : 1;
    laengste = Math.max(laengste, aktuell);
  }
  return laengste;
}

export function kettenStand(aktiveTage: readonly string[], heute: string, bruecken: readonly string[] = []): KettenStand {
  const tage = eindeutigSortiert(aktiveTage, heute);
  const letzterTag = tage[tage.length - 1];
  if (letzterTag === undefined) {
    return { laenge: 0, angeknackst: false };
  }
  if (letzterTag === heute) {
    return { laenge: kettenLaenge(tage, heute, bruecken), angeknackst: false };
  }
  if (!brueckeVerbindet(letzterTag, heute, bruecken)) {
    return { laenge: 0, angeknackst: false };
  }
  const abstand = tageZwischen(letzterTag, heute);
  return {
    laenge: kettenLaenge(tage, letzterTag, bruecken),
    angeknackst: abstand === ERLAUBTE_PAUSENTAGE + 1,
  };
}
