import { EBENEN, type Ebene } from './ebenen.ts';
import { istFunktion, type Funktion } from './funktionen.ts';

export type Block = 1 | 2 | 3 | 4;

/** Die vier Blöcke aus Teil 11.1. Die Oberfläche zeigt die Namen noch nicht. */
export const BLOCK_NAME: Record<Block, string> = {
  1: 'Planen und Tun',
  2: 'Rückschau',
  3: 'Profil',
  4: 'Nachschlagen',
};

export type SeitenSymbol =
  | 'haus'
  | 'kompass'
  | 'laufend'
  | 'schichten'
  | 'liste'
  | 'weg'
  | 'kalender'
  | 'diagramm'
  | 'stern'
  | 'person'
  | 'hirn'
  | 'boerse'
  | 'funken'
  | 'juwel'
  | 'buch'
  | 'zahnrad';

/** Funktion oder Sammelschalter. null heißt: die Seite ist immer an. */
export type SeitenSchalter = Funktion | 'ziele' | 'laufend';

export interface Seite {
  pfad: string;
  /** Sichtbarer Name, wie Leiste und Seitenleiste ihn heute zeigen. */
  name: string;
  symbol: SeitenSymbol;
  /** null nur bei Mehr: fest unten, nicht in den vier Blöcken. */
  block: Block | null;
  schalter: SeitenSchalter | null;
  /** true, wenn das Profil die Seite als Zeile mit Anzahl zeigt. */
  profilzeile: boolean;
  /** Ziel des Toasts „Öffnen“. Bei diesen Seiten die Seite selbst. */
  toastZiel: string;
  /** Unterpfade gehören zur Seite, etwa /vorbilder/ada. */
  unterseiten?: boolean;
}

/**
 * Vorhandene Seiten in der Reihenfolge aus Teil 11.1.
 * Mehr steht hinter dem Verzeichnis, weil es in keinen Block gehört.
 */
export const SEITEN: readonly Seite[] = [
  { pfad: '/', name: 'Heute', symbol: 'haus', block: 1, schalter: null, profilzeile: false, toastZiel: '/' },
  { pfad: '/ziele', name: 'Ziele', symbol: 'kompass', block: 1, schalter: 'ziele', profilzeile: false, toastZiel: '/ziele' },
  { pfad: '/laufend', name: 'Laufend', symbol: 'laufend', block: 1, schalter: 'laufend', profilzeile: false, toastZiel: '/laufend' },
  { pfad: '/basis', name: 'Basis', symbol: 'schichten', block: 1, schalter: 'basis', profilzeile: false, toastZiel: '/basis' },
  { pfad: '/mehr/inhalte', name: 'Tätigkeiten', symbol: 'liste', block: 1, schalter: null, profilzeile: false, toastZiel: '/mehr/inhalte' },
  { pfad: '/chronik', name: 'Chronik', symbol: 'weg', block: 2, schalter: 'chronik', profilzeile: false, toastZiel: '/chronik' },
  { pfad: '/rueckblick', name: 'Rückblick', symbol: 'kalender', block: 2, schalter: 'rueckblick', profilzeile: false, toastZiel: '/rueckblick' },
  { pfad: '/statistiken', name: 'Statistiken', symbol: 'diagramm', block: 2, schalter: 'statistiken', profilzeile: false, toastZiel: '/statistiken' },
  {
    pfad: '/vorbilder',
    name: 'Vorbilder',
    symbol: 'stern',
    block: 2,
    schalter: 'vorbilder',
    profilzeile: false,
    toastZiel: '/vorbilder',
    unterseiten: true,
  },
  { pfad: '/charakter', name: 'Profil', symbol: 'person', block: 3, schalter: null, profilzeile: false, toastZiel: '/charakter' },
  { pfad: '/koennen', name: 'Können', symbol: 'hirn', block: 3, schalter: 'koennen', profilzeile: true, toastZiel: '/koennen' },
  { pfad: '/haben', name: 'Haben', symbol: 'boerse', block: 3, schalter: 'status', profilzeile: true, toastZiel: '/haben' },
  {
    pfad: '/faehigkeiten',
    name: 'Fähigkeiten',
    symbol: 'funken',
    block: 3,
    schalter: 'faehigkeiten',
    profilzeile: true,
    toastZiel: '/faehigkeiten',
    unterseiten: true,
  },
  {
    pfad: '/investitionen',
    name: 'Investitionen',
    symbol: 'juwel',
    block: 3,
    schalter: 'ausruestung',
    profilzeile: true,
    toastZiel: '/investitionen',
  },
  { pfad: '/handbuch', name: 'Handbuch', symbol: 'buch', block: 4, schalter: 'handbuch', profilzeile: false, toastZiel: '/handbuch' },
  { pfad: '/mehr', name: 'Mehr', symbol: 'zahnrad', block: null, schalter: null, profilzeile: false, toastZiel: '/mehr' },
];

const TOAST_SONDER: Record<string, string> = {
  bossAngriffe: '/laufend',
  verfallKoennen: '/koennen',
  verfallHaben: '/haben',
};

/** Ziel des Toasts „Öffnen“ nach 11.2 b. Seiten lesen aus der Tabelle. */
export function toastZielFuer(schalter: Funktion | Ebene): string {
  const seite = SEITEN.find((eintrag) => eintrag.schalter === schalter);
  if (seite) {
    return seite.toastZiel;
  }
  if ((EBENEN as readonly string[]).includes(schalter)) {
    return '/ziele';
  }
  if (istFunktion(schalter) && TOAST_SONDER[schalter]) {
    return TOAST_SONDER[schalter];
  }
  return '/';
}

const NACH_PFAD = new Map(SEITEN.map((seite) => [seite.pfad, seite]));

export function pfadKern(pfad: string): string {
  const ohneSuche = pfad.split('?')[0] ?? pfad;
  const ohneHash = ohneSuche.split('#')[0] ?? ohneSuche;
  if (ohneHash.length > 1 && ohneHash.endsWith('/')) {
    return ohneHash.slice(0, -1);
  }
  return ohneHash === '' ? '/' : ohneHash;
}

/** Genaue Seite, sonst die längste Seite, deren Unterpfade den Rest tragen. */
export function seiteZuPfad(pfad: string): Seite | undefined {
  const rein = pfadKern(pfad);
  const genau = NACH_PFAD.get(rein);
  if (genau) {
    return genau;
  }
  let beste: Seite | undefined;
  for (const seite of SEITEN) {
    if (seite.unterseiten !== true) {
      continue;
    }
    if (rein.startsWith(`${seite.pfad}/`) && (beste === undefined || seite.pfad.length > beste.pfad.length)) {
      beste = seite;
    }
  }
  return beste;
}
