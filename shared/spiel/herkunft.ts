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
  '/mehr/darstellung/ansicht',
]);

const HAUPTSEITEN = new Set(LEISTEN_SEITEN.map((seite) => seite.pfad));

const FEST = new Map<string, string>([
  ...LEISTEN_SEITEN.map((seite) => [seite.pfad, seite.label] as const),
  ['/charakter', 'Charakter'],
  ['/mehr/profil', 'Profil'],
  ['/mehr/inhalte', 'Inhalte'],
  ['/mehr/inhalte/verbindungen', 'Verbindungen'],
  ['/mehr/darstellung', 'Darstellung'],
  ['/mehr/darstellung/leiste', 'Leiste'],
  ['/mehr/darstellung/ansicht', 'Ansicht'],
  ['/mehr/funktionen', 'Funktionen'],
  ['/mehr/daten', 'Daten'],
]);

const PROFIL_TEIL: Record<string, string> = {
  name: 'Profilname',
  jahr: 'Geburtsjahr',
  ziel: ZIEL_FRAGE,
  fokus: 'Fokus',
  stufen: 'Ziel-Stufen',
  benutzer: 'Benutzername',
  passwort: 'Passwort',
  accounts: 'Accounts',
};

export interface ZurueckZiel {
  pfad: string;
  label: string;
}

export function istHauptseite(pfad: string): boolean {
  return HAUPTSEITEN.has(pfad);
}

/** Logische Elternseite. Haupt-Tabs haben keine. */
export function elternZiel(pfad: string): ZurueckZiel | null {
  if (istHauptseite(pfad) || UMLENKUNGEN.has(pfad)) {
    return null;
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
  if (pfad.startsWith('/mehr/profil/')) {
    return { pfad: '/mehr/profil', label: 'Profil' };
  }
  if (pfad === '/mehr/inhalte') {
    return { pfad: '/mehr', label: 'Mehr' };
  }
  if (pfad.startsWith('/mehr/inhalte/')) {
    return { pfad: '/mehr/inhalte', label: 'Inhalte' };
  }
  if (pfad === '/mehr/darstellung') {
    return { pfad: '/mehr', label: 'Mehr' };
  }
  if (pfad.startsWith('/mehr/darstellung/')) {
    return { pfad: '/mehr/darstellung', label: 'Darstellung' };
  }
  if (pfad === '/mehr/funktionen' || pfad === '/mehr/daten') {
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
    /^\/vorbilder\/[^/]+$/.test(pfad)
  );
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
): ZurueckZiel | null {
  void stapel;
  void leiste;
  if (istHauptseite(pfad)) {
    return null;
  }
  return elternZiel(pfad) ?? standard;
}
