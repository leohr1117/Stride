import { tagPlus } from './datum.ts';
import {
  ERLAUBTE_PAUSENTAGE,
  bruchtag,
  brueckeVerbindet,
  brueckentag,
  kettenLaenge,
  kettenStand,
  pausentageZwischen,
  tageZwischen,
  tagInPause,
  type Pause,
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
  pausen?: readonly Pause[];
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
  pausen: readonly Pause[] = [],
): boolean {
  if (vorrat !== SCHUTZ.vorratMax || tagInPause(heute, pausen)) {
    return false;
  }
  const letzter = letzterTag(
    pausen.length === 0 ? aktiveTage : aktiveTage.filter((tag) => !tagInPause(tag, pausen)),
    heute,
  );
  if (letzter === null || letzter === heute) {
    return false;
  }
  if (tageZwischen(letzter, heute) - pausentageZwischen(letzter, heute, pausen) !== BRUECKE_ABSTAND) {
    return false;
  }
  const bruecke = brueckentag(letzter, pausen);
  if (bruecken.includes(bruecke)) {
    return false;
  }
  const ohne = kettenStand(aktiveTage, heute, bruecken, pausen);
  const mit = kettenStand(aktiveTage, heute, [...bruecken, bruecke], pausen);
  const alteLaenge = kettenLaenge(aktiveTage, letzter, bruecken, pausen);
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

function pauseTageBis(geoeffnetAm: string, frist: string, heute: string, pausen: readonly Pause[]): number {
  const ende = frist < heute ? frist : heute;
  if (ende <= geoeffnetAm) {
    return 0;
  }
  return pausentageZwischen(geoeffnetAm, tagPlus(ende, 1), pausen);
}

export function ruhendeFrist(
  geoeffnetAm: string,
  fristAm: string,
  heute: string,
  pausen: readonly Pause[] = [],
): string {
  if (pausen.length === 0) {
    return fristAm;
  }
  let frist = fristAm;
  const schritte = Math.max(tageZwischen(geoeffnetAm, heute), 0) + 1;
  for (let index = 0; index <= schritte; index += 1) {
    const neu = tagPlus(fristAm, pauseTageBis(geoeffnetAm, frist, heute, pausen));
    if (neu === frist) {
      return frist;
    }
    frist = neu;
  }
  return frist;
}

export function rueckkehrFaellig(lage: RueckkehrLage): RueckkehrEntscheid {
  const pausen = lage.pausen ?? [];
  if (tagInPause(lage.heute, pausen)) {
    return nichtFaellig();
  }
  const tage = pausen.length === 0 ? lage.aktiveTage : lage.aktiveTage.filter((tag) => !tagInPause(tag, pausen));
  const letzter = letzterTag(tage, lage.heute);
  if (letzter === null) {
    return nichtFaellig();
  }
  const bruch = bruchtag(letzter, pausen);
  const ab = lage.rueckkehrAb ?? lage.heute;
  if (bruch < ab || bruch > lage.heute) {
    return nichtFaellig();
  }
  if (lage.bruecken.includes(brueckentag(letzter, pausen))) {
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
