import {
  aktiveSprache,
  klasseAnzeigen,
  zeige,
  zeigeAttributName,
  zeigeAttributText,
  zeigeErfolg,
  zeigeKatalogname,
} from '../../shared/sprache/index.ts';

/** Oberfläche übersetzen. Nutzernamen und Einträge nicht hier durchreichen. */
export function tx(text: string, werte?: Record<string, string | number>): string {
  return zeige(text, aktiveSprache(), werte);
}

/** Katalogname eines Attributs. Eigene Namen bleiben. */
export function attributName(eintrag: { kennung?: string | null; name: string }): string {
  return zeigeAttributName(eintrag, aktiveSprache());
}

/** Vorlagenname. „Ansehen“ bleibt der Status, nicht der Knopf der Angebotskarte. */
export function katalogName(name: string): string {
  return zeigeKatalogname(name, aktiveSprache());
}

/** Katalogtext eines Attributs. Eigene Beschreibungen bleiben. */
export function attributBeschreibung(eintrag: { kennung?: string | null; name: string; beschreibung?: string }): string {
  return zeigeAttributText(eintrag, aktiveSprache()).beschreibung;
}

/** Sichtbare Klasse. Das Icon bleibt beim deutschen Klassennamen. */
export function klassenText(klasse: string): string {
  return klasseAnzeigen(klasse, aktiveSprache());
}

export function erfolgText(name: string): string {
  return zeigeErfolg(name, aktiveSprache());
}
