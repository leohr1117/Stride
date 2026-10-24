export const TAGE_PRO_WOCHE = 7;
export const MS_PRO_TAG = 24 * 60 * 60 * 1000;
export const DATUM_HINWEIS = 'Das Datum muss im Format JJJJ-MM-TT angegeben werden.';

export function lokalesDatum(zeitpunkt: Date): string {
  const jahr = zeitpunkt.getFullYear();
  const monat = String(zeitpunkt.getMonth() + 1).padStart(2, '0');
  const tag = String(zeitpunkt.getDate()).padStart(2, '0');
  return `${jahr}-${monat}-${tag}`;
}

export function tagesbeginn(zeitpunkt: Date, tageZurueck = 0): Date {
  const beginn = new Date(zeitpunkt);
  beginn.setHours(0, 0, 0, 0);
  beginn.setDate(beginn.getDate() - tageZurueck);
  return beginn;
}

export function plusTage(zeitpunkt: Date, tage: number): Date {
  const ergebnis = new Date(zeitpunkt);
  ergebnis.setDate(ergebnis.getDate() + tage);
  return ergebnis;
}

export function wochenbeginn(zeitpunkt: Date, wochenZurueck = 0): Date {
  const tageSeitMontag = (zeitpunkt.getDay() + TAGE_PRO_WOCHE - 1) % TAGE_PRO_WOCHE;
  return tagesbeginn(zeitpunkt, tageSeitMontag + wochenZurueck * TAGE_PRO_WOCHE);
}

/** Kalendertag aus einem JJJJ-MM-TT-Schlüssel, ohne Formatprüfung. */
export function ausTagesSchluessel(tagesSchluessel: string): Date {
  const [jahr, monat, tag] = tagesSchluessel.split('-').map(Number);
  return new Date(jahr, monat - 1, tag);
}

/** Kalendertag in der Zone. null oder eine ungültige Zone fällt auf lokalesDatum zurück. */
export function datumInZone(zeitpunkt: Date, zone: string | null): string {
  if (zone === null || zone.trim() === '') {
    return lokalesDatum(zeitpunkt);
  }
  try {
    const teile = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(zeitpunkt);
    const wert = (art: Intl.DateTimeFormatPartTypes) => teile.find((teil) => teil.type === art)?.value ?? '';
    const datum = `${wert('year').padStart(4, '0')}-${wert('month').padStart(2, '0')}-${wert('day').padStart(2, '0')}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(datum) ? datum : lokalesDatum(zeitpunkt);
  } catch {
    return lokalesDatum(zeitpunkt);
  }
}
