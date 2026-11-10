export const VERBINDUNGS_ARTEN = [
  'abgelehnt',
  'netz',
  'bremse',
  'gegenstelle',
  'adresse',
  'zugriff',
  'fehlt',
  'kein_ics',
  'zu_gross',
  'eingabe',
] as const;

export type VerbindungsFehlerArt = (typeof VERBINDUNGS_ARTEN)[number];

const ARTEN = new Set<string>(VERBINDUNGS_ARTEN);

const KURZGRUND: Record<VerbindungsFehlerArt, string> = {
  abgelehnt: 'Token abgelehnt',
  netz: 'Nicht erreichbar',
  bremse: 'Zu viele Anfragen',
  gegenstelle: 'Antwort fehlerhaft',
  adresse: 'Adresse ungültig',
  zugriff: 'Kein Zugriff',
  fehlt: 'Nicht gefunden',
  kein_ics: 'Kein iCal',
  zu_gross: 'Zu groß',
  eingabe: 'Token unvollständig',
};

const LOESUNG: Record<VerbindungsFehlerArt, string> = {
  abgelehnt: 'Token neu eingeben',
  netz: 'Wartet auf den nächsten Abgleich.',
  bremse: 'Der nächste Abgleich versucht es erneut.',
  gegenstelle: 'Der nächste Abgleich versucht es erneut.',
  adresse: 'Prüfe die Adresse.',
  zugriff: 'Kopiere die Adresse neu.',
  fehlt: 'Kopiere die Adresse neu.',
  kein_ics: 'Nimm die Adresse im iCal-Format.',
  zu_gross: 'Nimm einen kleineren Kalender.',
  eingabe: 'Kopiere den ganzen Token aus Todoist.',
};

/** Altsätze, erste Zeile. Ein umformulierter Satz verliert die Art nicht, solange sie gespeichert ist. */
const SATZ_ZU_ART: Record<string, VerbindungsFehlerArt> = {
  'Todoist lehnt den Token ab. Prüfe ihn in den Todoist-Einstellungen.': 'abgelehnt',
  'Todoist ist gerade nicht erreichbar.': 'netz',
  'Der Kalender ist gerade nicht erreichbar.': 'netz',
  'Todoist bremst gerade zu viele Anfragen. Der nächste Abgleich versucht es erneut.': 'bremse',
  'Der Kalender bremst gerade zu viele Anfragen. Der nächste Abgleich versucht es erneut.': 'bremse',
  'Todoist hat die Anfrage abgelehnt. Der nächste Abgleich versucht es erneut.': 'gegenstelle',
  'Todoist hat keine lesbare Antwort geschickt.': 'gegenstelle',
  'Todoist hat in einem unerwarteten Format geantwortet.': 'gegenstelle',
  'Der Kalender hat die Anfrage abgelehnt.': 'gegenstelle',
  'Die Kalender-Adresse ist keine gültige Internetadresse.': 'adresse',
  'Die Kalender-Adresse muss mit https:// oder webcal:// beginnen.': 'adresse',
  'Der Kalender lehnt den Zugriff ab. Prüfe die Adresse.': 'zugriff',
  'Unter dieser Adresse liegt kein Kalender.': 'fehlt',
  'Unter dieser Adresse liegt kein Kalender im iCal-Format.': 'kein_ics',
  'Der Kalender ist zu groß.': 'zu_gross',
  'Der Todoist-Token ist zu kurz.': 'eingabe',
  'Der Todoist-Token ist zu lang.': 'eingabe',
};

const TRENNER = ': ';

export function istVerbindungsFehlerArt(wert: string | null | undefined): wert is VerbindungsFehlerArt {
  return typeof wert === 'string' && ARTEN.has(wert);
}

export function kurzgrund(art: VerbindungsFehlerArt): string {
  return KURZGRUND[art];
}

export function loesung(art: VerbindungsFehlerArt): string {
  return LOESUNG[art];
}

export function artAusSatz(text: string | null | undefined): VerbindungsFehlerArt | null {
  if (!text) {
    return null;
  }
  const zeile = text.split('\n')[0]?.trim() ?? '';
  if (zeile === '') {
    return null;
  }
  const direkt = SATZ_ZU_ART[zeile];
  if (direkt) {
    return direkt;
  }
  const trenn = zeile.indexOf(TRENNER);
  if (trenn <= 0) {
    return null;
  }
  return SATZ_ZU_ART[zeile.slice(trenn + TRENNER.length)] ?? null;
}

export function artAusSpeicher(gespeichert: string | null, text: string | null): VerbindungsFehlerArt | null {
  if (istVerbindungsFehlerArt(gespeichert)) {
    return gespeichert;
  }
  return artAusSatz(text);
}
