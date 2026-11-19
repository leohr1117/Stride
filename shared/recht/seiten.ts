import type { RechtSeite } from './arten.ts';

export const RECHT_HUB_PFAD = '/mehr/rechtliches';
export const KONTAKT_PFAD = '/kontakt';

export const RECHT_SEITEN = [
  { id: 'impressum', pfad: '/impressum', titel: 'Impressum' },
  { id: 'datenschutz', pfad: '/datenschutz', titel: 'Datenschutzerklärung' },
  { id: 'nutzung', pfad: '/nutzungsbedingungen', titel: 'Nutzungsbedingungen' },
  { id: 'lizenzen', pfad: '/lizenzhinweise', titel: 'Lizenzhinweise' },
] as const satisfies readonly RechtSeite[];

export function oeffentlicherRechtPfad(pfadname: string): string | null {
  const rein = pfadname.replace(/\/+$/, '') || '/';
  if (rein === RECHT_HUB_PFAD || rein === KONTAKT_PFAD) {
    return rein;
  }
  const seite = RECHT_SEITEN.find((eintrag) => eintrag.pfad === rein);
  return seite ? seite.pfad : null;
}
