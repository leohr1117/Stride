import type { QueryClient } from '@tanstack/react-query';
import { SCHLUESSEL } from '../../api/index.ts';
import { beobachteAnmeldung } from '../../api/kern.ts';
import { leseSitzung, merkeSitzung } from '../../speicher.ts';
import { bewertungIstFaellig } from './bewertungStand.ts';

/** Übersteht Neuladen im selben Tab. Abmelden leert ihn, damit das nächste Konto die Karte nicht erbt. */
const SPEICHER = 'ascend.hinweisAngebot';

let faellig = false;
let gelesen = false;
let fehler: Error | null = null;
let speichert = false;
let beobachtet = false;

function liesSpeicher(): boolean {
  if (!gelesen) {
    faellig = leseSitzung(SPEICHER);
    gelesen = true;
  }
  return faellig;
}

export function angebotIstFaellig(): boolean {
  return liesSpeicher() && !bewertungIstFaellig();
}

export function angebotFehler(): Error | null {
  return fehler;
}

export function merkeAngebotFaellig(
  client: QueryClient,
  ergebnis: { bewertungFaellig?: true; angebotFaellig?: true },
): void {
  if (ergebnis.bewertungFaellig === true || ergebnis.angebotFaellig !== true) {
    return;
  }
  faellig = true;
  gelesen = true;
  fehler = null;
  merkeSitzung(SPEICHER, true);
  client.setQueryData(SCHLUESSEL.angebot, true);
}

/** Blendet die Karte sofort aus. Die Sitzung bleibt, bis der Server gesehen gespeichert hat. */
export function beginneAngebot(client: QueryClient): boolean {
  if (speichert) {
    return false;
  }
  speichert = true;
  fehler = null;
  faellig = false;
  gelesen = true;
  client.setQueryData(SCHLUESSEL.angebot, false);
  return true;
}

export function angebotGespeichert(): void {
  speichert = false;
  faellig = false;
  gelesen = true;
  merkeSitzung(SPEICHER, false);
}

export function angebotSchlugFehl(client: QueryClient): void {
  fehler = new Error('Etwas ist schiefgelaufen.');
  faellig = true;
  gelesen = true;
  speichert = false;
  merkeSitzung(SPEICHER, true);
  client.setQueryData(SCHLUESSEL.angebot, true);
}

function angebotVergessen(): void {
  faellig = false;
  gelesen = true;
  fehler = null;
  speichert = false;
  merkeSitzung(SPEICHER, false);
}

export function beobachteAngebotAbmeldung(): void {
  if (beobachtet) {
    return;
  }
  beobachtet = true;
  beobachteAnmeldung(angebotVergessen);
}
