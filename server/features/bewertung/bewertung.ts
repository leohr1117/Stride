import { strideVariable } from '../../umgebung.ts';
import type { BewertungStand } from '../../../shared/api/index.ts';
import { lokalesDatum } from '../../services/zeit.ts';
import { eine, inTransaktion } from '../../db.ts';
import { ungueltig } from '../../fehler.ts';
import { ladeKennzahlen } from '../erfolge/erfolge.ts';
import {
  leseBewertungNie,
  leseBewertungTesten,
  leseBewertungWert,
  schreibeBewertungNie,
  schreibeBewertungWert,
} from '../einstellungen/einstellungen.ts';
import { leseHinweisAngebotGesehen, leseHinweisAngebotTesten, leseHinweisNichtVor } from '../einstellungen/hinweisSchluessel.ts';

export { schreibeBewertungNie };

export const BEWERTUNG_SCHON = 'Die Bewertung ist schon gespeichert.';

function heuteBlockiert(heute: string): boolean {
  const verfall = eine(
    `SELECT id FROM xp_ereignisse WHERE quelle = 'verfall' AND date(erstellt_am, 'localtime') = ? LIMIT 1`,
    heute,
  );
  if (verfall) {
    return true;
  }
  const angriff = eine(
    `SELECT id FROM xp_ereignisse WHERE quelle = 'bossangriff' AND date(erstellt_am, 'localtime') = ? LIMIT 1`,
    heute,
  );
  if (angriff) {
    return true;
  }
  const bis = eine(`SELECT id FROM vorhaben WHERE boss = 1 AND angriff_bis = ? LIMIT 1`, heute);
  if (bis) {
    return true;
  }
  const rueckkehr = eine(`SELECT id FROM protokoll WHERE art = 'rueckkehr_offen' AND tag = ? LIMIT 1`, heute);
  if (rueckkehr) {
    return true;
  }
  return (
    eine(
      `SELECT id FROM eintraege WHERE abschluss = 'gescheitert' AND date(erstellt_am, 'localtime') = ? LIMIT 1`,
      heute,
    ) !== undefined
  );
}

/** Streak, Bosse und Einträge aus den vorhandenen Kennzahlen, ohne zweite Zählung. */
function erfolgErreicht(): boolean {
  const zahlen = ladeKennzahlen();
  if (zahlen.streak >= 7 || zahlen.bosse >= 1 || zahlen.eintraege >= 10) {
    return true;
  }
  const einheiten = eine<{ n: number }>(`SELECT COUNT(*) AS n FROM trainingseinheiten WHERE status = 'fertig'`);
  return (einheiten?.n ?? 0) >= 1;
}

export function bewertungFaellig(jetzt = new Date(), profilGeradeAngelegt = false): boolean {
  if (profilGeradeAngelegt || leseBewertungNie() || leseBewertungWert() !== null) {
    return false;
  }
  if (strideVariable('TEST') === '1' && !leseBewertungTesten()) {
    return false;
  }
  if (heuteBlockiert(lokalesDatum(jetzt))) {
    return false;
  }
  return erfolgErreicht();
}

/** Dieselben Erfolge wie die Bewertung. Die erste Minute nach der Anlage wartet `hinweis_nicht_vor` ab. */
export function angebotFaellig(jetzt = new Date(), profilGeradeAngelegt = false): boolean {
  if (profilGeradeAngelegt || leseHinweisAngebotGesehen()) {
    return false;
  }
  if (strideVariable('TEST') === '1' && !leseHinweisAngebotTesten()) {
    return false;
  }
  const nichtVor = leseHinweisNichtVor();
  if (nichtVor !== null && Date.parse(nichtVor) > jetzt.getTime()) {
    return false;
  }
  if (heuteBlockiert(lokalesDatum(jetzt))) {
    return false;
  }
  return erfolgErreicht();
}

export function mitBewertung<T extends object>(
  ergebnis: T,
  jetzt = new Date(),
  profilGeradeAngelegt = false,
): T & { bewertungFaellig?: true; angebotFaellig?: true } {
  if (bewertungFaellig(jetzt, profilGeradeAngelegt)) {
    return { ...ergebnis, bewertungFaellig: true };
  }
  if (!angebotFaellig(jetzt, profilGeradeAngelegt)) {
    return ergebnis;
  }
  return { ...ergebnis, angebotFaellig: true };
}

export function speichereBewertung(eingabe: { wert: number } | { nie: true }, jetzt = new Date()): BewertungStand {
  return inTransaktion(() => {
    if (leseBewertungNie() || leseBewertungWert() !== null) {
      throw ungueltig(BEWERTUNG_SCHON);
    }
    if ('nie' in eingabe) {
      schreibeBewertungNie();
      return { wert: null, am: null, nie: true };
    }
    const am = lokalesDatum(jetzt);
    schreibeBewertungWert(eingabe.wert, am);
    return { wert: eingabe.wert, am, nie: false };
  });
}
