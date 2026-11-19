/** Aktuelle Fassung der Nutzungsbedingungen und der Datenschutzerklärung. */
export const RECHT_FASSUNG = '2026-11-18';

/** Konten ohne gespeicherte Zustimmung gelten als diese Fassung. Nur RECHT_FASSUNG anheben, wenn die Texte wechseln. */
export const RECHT_FASSUNG_BESTAND = '2026-11-18';

export const ZUSTIMMUNG_FEHLT =
  'Bitte bestätige die Nutzungsbedingungen, den Datenschutz und dass du mindestens 16 Jahre alt bist.';

export const ZUSTIMMUNG_KASTEN =
  'Ich habe die Nutzungsbedingungen und die Datenschutzerklärung gelesen und bin mindestens 16 Jahre alt.';

export const ZUSTIMMUNG_DIALOG_TITEL = 'Neue Bedingungen annehmen?';

export const ZUSTIMMUNG_DIALOG_SATZ =
  'Die neue Fassung der Nutzungsbedingungen und der Datenschutzerklärung gilt erst, wenn du zustimmst.';

export const ZUSTIMMUNG_KNOPF = 'Zustimmen';

export function istZustimmungAktuell(
  gespeichert: string | null,
  aktuell = RECHT_FASSUNG,
  bestand = RECHT_FASSUNG_BESTAND,
): boolean {
  return (gespeichert ?? bestand) === aktuell;
}

export type ZustimmungsTeil = { art: 'text' | 'nutzung' | 'datenschutz'; text: string };

/** Setzt Links an den übersetzten Titeln. Der übrige Satz bleibt Text. */
export function teileZustimmung(satz: string, nutzung: string, datenschutz: string): ZustimmungsTeil[] {
  const marken = [
    { art: 'nutzung' as const, text: nutzung },
    { art: 'datenschutz' as const, text: datenschutz },
  ]
    .filter((marke) => marke.text.length > 0)
    .map((marke) => ({ ...marke, bei: satz.indexOf(marke.text) }))
    .filter((marke) => marke.bei >= 0)
    .sort((a, b) => a.bei - b.bei || b.text.length - a.text.length);

  const teile: ZustimmungsTeil[] = [];
  let cursor = 0;
  for (const marke of marken) {
    if (marke.bei < cursor) {
      continue;
    }
    if (marke.bei > cursor) {
      teile.push({ art: 'text', text: satz.slice(cursor, marke.bei) });
    }
    teile.push({ art: marke.art, text: marke.text });
    cursor = marke.bei + marke.text.length;
  }
  if (cursor < satz.length) {
    teile.push({ art: 'text', text: satz.slice(cursor) });
  }
  return teile;
}
