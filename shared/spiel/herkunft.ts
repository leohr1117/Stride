import { LEISTEN_SEITEN } from './leiste.ts';
import { ZIEL_FRAGE } from './profil.ts';

export const HERKUNFT_MAX = 20;
export const STAPEL_SCHLUESSEL = 'stride.nav.stapel';

/** Pfade, die nur weiterleiten und nie Herkunft sein dürfen. */
const UMLENKUNGEN = new Set([
  '/mehr/konto',
  '/mehr/accounts',
  '/mehr/leiste',
  '/mehr/taetigkeiten',
  '/mehr/sonstiges',
  '/demnaechst',
  '/verbindungen',
  '/mehr/inhalte/taetigkeiten',
  '/mehr/profil/stufen',
  '/mehr/profil/benutzer',
  '/mehr/darstellung/ansicht',
]);

const HAUPTSEITEN = new Set(LEISTEN_SEITEN.map((seite) => seite.pfad));

const FEST = new Map<string, string>([
  ...LEISTEN_SEITEN.map((seite) => [seite.pfad, seite.label] as const),
  ['/', 'Heute'],
  ['/chronik', 'Verlauf'],
  ['/statistiken', 'Statistik'],
  ['/charakter', 'Profil'],
  ['/mehr/profil', 'Konto'],
  ['/mehr/inhalte', 'Tätigkeiten'],
  ['/mehr/inhalte/verbindungen', 'Verbindungen'],
  ['/mehr/darstellung', 'Darstellung'],
  ['/mehr/darstellung/leiste', 'Leiste'],
  ['/mehr/darstellung/ansicht', 'Ansicht'],
  ['/mehr/uebersicht', 'Karten auf Heute'],
  ['/mehr/funktionen', 'Bereiche'],
  ['/mehr/benachrichtigungen', 'Benachrichtigungen'],
  ['/mehr/daten', 'Daten'],
  ['/faehigkeiten', 'Fähigkeiten'],
  ['/koennen', 'Können'],
  ['/haben', 'Haben'],
  ['/investitionen', 'Investitionen'],
]);

const PROFIL_TEIL: Record<string, string> = {
  name: 'Profilname',
  jahr: 'Geburtsjahr',
  ziel: ZIEL_FRAGE,
  fokus: 'Fokus',
  stufen: 'Ziel-Stufen',
  benutzer: 'Benutzername',
  benutzernamen: 'Benutzernamen',
  passwort: 'Passwort',
  accounts: 'Accounts',
};

const ORT_MIT_ELTERN = new Set([
  '/chronik',
  '/rueckblick',
  '/statistiken',
  '/basis',
  '/vorbilder',
  '/handbuch',
  '/laufend',
  '/charakter',
]);

export interface ZurueckZiel {
  pfad: string;
  label: string;
}

export interface NavLage {
  leiste: readonly string[];
  seitenleiste?: readonly string[];
  verlaufAn?: boolean;
}

/** Je Leistenplatz die Adressen, der letzte Eintrag liegt oben. `aktiv` ist der markierte Platz. */
export interface NavStapel {
  aktiv: string;
  orte: Record<string, string[]>;
}

export function pfadname(adresse: string): string {
  const ohne = adresse.split(/[?#]/)[0] ?? adresse;
  return ohne.length > 1 && ohne.endsWith('/') ? ohne.slice(0, -1) : ohne;
}

function suchtext(adresse: string): string {
  const ohneHash = adresse.split('#')[0] ?? adresse;
  const frage = ohneHash.indexOf('?');
  return frage < 0 ? '' : ohneHash.slice(frage + 1);
}

/** Gleicher Pfad und gleiche Abfrage. Der Anker zählt nicht als andere Seite. */
export function gleicheAdresse(links: string, rechts: string): boolean {
  return pfadname(links) === pfadname(rechts) && suchtext(links) === suchtext(rechts);
}

export function istUmlenkung(pfad: string): boolean {
  return UMLENKUNGEN.has(pfadname(pfad));
}

export function istHauptseite(pfad: string): boolean {
  return HAUPTSEITEN.has(pfadname(pfad));
}

export function istLeistenplatz(pfad: string, leiste: readonly string[], seitenleiste: readonly string[] = []): boolean {
  const rein = pfadname(pfad);
  return leiste.includes(rein) || seitenleiste.includes(rein);
}

function ziel(pfad: string, label: string): ZurueckZiel {
  return { pfad, label };
}

/** Elternseite, wenn der Stapel keine Herkunft hat. Ein Leistenplatz hat keine Eltern. */
export function elternZiel(pfad: string, lage: NavLage = { leiste: [], verlaufAn: true }): ZurueckZiel | null {
  const rein = pfadname(pfad);
  if (istUmlenkung(rein) || rein === '/') {
    return null;
  }
  const inDerLeiste = lage.leiste.includes(rein);
  if (rein === '/mehr') {
    return inDerLeiste ? null : ziel('/', 'Heute');
  }
  if (rein === '/ziele') {
    return inDerLeiste ? null : ziel('/mehr', 'Mehr');
  }
  if (rein === '/charakter') {
    return inDerLeiste ? null : ziel('/', 'Heute');
  }
  if (rein === '/laufend') {
    return inDerLeiste ? null : ziel('/ziele', 'Ziele');
  }
  if (rein === '/rueckblick' || rein === '/statistiken') {
    if (inDerLeiste) {
      return null;
    }
    return lage.verlaufAn === false ? ziel('/mehr', 'Mehr') : ziel('/chronik', 'Verlauf');
  }
  if (ORT_MIT_ELTERN.has(rein)) {
    return inDerLeiste ? null : ziel('/mehr', 'Mehr');
  }
  if (inDerLeiste && istHauptseite(rein)) {
    return null;
  }
  if (/^\/projekte\/[^/]+$/.test(rein)) {
    return ziel('/ziele', 'Ziele');
  }
  if (rein === '/faehigkeiten' || rein === '/koennen' || rein === '/haben' || rein === '/investitionen') {
    return inDerLeiste ? null : ziel('/charakter', 'Profil');
  }
  if (/^\/faehigkeiten\/[^/]+$/.test(rein)) {
    return ziel('/faehigkeiten', 'Fähigkeiten');
  }
  if (/^\/vorbilder\/[^/]+$/.test(rein)) {
    return ziel('/vorbilder', 'Vorbilder');
  }
  if (rein === '/mehr/profil') {
    return ziel('/mehr', 'Mehr');
  }
  if (/^\/mehr\/profil\/benutzernamen\/[^/]+$/.test(rein)) {
    return ziel('/mehr/profil/benutzernamen', 'Benutzernamen');
  }
  if (rein.startsWith('/mehr/profil/')) {
    return ziel('/mehr/profil', 'Konto');
  }
  if (rein === '/mehr/inhalte') {
    return inDerLeiste ? null : ziel('/mehr', 'Mehr');
  }
  if (rein === '/mehr/inhalte/verbindungen') {
    return ziel('/mehr', 'Mehr');
  }
  if (rein.startsWith('/mehr/inhalte/')) {
    return ziel('/mehr/inhalte', 'Tätigkeiten');
  }
  if (rein === '/mehr/darstellung') {
    return ziel('/mehr', 'Mehr');
  }
  if (rein.startsWith('/mehr/darstellung/')) {
    return ziel('/mehr/darstellung', 'Darstellung');
  }
  if (rein === '/mehr/uebersicht' || rein === '/mehr/funktionen' || rein === '/mehr/benachrichtigungen' || rein === '/mehr/daten') {
    return ziel('/mehr', 'Mehr');
  }
  return null;
}

export function herkunftsLabel(pfad: string): string | null {
  const rein = pfadname(pfad);
  const fest = FEST.get(rein);
  if (fest) {
    return fest;
  }
  if (/^\/projekte\/[^/]+$/.test(rein)) {
    return 'Projekt';
  }
  if (/^\/faehigkeiten\/[^/]+$/.test(rein)) {
    return 'Fähigkeit';
  }
  if (/^\/vorbilder\/[^/]+$/.test(rein)) {
    return 'Vorbild';
  }
  if (/^\/mehr\/profil\/benutzernamen\/[^/]+$/.test(rein)) {
    return 'Benutzername';
  }
  const profil = /^\/mehr\/profil\/([^/]+)$/.exec(rein);
  const teil = profil?.[1];
  return teil ? (PROFIL_TEIL[teil] ?? null) : null;
}

export function platzFuer(pfad: string, lage: NavLage): string {
  const rein = pfadname(pfad);
  if (rein === '/' || istLeistenplatz(rein, lage.leiste, lage.seitenleiste ?? [])) {
    return rein;
  }
  const eltern = elternZiel(rein, lage);
  if (!eltern) {
    return '/';
  }
  return platzFuer(eltern.pfad, lage);
}

function letzterIndex(stapel: readonly string[], adresse: string): number {
  for (let index = stapel.length - 1; index >= 0; index -= 1) {
    const eintrag = stapel[index];
    if (eintrag !== undefined && (gleicheAdresse(eintrag, adresse) || pfadname(eintrag) === pfadname(adresse))) {
      return index;
    }
  }
  return -1;
}

function vorheriger(stapel: readonly string[], adresse: string): string | null {
  const index = letzterIndex(stapel, adresse);
  if (index <= 0) {
    return null;
  }
  return stapel[index - 1] ?? null;
}

/**
 * Herkunft aus dem Stapel, sonst die Elternseite.
 * Ein Leistenplatz hat keinen Pfeil. `istHauptseite` entscheidet das nicht.
 */
export function herkunftsZiel(
  stapel: readonly string[],
  pfad: string,
  leiste: readonly string[],
  standard: ZurueckZiel | null,
  lage: NavLage = { leiste },
): ZurueckZiel | null {
  const voll = { ...lage, leiste };
  if (istLeistenplatz(pfad, voll.leiste, voll.seitenleiste ?? [])) {
    return null;
  }
  const vor = vorheriger(stapel, pfad);
  if (vor && !istUmlenkung(vor)) {
    const label = herkunftsLabel(vor);
    if (label) {
      return { pfad: vor, label };
    }
  }
  return elternZiel(pfad, voll) ?? standard;
}

/** Hängt den Pfad an. Gleicher Pfad bleibt. Rückkehr zum vorletzten Eintrag nimmt den letzten weg. */
export function schiebeHerkunft(stapel: readonly string[], pfad: string): readonly string[] {
  if (istUmlenkung(pfad) || herkunftsLabel(pfad) === null) {
    return stapel;
  }
  if (stapel.at(-1) === pfad) {
    return stapel;
  }
  if (stapel.length >= 2 && stapel.at(-2) === pfad) {
    return stapel.slice(0, -1);
  }
  const neu = [...stapel, pfad];
  return neu.length > HERKUNFT_MAX ? neu.slice(neu.length - HERKUNFT_MAX) : neu;
}

/** Adressen unter der aktuellen Seite, mit „/“ ganz unten, außer die Seite selbst Heute ist. */
export function ketteUnter(adresse: string, lage: NavLage): string[] {
  const pfad = pfadname(adresse);
  const knoten: string[] = [];
  const gesehen = new Set<string>();
  let cursor = pfad;
  while (cursor !== '/' && !gesehen.has(cursor)) {
    gesehen.add(cursor);
    knoten.push(cursor);
    if (istLeistenplatz(cursor, lage.leiste, lage.seitenleiste ?? [])) {
      break;
    }
    const eltern = elternZiel(cursor, lage);
    if (!eltern) {
      break;
    }
    cursor = pfadname(eltern.pfad);
  }
  knoten.reverse();
  if (knoten[0] !== '/') {
    knoten.unshift('/');
  }
  const letzte = knoten[knoten.length - 1];
  if (letzte !== undefined && pfadname(letzte) === pfad) {
    knoten[knoten.length - 1] = adresse;
  } else {
    knoten.push(adresse);
  }
  return knoten;
}
