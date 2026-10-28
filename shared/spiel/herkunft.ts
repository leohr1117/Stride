import { LEISTEN_SEITEN } from './leiste.ts';
import { ZIEL_FRAGE } from './profil.ts';

export const HERKUNFT_MAX = 20;

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
  ['/charakter', 'Charakter'],
  ['/mehr/profil', 'Profil'],
  ['/mehr/inhalte', 'Tätigkeiten'],
  ['/mehr/inhalte/verbindungen', 'Verbindungen'],
  ['/mehr/darstellung', 'Darstellung'],
  ['/mehr/darstellung/leiste', 'Leiste'],
  ['/mehr/darstellung/ansicht', 'Ansicht'],
  ['/mehr/uebersicht', 'Übersicht'],
  ['/mehr/funktionen', 'App & Verbindungen'],
  ['/mehr/benachrichtigungen', 'Benachrichtigungen'],
  ['/mehr/daten', 'Daten'],
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

export interface ZurueckZiel {
  pfad: string;
  label: string;
}

/** Herkunft einer Trainingsseite. `von` ist `/`, wenn Starten von der Übersicht kam. */
export interface TrainingRueckweg {
  von?: string | null;
  einheit?: string | null;
  planName?: string | null;
}

function ohneEndslash(pfad: string): string {
  return pfad.length > 1 && pfad.endsWith('/') ? pfad.slice(0, -1) : pfad;
}

function istTrainingsPlan(pfad: string): boolean {
  return /^\/training\/plaene\/[^/]+$/.test(pfad);
}

function istTrainingsEinheit(pfad: string): boolean {
  return /^\/training\/einheiten\/[^/]+$/.test(pfad);
}

function istTrainingsUebung(pfad: string): boolean {
  return /^\/training\/uebungen\/[^/]+$/.test(pfad);
}

function trainingListe(): ZurueckZiel {
  return { pfad: '/training', label: 'Training' };
}

/**
 * Plan zur Liste. Einheit zur Liste, oder zur Übersicht, wenn Starten dort her kam.
 * Übung zur Einheit, das Label ist der Planname. Ohne diese Herkunft zur Liste.
 */
export function trainingZurueck(pfad: string, weg?: TrainingRueckweg | null): ZurueckZiel | null {
  const rein = ohneEndslash(pfad);
  if (istTrainingsPlan(rein)) {
    return trainingListe();
  }
  if (istTrainingsEinheit(rein)) {
    return weg?.von === '/' ? { pfad: '/', label: 'Übersicht' } : trainingListe();
  }
  if (istTrainingsUebung(rein)) {
    const einheit = weg?.einheit ? ohneEndslash(weg.einheit) : '';
    const name = weg?.planName?.trim() ?? '';
    if (istTrainingsEinheit(einheit) && name.length > 0) {
      return { pfad: einheit, label: name };
    }
    return trainingListe();
  }
  return null;
}

export function istHauptseite(pfad: string): boolean {
  return HAUPTSEITEN.has(pfad);
}

/** Logische Elternseite. Haupt-Tabs haben keine. */
export function elternZiel(pfad: string, weg?: TrainingRueckweg | null): ZurueckZiel | null {
  if (istHauptseite(pfad) || UMLENKUNGEN.has(pfad)) {
    return null;
  }
  const training = trainingZurueck(pfad, weg);
  if (training) {
    return training;
  }
  if (pfad === '/charakter') {
    return { pfad: '/', label: 'Übersicht' };
  }
  if (/^\/projekte\/[^/]+$/.test(pfad)) {
    return { pfad: '/ziele', label: 'Ziele' };
  }
  if (/^\/faehigkeiten\/[^/]+$/.test(pfad)) {
    return { pfad: '/charakter', label: 'Charakter' };
  }
  if (/^\/vorbilder\/[^/]+$/.test(pfad)) {
    return { pfad: '/vorbilder', label: 'Vorbilder' };
  }
  if (pfad === '/mehr/profil') {
    return { pfad: '/mehr', label: 'Mehr' };
  }
  if (/^\/mehr\/profil\/benutzernamen\/[^/]+$/.test(pfad)) {
    return { pfad: '/mehr/profil/benutzernamen', label: 'Benutzernamen' };
  }
  if (pfad.startsWith('/mehr/profil/')) {
    return { pfad: '/mehr/profil', label: 'Profil' };
  }
  if (pfad === '/mehr/inhalte') {
    return { pfad: '/mehr', label: 'Mehr' };
  }
  if (pfad === '/mehr/inhalte/verbindungen') {
    return { pfad: '/mehr/funktionen', label: 'App & Verbindungen' };
  }
  if (pfad.startsWith('/mehr/inhalte/')) {
    return { pfad: '/mehr/inhalte', label: 'Tätigkeiten' };
  }
  if (pfad === '/mehr/darstellung') {
    return { pfad: '/mehr', label: 'Mehr' };
  }
  if (pfad.startsWith('/mehr/darstellung/')) {
    return { pfad: '/mehr/darstellung', label: 'Darstellung' };
  }
  if (pfad === '/mehr/uebersicht' || pfad === '/mehr/funktionen' || pfad === '/mehr/benachrichtigungen' || pfad === '/mehr/daten') {
    return { pfad: '/mehr', label: 'Mehr' };
  }
  return null;
}

export function herkunftsLabel(pfad: string): string | null {
  const fest = FEST.get(pfad);
  if (fest) {
    return fest;
  }
  if (/^\/projekte\/[^/]+$/.test(pfad)) {
    return 'Projekt';
  }
  if (/^\/faehigkeiten\/[^/]+$/.test(pfad)) {
    return 'Fähigkeit';
  }
  if (/^\/vorbilder\/[^/]+$/.test(pfad)) {
    return 'Vorbild';
  }
  const training = ohneEndslash(pfad);
  if (istTrainingsPlan(training)) {
    return 'Plan';
  }
  if (istTrainingsEinheit(training)) {
    return 'Einheit';
  }
  if (istTrainingsUebung(training)) {
    return 'Übung';
  }
  if (/^\/mehr\/profil\/benutzernamen\/[^/]+$/.test(pfad)) {
    return 'Benutzername';
  }
  const profil = /^\/mehr\/profil\/([^/]+)$/.exec(pfad);
  const teil = profil?.[1];
  return teil ? (PROFIL_TEIL[teil] ?? null) : null;
}

/** Seiten mit eigenem Zurück-Link. Die Leiste zeichnet dort keinen zweiten Pfeil. */
export function seiteZeigtEigenenZurueck(pfad: string): boolean {
  return (
    pfad.startsWith('/mehr/') ||
    pfad.startsWith('/projekte/') ||
    pfad.startsWith('/faehigkeiten/') ||
    /^\/vorbilder\/[^/]+$/.test(pfad) ||
    istTrainingsPlan(ohneEndslash(pfad)) ||
    istTrainingsEinheit(ohneEndslash(pfad)) ||
    istTrainingsUebung(ohneEndslash(pfad))
  );
}

/**
 * Browser-Zurück bleibt auf der Elternseite.
 * Eine Einheit darf auch auf der Übersicht bleiben: dorthin kommt der Verlauf nur, wenn Starten dort her kam.
 * Eine Übung darf auf der Einheit bleiben, von der ihr Name geöffnet wurde.
 */
export function zurueckPasst(von: string, nach: string): boolean {
  const eltern = elternZiel(von);
  if (!eltern) {
    return true;
  }
  if (ohneEndslash(nach) === eltern.pfad) {
    return true;
  }
  if (istTrainingsEinheit(ohneEndslash(von)) && ohneEndslash(nach) === '/') {
    return true;
  }
  return istTrainingsUebung(ohneEndslash(von)) && istTrainingsEinheit(ohneEndslash(nach));
}

/**
 * Hängt den Pfad an. Gleicher Pfad bleibt. Rückkehr zum vorletzten Eintrag nimmt den letzten weg.
 * Umleitungen und unbekannte Pfade bleiben draußen, sonst zeigt Zurück auf eine Weiterleitung.
 */
export function schiebeHerkunft(stapel: readonly string[], pfad: string): readonly string[] {
  if (UMLENKUNGEN.has(pfad) || herkunftsLabel(pfad) === null) {
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

/** Zurück geht zur Elternseite, nicht zur zuletzt besuchten Seite. Haupt-Tabs bleiben ohne Pfeil. */
export function herkunftsZiel(
  stapel: readonly string[],
  pfad: string,
  leiste: readonly string[],
  standard: ZurueckZiel | null,
  weg?: TrainingRueckweg | null,
): ZurueckZiel | null {
  void stapel;
  void leiste;
  if (istHauptseite(pfad)) {
    return null;
  }
  return elternZiel(pfad, weg) ?? standard;
}
