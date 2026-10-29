import { ATTRIBUT_KATALOG } from '../features/attribute/attributKatalog.ts';
import type { AttributKennung } from '../spiel/begriffe.ts';
import { fuelle, platzhalter, ZIEL_SPRACHEN, type Sprache, type ZielSprache } from './kern.ts';
import { PAARE as FEHLER } from './paare/fehler.ts';
import { PAARE as KATALOG } from './paare/katalog.ts';
import { PAARE as PFLICHT } from './paare/pflicht.ts';
import { PAARE as UI } from './paare/ui.ts';
import { PAARE as VERSIONEN } from './paare/versionen.ts';
import { PAARE as VORBILDER } from './paare/vorbilder.ts';
import { TEXTE as ES } from './weitere/es.ts';
import { TEXTE as FR } from './weitere/fr.ts';
import { TEXTE as JA } from './weitere/ja.ts';
import { TEXTE as RU } from './weitere/ru.ts';
import { TEXTE as ZH } from './weitere/zh.ts';

const ALLE = [...PFLICHT, ...KATALOG, ...FEHLER, ...VERSIONEN, ...VORBILDER, ...UI] as const;

export type TextKey = (typeof ALLE)[number][0];

interface Vorlage {
  de: string;
  ziel: Partial<Record<ZielSprache, string>>;
  regex: RegExp;
  namen: string[];
}

const WEITERE: Record<Exclude<ZielSprache, 'en'>, Record<string, string>> = {
  es: ES,
  fr: FR,
  ru: RU,
  zh: ZH,
  ja: JA,
};

const karten = new Map<ZielSprache, Map<string, string>>();
for (const sprache of ZIEL_SPRACHEN) {
  karten.set(sprache, new Map());
}

const EBENEN_LISTEN = new Set([
  '{liste} werden ausgeblendet und lassen sich wieder einschalten.',
  '{liste} wird ausgeblendet und lässt sich wieder einschalten.',
]);

const KATALOG_FELDER = new Set(['Erschöpfung: {name}', 'Erschöpfung: {quelle} → {ziel}']);

/** Platzhalter sind feste UI-Begriffe, keine Nutzernamen. */
const LABEL_FELDER = new Set([
  '{feld} darf nicht leer sein.',
  '{feld} darf höchstens {max} Zeichen haben.',
  '{name} ist ausgeschaltet.',
  '{name} ist in den Einstellungen ausgeschaltet.',
  '{name} sind ausgeschaltet.',
  '{was} wurde nicht gefunden.',
  'Der letzte {name}-Wert bleibt aktiv. Schalte den Bereich in den Einstellungen aus.',
]);

const EINHEIT_FELDER = new Set([
  'Zu groß: erwartet, dass {origin} {grenze} {einheit} hat',
  'Zu klein: erwartet, dass {origin} {grenze} {einheit} hat',
]);

const EBENEN_WOERTER = ['Organisationen', 'Organisation', 'Visionen', 'Vision', 'Projekte', 'Projekt', 'Vorhaben'] as const;

function maskiere(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function namenIn(text: string): string[] {
  return [...text.matchAll(/\{([a-zA-Z0-9]+)\}/g)].map((treffer) => treffer[1] ?? '');
}

function merke(sprache: ZielSprache, deutsch: string, text: string): void {
  if (text.length === 0 || text.trim() !== text) {
    throw new Error(`Leere Übersetzung (${sprache}): ${deutsch}`);
  }
  if (platzhalter(text).join('\0') !== platzhalter(deutsch).join('\0')) {
    throw new Error(`Platzhalter weichen ab (${sprache}): ${deutsch}`);
  }
  const karte = karten.get(sprache);
  if (!karte) {
    return;
  }
  const bisher = karte.get(deutsch);
  if (bisher !== undefined && bisher !== text) {
    throw new Error(`Widersprüchliche Übersetzung für „${deutsch}“ (${sprache})`);
  }
  karte.set(deutsch, text);
}

for (const [deutsch, englisch] of ALLE) {
  merke('en', deutsch, englisch);
}

for (const sprache of ['es', 'fr', 'ru', 'zh', 'ja'] as const) {
  for (const [deutsch, text] of Object.entries(WEITERE[sprache])) {
    merke(sprache, deutsch, text);
  }
}

const vorlagen: Vorlage[] = [];
for (const deutsch of karten.get('en')?.keys() ?? []) {
  if (!deutsch.includes('{')) {
    continue;
  }
  const namen = namenIn(deutsch);
  const muster = maskiere(deutsch).replace(/\\\{[a-zA-Z0-9]+\\\}/g, '([\\s\\S]+?)');
  const ziel: Partial<Record<ZielSprache, string>> = {};
  for (const sprache of ZIEL_SPRACHEN) {
    const text = karten.get(sprache)?.get(deutsch);
    if (text) {
      ziel[sprache] = text;
    }
  }
  vorlagen.push({ de: deutsch, ziel, regex: new RegExp(`^${muster}$`), namen });
}
vorlagen.sort((links, rechts) => rechts.de.length - links.de.length);

let aktiv: Sprache = 'de';

export function setzeAktiveSprache(sprache: Sprache): void {
  aktiv = sprache;
}

export function aktiveSprache(): Sprache {
  return aktiv;
}

export function hatSchluessel(text: string): boolean {
  return karten.get('en')?.has(text) ?? false;
}

export function englisch(text: string): string | undefined {
  return karten.get('en')?.get(text);
}

export function texteDer(sprache: ZielSprache): ReadonlyMap<string, string> {
  return karten.get(sprache) ?? new Map();
}

export function allePaare(): readonly (readonly [string, string])[] {
  return [...(karten.get('en')?.entries() ?? [])];
}

function textVon(sprache: ZielSprache, text: string): string | undefined {
  return karten.get(sprache)?.get(text);
}

function katalogName(name: string, sprache: Sprache): string {
  if (sprache === 'de' || !name) {
    return name;
  }
  for (const vorlage of ATTRIBUT_KATALOG) {
    const uebersetzt = textVon(sprache, vorlage.name);
    if (name === vorlage.name || name === uebersetzt) {
      return uebersetzt ?? name;
    }
  }
  return name;
}

function ebenenListe(liste: string, sprache: ZielSprache): string {
  let text = liste;
  for (const wort of EBENEN_WOERTER) {
    text = text.replaceAll(wort, textVon(sprache, wort) ?? wort);
  }
  const und = textVon(sprache, 'und') ?? 'und';
  const luecke = sprache === 'zh' || sprache === 'ja' ? '' : ' ';
  return text.replaceAll(' und ', `${luecke}${und}${luecke}`);
}

function werteFuer(schluessel: string, werte: Record<string, string>, sprache: ZielSprache): Record<string, string> {
  if (EBENEN_LISTEN.has(schluessel)) {
    return { ...werte, liste: werte.liste ? ebenenListe(werte.liste, sprache) : '' };
  }
  if (KATALOG_FELDER.has(schluessel)) {
    const ergebnis: Record<string, string> = {};
    for (const [feld, wert] of Object.entries(werte)) {
      ergebnis[feld] = katalogName(wert, sprache);
    }
    return ergebnis;
  }
  if (LABEL_FELDER.has(schluessel)) {
    const ergebnis: Record<string, string> = {};
    for (const [feld, wert] of Object.entries(werte)) {
      ergebnis[feld] = feld === 'max' || feld === 'status' ? wert : (textVon(sprache, wert) ?? wert);
    }
    return ergebnis;
  }
  if (EINHEIT_FELDER.has(schluessel)) {
    return { ...werte, einheit: werte.einheit ? (textVon(sprache, werte.einheit) ?? werte.einheit) : '' };
  }
  return werte;
}

export function uebersetze(sprache: Sprache, schluessel: TextKey, werte?: Record<string, string | number>): string {
  const vorlage = sprache === 'de' ? schluessel : (textVon(sprache, schluessel) ?? schluessel);
  return werte ? fuelle(vorlage, werte) : vorlage;
}

export function zeige(text: string, sprache: Sprache = aktiv, werte?: Record<string, string | number>): string {
  if (!text || sprache === 'de') {
    return werte ? fuelle(text, werte) : text;
  }
  if (werte) {
    const vorlage = textVon(sprache, text);
    return fuelle(vorlage ?? text, werte);
  }
  const direkt = textVon(sprache, text);
  if (direkt !== undefined) {
    return direkt;
  }
  for (const vorlage of vorlagen) {
    const treffer = vorlage.regex.exec(text);
    if (!treffer) {
      continue;
    }
    const erfasst: Record<string, string> = {};
    vorlage.namen.forEach((name, index) => {
      erfasst[name] = treffer[index + 1] ?? '';
    });
    return fuelle(vorlage.ziel[sprache] ?? vorlage.de, werteFuer(vorlage.de, erfasst, sprache));
  }
  return text;
}

const katalogNachKennung = new Map(ATTRIBUT_KATALOG.map((eintrag) => [eintrag.kennung, eintrag]));

/** Der Status „Ansehen“ bleibt Reputation. Der Knopf der Angebotskarte benutzt das bloße Wort. */
function katalogNameSchluessel(name: string): string {
  return name === 'Ansehen' ? 'Status Ansehen' : name;
}

/** True, wenn der Text der deutsche Katalogtext oder eine seiner Übersetzungen ist. */
export function gleicherKatalogtext(original: string, text: string): boolean {
  if (text === original) {
    return true;
  }
  const sonder = katalogNameSchluessel(original);
  for (const sprache of ZIEL_SPRACHEN) {
    if (textVon(sprache, original) === text) {
      return true;
    }
    if (sonder !== original && textVon(sprache, sonder) === text) {
      return true;
    }
  }
  return false;
}

/** Katalogname speichern. Deutsch bleibt der Vorlagenname, auch wenn die Oberfläche das Wort anders nutzt. */
export function zeigeKatalogname(name: string, sprache: Sprache = aktiv): string {
  if (sprache === 'de') {
    return name;
  }
  return zeige(katalogNameSchluessel(name), sprache);
}

export function zeigeAttributName(
  eintrag: { kennung?: string | null; name: string },
  sprache: Sprache = aktiv,
): string {
  if (eintrag.kennung) {
    const vorlage = katalogNachKennung.get(eintrag.kennung as AttributKennung);
    if (vorlage && gleicherKatalogtext(vorlage.name, eintrag.name)) {
      if (sprache === 'de') {
        return vorlage.name;
      }
      return textVon(sprache, katalogNameSchluessel(vorlage.name)) ?? vorlage.name;
    }
    return eintrag.name;
  }
  if (sprache === 'de') {
    return eintrag.name;
  }
  return katalogName(eintrag.name, sprache);
}

export function zeigeAttributText(
  eintrag: { kennung?: string | null; name: string; beschreibung?: string },
  sprache: Sprache = aktiv,
): { name: string; beschreibung: string } {
  const name = zeigeAttributName(eintrag, sprache);
  const beschreibung = eintrag.beschreibung ?? '';
  if (sprache === 'de' || !eintrag.kennung) {
    return { name, beschreibung: eintrag.kennung ? katalogBeschreibung(eintrag.kennung, beschreibung, sprache) : beschreibung };
  }
  return { name, beschreibung: katalogBeschreibung(eintrag.kennung, beschreibung, sprache) };
}

function katalogBeschreibung(kennung: string, beschreibung: string, sprache: Sprache): string {
  const vorlage = katalogNachKennung.get(kennung as AttributKennung);
  if (!vorlage || !gleicherKatalogtext(vorlage.beschreibung, beschreibung)) {
    return beschreibung;
  }
  if (sprache === 'de') {
    return vorlage.beschreibung;
  }
  return textVon(sprache, vorlage.beschreibung) ?? vorlage.beschreibung;
}

/** Adjektiv steht im Deutschen vor dem Nomen. Romanische Sprachen drehen das, CJK setzt es davor ohne Abstand. */
function klassenFolge(sprache: ZielSprache, beiname: string, name: string): string {
  if (sprache === 'es' || sprache === 'fr') {
    return `${name} ${beiname}`;
  }
  if (sprache === 'zh') {
    return `${beiname}的${name}`;
  }
  if (sprache === 'ja') {
    return `${beiname}${name}`;
  }
  return `${beiname} ${name}`;
}

export function klasseAnzeigen(klasse: string, sprache: Sprache = aktiv): string {
  if (sprache === 'de' || !klasse) {
    return klasse;
  }
  const direkt = textVon(sprache, klasse);
  if (direkt) {
    return direkt;
  }
  const woerter = klasse.split(' ');
  if (woerter.length === 2) {
    const beiname = textVon(sprache, woerter[0] ?? '');
    const name = textVon(sprache, woerter[1] ?? '');
    if (beiname && name) {
      return klassenFolge(sprache, beiname, name);
    }
  }
  if (woerter.length > 0 && woerter.every((wort) => textVon(sprache, wort))) {
    const teile = woerter.map((wort) => textVon(sprache, wort) ?? wort);
    return sprache === 'zh' || sprache === 'ja' ? teile.join('') : teile.join(' ');
  }
  return klasse;
}

export function zeigeErfolg(name: string, sprache: Sprache = aktiv): string {
  return zeige(name, sprache);
}
