import { istHexFarbe, normaleHex } from '../../spiel/farben.ts';

export const PALETTEN_SCHLUESSEL = 'paletten';
export const PALETTE_NAME_MAX = 40;
export const PALETTEN_MAX = 24;

export interface EigenePalette {
  id: string;
  name: string;
  primaer: string;
  akzent: string;
  hintergrund: string;
}

export interface PaletteEingabe {
  name: string;
  primaer: string;
  akzent: string;
  hintergrund: string;
}

export class PalettenFehler extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PalettenFehler';
  }
}

function nameNorm(name: string): string {
  return name.trim().toLocaleLowerCase('de-DE');
}

function farbe(wert: unknown): string | undefined {
  return istHexFarbe(wert) ? normaleHex(wert) : undefined;
}

/** Ungültige Einträge fallen weg. Doppelte Namen oder Ids zählen nur einmal. */
export function lesePaletten(roh: unknown): EigenePalette[] {
  if (!Array.isArray(roh)) {
    return [];
  }
  const ergebnis: EigenePalette[] = [];
  const namen = new Set<string>();
  const ids = new Set<string>();
  for (const eintrag of roh) {
    if (eintrag === null || typeof eintrag !== 'object') {
      continue;
    }
    const zeile = eintrag as Record<string, unknown>;
    const id = typeof zeile.id === 'string' ? zeile.id.trim() : '';
    const name = typeof zeile.name === 'string' ? zeile.name.trim() : '';
    const primaer = farbe(zeile.primaer);
    const akzent = farbe(zeile.akzent);
    const hintergrund = farbe(zeile.hintergrund);
    if (id.length === 0 || id.length > 80 || name.length === 0 || name.length > PALETTE_NAME_MAX) {
      continue;
    }
    if (!primaer || !akzent || !hintergrund) {
      continue;
    }
    const norm = nameNorm(name);
    if (ids.has(id) || namen.has(norm)) {
      continue;
    }
    ids.add(id);
    namen.add(norm);
    ergebnis.push({ id, name, primaer, akzent, hintergrund });
    if (ergebnis.length >= PALETTEN_MAX) {
      break;
    }
  }
  return ergebnis;
}

function pruefeName(name: string, liste: readonly EigenePalette[], eigeneId?: string): string {
  const rein = name.trim();
  if (rein.length === 0) {
    throw new PalettenFehler('Der Name darf nicht leer sein.');
  }
  if (rein.length > PALETTE_NAME_MAX) {
    throw new PalettenFehler('Der Name darf höchstens 40 Zeichen haben.');
  }
  const norm = nameNorm(rein);
  if (liste.some((palette) => palette.id !== eigeneId && nameNorm(palette.name) === norm)) {
    throw new PalettenFehler('Der Name ist schon vergeben.');
  }
  return rein;
}

function trio(eingabe: PaletteEingabe): Pick<EigenePalette, 'primaer' | 'akzent' | 'hintergrund'> {
  const primaer = farbe(eingabe.primaer);
  const akzent = farbe(eingabe.akzent);
  const hintergrund = farbe(eingabe.hintergrund);
  if (!primaer || !akzent || !hintergrund) {
    throw new PalettenFehler('Die Farbe braucht das Format #rrggbb.');
  }
  return { primaer, akzent, hintergrund };
}

export function paletteAnlegen(liste: readonly EigenePalette[], eingabe: PaletteEingabe, id: string): EigenePalette[] {
  if (liste.length >= PALETTEN_MAX) {
    throw new PalettenFehler('Höchstens 24 Paletten.');
  }
  const rein = id.trim();
  if (rein.length === 0 || rein.length > 80 || liste.some((palette) => palette.id === rein)) {
    throw new PalettenFehler('Die Palette wurde nicht gefunden.');
  }
  const name = pruefeName(eingabe.name, liste);
  return [...liste, { id: rein, name, ...trio(eingabe) }];
}

export function paletteAendern(liste: readonly EigenePalette[], id: string, eingabe: PaletteEingabe): EigenePalette[] {
  const index = liste.findIndex((palette) => palette.id === id);
  if (index < 0) {
    throw new PalettenFehler('Die Palette wurde nicht gefunden.');
  }
  const name = pruefeName(eingabe.name, liste, id);
  const kopie = liste.slice();
  kopie[index] = { id, name, ...trio(eingabe) };
  return kopie;
}

/** Fehlt die Id, bleibt die Liste. Löschen ist damit wiederholbar. */
export function paletteLoeschen(liste: readonly EigenePalette[], id: string): EigenePalette[] {
  return liste.filter((palette) => palette.id !== id);
}
