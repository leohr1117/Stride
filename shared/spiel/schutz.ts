import { tagPlus } from './datum.ts';
import {
  ERLAUBTE_PAUSENTAGE,
  bruchtag,
  brueckeVerbindet,
  brueckentag,
  kettenLaenge,
  kettenStand,
  tageZwischen,
} from './kette.ts';

export { bruchtag, brueckeVerbindet, brueckentag };

export const SCHUTZ = {
  schwelleTage: 7,
  vorratMax: 1,
} as const;

export const RUECKKEHR = {
  fristTage: 7,
  abstandTage: 14,
} as const;

export type RueckkehrFolge = 'offen' | 'zu';

export interface SchwelleLage {
  laengeVorher: number;
  laengeNachher: number;
  vorrat: number;
  schwelle: number | null;
}

export interface SchwelleEntscheid {
  schwelle: number;
  vorrat: 0 | 1;
  verdient: boolean;
}

export interface RueckkehrLage {
  aktiveTage: readonly string[];
  heute: string;
  bruecken: readonly string[];
  rueckkehrAb: string | null;
  offen: boolean;
  schlussAm: string | null;
}

export interface RueckkehrEntscheid {
  faellig: boolean;
  status: RueckkehrFolge | null;
  bruchtag: string | null;
  fristAm: string | null;
}

function letzterTag(aktiveTage: readonly string[], heute: string): string | null {
  let letzter: string | null = null;
  for (const tag of aktiveTage) {
    if (tag <= heute && (letzter === null || tag > letzter)) {
      letzter = tag;
    }
  }
  return letzter;
}

function ganzeTage(laenge: number): number {
  if (!Number.isFinite(laenge)) {
    return 0;
  }
  return Math.max(0, Math.floor(laenge));
}

function schwelleVon(laenge: number): number {
  const tage = ganzeTage(laenge);
  return Math.floor(tage / SCHUTZ.schwelleTage) * SCHUTZ.schwelleTage;
}

function vorratAlsBit(vorrat: number): 0 | 1 {
  return vorrat >= SCHUTZ.vorratMax ? 1 : 0;
}

function nichtFaellig(): RueckkehrEntscheid {
  return { faellig: false, status: null, bruchtag: null, fristAm: null };
}

const BRUECKE_ABSTAND = ERLAUBTE_PAUSENTAGE + 2;

export function schutzHeuteMoeglich(
  aktiveTage: readonly string[],
  heute: string,
  bruecken: readonly string[],
  vorrat: number,
): boolean {
  if (vorrat !== SCHUTZ.vorratMax) {
    return false;
  }
  const letzter = letzterTag(aktiveTage, heute);
  if (letzter === null || letzter === heute) {
    return false;
  }
  if (tageZwischen(letzter, heute) !== BRUECKE_ABSTAND) {
    return false;
  }
  const bruecke = brueckentag(letzter);
  if (bruecken.includes(bruecke)) {
    return false;
  }
  const ohne = kettenStand(aktiveTage, heute, bruecken);
  const mit = kettenStand(aktiveTage, heute, [...bruecken, bruecke]);
  const alteLaenge = kettenLaenge(aktiveTage, letzter, bruecken);
  return ohne.laenge === 0 && mit.laenge === alteLaenge && alteLaenge > 0;
}

export function schwelleFuerEintrag(lage: SchwelleLage): SchwelleEntscheid {
  const vorrat = vorratAlsBit(lage.vorrat);
  const ausgang = lage.schwelle === null ? schwelleVon(lage.laengeVorher) : ganzeTage(lage.schwelle);
  const gesehen = schwelleVon(lage.laengeNachher);
  if (gesehen <= ausgang) {
    return { schwelle: ausgang, vorrat, verdient: false };
  }
  if (vorrat === 1) {
    return { schwelle: gesehen, vorrat: 1, verdient: false };
  }
  return { schwelle: gesehen, vorrat: 1, verdient: true };
}

export function rueckkehrFaellig(lage: RueckkehrLage): RueckkehrEntscheid {
  const letzter = letzterTag(lage.aktiveTage, lage.heute);
  if (letzter === null) {
    return nichtFaellig();
  }
  const bruch = bruchtag(letzter);
  const ab = lage.rueckkehrAb ?? lage.heute;
  if (bruch < ab || bruch > lage.heute) {
    return nichtFaellig();
  }
  if (lage.bruecken.includes(brueckentag(letzter))) {
    return nichtFaellig();
  }
  if (lage.offen) {
    return nichtFaellig();
  }
  if (lage.schlussAm !== null && tageZwischen(lage.schlussAm, bruch) < RUECKKEHR.abstandTage) {
    return nichtFaellig();
  }
  const fristAm = tagPlus(bruch, RUECKKEHR.fristTage);
  const status: RueckkehrFolge = lage.heute > fristAm ? 'zu' : 'offen';
  return { faellig: true, status, bruchtag: bruch, fristAm };
}
