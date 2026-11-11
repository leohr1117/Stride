import { MS_PRO_TAG, tagPlus } from './datum.ts';

export const ERLAUBTE_PAUSENTAGE = 1;

export interface Pause {
  von: string;
  bis: string | null;
}

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

export function tagInPause(tag: string, pausen: readonly Pause[]): boolean {
  for (const pause of pausen) {
    if (tag >= pause.von && (pause.bis === null || tag <= pause.bis)) {
      return true;
    }
  }
  return false;
}

function pausentageImBereich(von: string, bis: string, pausen: readonly Pause[]): number {
  if (bis < von || pausen.length === 0) {
    return 0;
  }
  const teile: { von: string; bis: string }[] = [];
  for (const pause of pausen) {
    const anfang = pause.von > von ? pause.von : von;
    const ende = pause.bis === null || pause.bis > bis ? bis : pause.bis;
    if (anfang <= ende) {
      teile.push({ von: anfang, bis: ende });
    }
  }
  teile.sort((links, rechts) => (links.von < rechts.von ? -1 : links.von > rechts.von ? 1 : 0));
  let summe = 0;
  let bisLauf: string | null = null;
  for (const teil of teile) {
    if (bisLauf === null || teil.von > tagPlus(bisLauf, 1)) {
      summe += tageZwischen(teil.von, teil.bis) + 1;
      bisLauf = teil.bis;
    } else if (teil.bis > bisLauf) {
      summe += tageZwischen(bisLauf, teil.bis);
      bisLauf = teil.bis;
    }
  }
  return summe;
}

export function pausentageZwischen(von: string, bis: string, pausen: readonly Pause[]): number {
  if (pausen.length === 0 || bis <= von) {
    return 0;
  }
  const anfang = tagPlus(von, 1);
  const ende = tagPlus(bis, -1);
  if (ende < anfang) {
    return 0;
  }
  return pausentageImBereich(anfang, ende, pausen);
}

export function nterNichtPausentag(nach: string, n: number, pausen: readonly Pause[] = []): string {
  if (n <= 0) {
    return nach;
  }
  if (pausen.length === 0) {
    return tagPlus(nach, n);
  }
  let tag = nach;
  let gefunden = 0;
  for (let schritt = 0; gefunden < n && schritt < 20000; schritt += 1) {
    tag = tagPlus(tag, 1);
    if (!tagInPause(tag, pausen)) {
      gefunden += 1;
    }
  }
  return tag;
}

export function brueckentag(letzterEintrag: string, pausen: readonly Pause[] = []): string {
  return nterNichtPausentag(letzterEintrag, ERLAUBTE_PAUSENTAGE + 1, pausen);
}

export function bruchtag(letzterEintrag: string, pausen: readonly Pause[] = []): string {
  return nterNichtPausentag(letzterEintrag, ERLAUBTE_PAUSENTAGE + 2, pausen);
}

function komprimiert(von: string, bis: string, pausen: readonly Pause[]): number {
  return tageZwischen(von, bis) - pausentageZwischen(von, bis, pausen);
}

export function brueckeVerbindet(
  von: string,
  bis: string,
  bruecken: readonly string[],
  pausen: readonly Pause[] = [],
): boolean {
  const abstand = komprimiert(von, bis, pausen);
  if (abstand >= 1 && abstand <= ERLAUBTE_PAUSENTAGE + 1) {
    return true;
  }
  if (abstand === ERLAUBTE_PAUSENTAGE + 2) {
    return bruecken.includes(brueckentag(von, pausen));
  }
  return false;
}

function ohnePausentage(tage: readonly string[], pausen: readonly Pause[]): readonly string[] {
  if (pausen.length === 0) {
    return tage;
  }
  return tage.filter((tag) => !tagInPause(tag, pausen));
}

function eindeutigSortiert(tage: readonly string[], bisTag: string): string[] {
  return [...new Set(tage)].filter((tag) => tag <= bisTag).sort();
}

export function kettenLaenge(
  aktiveTage: readonly string[],
  bisTag: string,
  bruecken: readonly string[] = [],
  pausen: readonly Pause[] = [],
): number {
  const tage = eindeutigSortiert(ohnePausentage(aktiveTage, pausen), bisTag);
  if (tage.length === 0 || tage[tage.length - 1] !== bisTag) {
    return 0;
  }

  let laenge = 1;
  for (let index = tage.length - 1; index > 0; index -= 1) {
    if (!brueckeVerbindet(tage[index - 1], tage[index], bruecken, pausen)) {
      break;
    }
    laenge += 1;
  }
  return laenge;
}

export function laengsteKette(
  aktiveTage: readonly string[],
  bruecken: readonly string[] = [],
  pausen: readonly Pause[] = [],
): number {
  const tage = [...new Set(ohnePausentage(aktiveTage, pausen))].sort();
  let laengste = 0;
  let aktuell = 0;
  for (let index = 0; index < tage.length; index += 1) {
    const verbunden = index > 0 && brueckeVerbindet(tage[index - 1], tage[index], bruecken, pausen);
    aktuell = verbunden ? aktuell + 1 : 1;
    laengste = Math.max(laengste, aktuell);
  }
  return laengste;
}

function letzterNichtPausentagVor(heute: string, pausen: readonly Pause[]): string {
  let tag = tagPlus(heute, -1);
  for (let schritt = 0; schritt < 10000 && tagInPause(tag, pausen); schritt += 1) {
    let anfang: string | null = null;
    for (const pause of pausen) {
      const trifft = tag >= pause.von && (pause.bis === null || tag <= pause.bis);
      if (trifft && (anfang === null || pause.von < anfang)) {
        anfang = pause.von;
      }
    }
    tag = tagPlus(anfang ?? tag, -1);
  }
  return tag;
}

export function kettenStand(
  aktiveTage: readonly string[],
  heute: string,
  bruecken: readonly string[] = [],
  pausen: readonly Pause[] = [],
): KettenStand {
  if (pausen.length > 0 && tagInPause(heute, pausen)) {
    const anker = letzterNichtPausentagVor(heute, pausen);
    if (tagInPause(anker, pausen)) {
      return { laenge: 0, angeknackst: false };
    }
    const stand = kettenStand(aktiveTage, anker, bruecken, pausen);
    return stand.laenge > 0 ? { laenge: stand.laenge, angeknackst: false } : { laenge: 0, angeknackst: false };
  }
  const tage = eindeutigSortiert(ohnePausentage(aktiveTage, pausen), heute);
  const letzterTag = tage[tage.length - 1];
  if (letzterTag === undefined) {
    return { laenge: 0, angeknackst: false };
  }
  if (letzterTag === heute) {
    return { laenge: kettenLaenge(tage, heute, bruecken, pausen), angeknackst: false };
  }
  if (!brueckeVerbindet(letzterTag, heute, bruecken, pausen)) {
    return { laenge: 0, angeknackst: false };
  }
  const abstand = komprimiert(letzterTag, heute, pausen);
  return {
    laenge: kettenLaenge(tage, letzterTag, bruecken, pausen),
    angeknackst: abstand === ERLAUBTE_PAUSENTAGE + 1,
  };
}
