import type { QueryClient } from '@tanstack/react-query';
import { SCHLUESSEL } from '../../api/index.ts';

/** Übersteht invalidateQueries. Ein Neuladen leert das Modul und damit die Zeile. */
let faellig = false;
let fehler: Error | null = null;
let speichert = false;
let weggelegt = false;

export function bewertungIstFaellig(): boolean {
  return faellig;
}

export function bewertungFehler(): Error | null {
  return fehler;
}

export function merkeBewertungFaellig(client: QueryClient, ergebnis: { bewertungFaellig?: true }): void {
  if (weggelegt || ergebnis.bewertungFaellig !== true) {
    return;
  }
  faellig = true;
  fehler = null;
  client.setQueryData(SCHLUESSEL.bewertung, true);
}

/** Blendet die Zeile bis zum Neuladen aus und speichert nichts. */
export function bewertungWeglegen(client: QueryClient): void {
  weggelegt = true;
  faellig = false;
  fehler = null;
  client.setQueryData(SCHLUESSEL.bewertung, false);
}

/** Blendet die Zeile sofort aus. Ein zweiter Klick während des Speicherns tut nichts. */
export function beginneBewertung(client: QueryClient): boolean {
  if (speichert) {
    return false;
  }
  speichert = true;
  fehler = null;
  faellig = false;
  client.setQueryData(SCHLUESSEL.bewertung, false);
  return true;
}

export function bewertungGespeichert(): void {
  speichert = false;
}

export function bewertungSchlugFehl(client: QueryClient): void {
  fehler = new Error('Etwas ist schiefgelaufen.');
  faellig = true;
  speichert = false;
  client.setQueryData(SCHLUESSEL.bewertung, true);
}
