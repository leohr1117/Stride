import {
  ausTagesSchluessel as kalenderTag,
  DATUM_HINWEIS,
  lokalesDatum,
  plusTage,
  tagesbeginn,
  wochenbeginn,
} from '../../shared/spiel/datum.ts';
import { ungueltig } from '../fehler.ts';

export { lokalesDatum, plusTage, tagesbeginn, wochenbeginn };

const MITTAG = 12;
const DATUM_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;

export function datumPlus(datum: string, tage: number): string {
  if (!DATUM_FORMAT.test(datum)) {
    throw ungueltig(DATUM_HINWEIS);
  }
  const zeitpunkt = kalenderTag(datum);
  zeitpunkt.setDate(zeitpunkt.getDate() + tage);
  return lokalesDatum(zeitpunkt);
}

export function zeitpunktFuerEintrag(datum: string | null, jetzt: Date): Date {
  if (datum === null || datum === lokalesDatum(jetzt)) {
    return jetzt;
  }

  const treffer = DATUM_FORMAT.exec(datum);
  if (!treffer) {
    throw ungueltig(DATUM_HINWEIS);
  }
  const jahr = Number(treffer[1]);
  const monat = Number(treffer[2]);
  const tag = Number(treffer[3]);
  const zeitpunkt = new Date(jahr, monat - 1, tag, MITTAG);

  if (zeitpunkt.getFullYear() !== jahr || zeitpunkt.getMonth() !== monat - 1 || zeitpunkt.getDate() !== tag) {
    throw ungueltig(`Das Datum ${datum} existiert nicht.`);
  }
  if (zeitpunkt > jetzt) {
    throw ungueltig('Ein Eintrag kann nicht in der Zukunft liegen.');
  }
  return zeitpunkt;
}

export function monatsbeginn(zeitpunkt: Date, monateZurueck = 0): Date {
  return new Date(zeitpunkt.getFullYear(), zeitpunkt.getMonth() - monateZurueck, 1);
}

export function ausTagesSchluessel(tag: string): Date {
  if (!DATUM_FORMAT.test(tag)) {
    throw ungueltig(DATUM_HINWEIS);
  }
  return kalenderTag(tag);
}
