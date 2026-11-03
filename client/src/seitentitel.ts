import { pfadname } from '../../shared/spiel/herkunft.ts';
import { nameDerSeite } from '../../shared/spiel/navigation.ts';
import { ZIEL_FRAGE } from '../../shared/spiel/profil.ts';

/** Titel von Unterseiten, die nicht in der Seitentabelle stehen. */
const UNTERSEITE: Record<string, string> = {
  '/mehr/neu': 'Was ist neu',
  '/mehr/profil': 'Konto',
  '/mehr/profil/name': 'Profilname',
  '/mehr/profil/titel': 'Titel',
  '/mehr/profil/jahr': 'Geburtsjahr',
  '/mehr/profil/ziel': ZIEL_FRAGE,
  '/mehr/profil/fokus': 'Fokus',
  '/mehr/profil/passwort': 'Passwort',
  '/mehr/profil/accounts': 'Accounts',
  '/mehr/profil/stufen': 'Ziel-Stufen',
  '/mehr/inhalte/verbindungen': 'Verbindungen',
  '/mehr/darstellung': 'Darstellung',
  '/mehr/darstellung/leiste': 'Leiste',
  '/mehr/darstellung/paletten': 'Paletten',
  '/mehr/uebersicht': 'Karten auf Heute',
  '/mehr/funktionen': 'Bereiche',
  '/mehr/benachrichtigungen': 'Benachrichtigungen',
  '/mehr/daten': 'Daten',
};

/** Kopf-Titel. Seiten aus der Tabelle kommen von dort, der Rest aus der Unterseitenliste. */
export function standardTitel(pfad: string): string {
  const rein = pfadname(pfad);
  const ausTabelle = nameDerSeite(rein);
  if (ausTabelle) {
    return ausTabelle;
  }
  const fest = UNTERSEITE[rein];
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
  return '';
}
