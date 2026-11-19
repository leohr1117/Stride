import fs from 'node:fs';
import path from 'node:path';

const LIZENZ_DATEIEN = ['LICENSE', 'LICENCE', 'COPYING', 'LICENSE.md', 'LICENSE.txt', 'LICENCE.md', 'LICENCE.txt', 'COPYING.txt', 'NOTICE'];
const MAX_TEXT = 20_000;

interface PaketJson {
  name?: unknown;
  version?: unknown;
  license?: unknown;
  licenses?: unknown;
  author?: unknown;
  homepage?: unknown;
  dependencies?: unknown;
  optionalDependencies?: unknown;
}

interface Eintrag {
  name: string;
  version: string;
  lizenz: string;
  urheber: string;
  homepage: string;
  text: string;
}

function text(wert: unknown): string {
  return typeof wert === 'string' ? wert.trim() : '';
}

function person(wert: unknown): string {
  if (typeof wert === 'string') {
    return wert.trim();
  }
  if (Array.isArray(wert)) {
    return wert.map(person).filter((teil) => teil.length > 0).join(', ');
  }
  if (wert && typeof wert === 'object' && 'name' in wert) {
    return text((wert as { name: unknown }).name);
  }
  return '';
}

function lizenzName(paket: PaketJson): string {
  const einfach = text(paket.license);
  if (einfach.length > 0) {
    return einfach;
  }
  const liste = paket.licenses;
  if (!Array.isArray(liste)) {
    return 'unbekannt';
  }
  const namen = liste
    .map((eintrag) => (eintrag && typeof eintrag === 'object' && 'type' in eintrag ? text((eintrag as { type: unknown }).type) : ''))
    .filter((name) => name.length > 0);
  return namen.length > 0 ? namen.join(' OR ') : 'unbekannt';
}

function abhaengigkeiten(wert: unknown): string[] {
  if (!wert || typeof wert !== 'object' || Array.isArray(wert)) {
    return [];
  }
  return Object.keys(wert).sort();
}

function aufloesen(name: string, von: string): string | null {
  let dir = von;
  for (;;) {
    const kandidat = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(kandidat, 'package.json'))) {
      return kandidat;
    }
    const eltern = path.dirname(dir);
    if (eltern === dir) {
      return null;
    }
    dir = eltern;
  }
}

function liesJson(datei: string): PaketJson {
  return JSON.parse(fs.readFileSync(datei, 'utf8')) as PaketJson;
}

function lizenzText(ordner: string): string {
  for (const name of LIZENZ_DATEIEN) {
    const datei = path.join(ordner, name);
    if (!fs.existsSync(datei) || !fs.statSync(datei).isFile()) {
      continue;
    }
    const roh = fs.readFileSync(datei, 'utf8').replaceAll('\r\n', '\n').replace(/<!--[\s\S]*?-->/g, '').trim();
    if (roh.length === 0) {
      continue;
    }
    if (roh.length <= MAX_TEXT) {
      return roh;
    }
    return `${roh.slice(0, MAX_TEXT).trim()}\n\n[Lizenztext gekürzt, vollständig im Paket ${name}]`;
  }
  return '';
}

function urheber(textDatei: string, autor: string): string {
  const zeilen = textDatei
    .split('\n')
    .map((zeile) => zeile.trim())
    .filter((zeile) => zeile.length <= 160 && /^copyright\s+(\(c\)\s+)?\d{4}\b/i.test(zeile));
  const einzig = [...new Set(zeilen)].slice(0, 3);
  if (einzig.length > 0) {
    return einzig.join(' ');
  }
  return autor;
}

function sammle(wurzel: string): Eintrag[] {
  const direkt = abhaengigkeiten(liesJson(path.join(wurzel, 'package.json')).dependencies);
  if (direkt.length === 0) {
    throw new Error('Lizenzliste: package.json hat keine Produktionsabhängigkeiten.');
  }
  const gesehen = new Set<string>();
  const eintraege: Eintrag[] = [];
  const fehlt: string[] = [];

  const besuche = (name: string, von: string, pflicht: boolean): void => {
    const ordner = aufloesen(name, von);
    if (!ordner) {
      if (pflicht) {
        fehlt.push(name);
      }
      return;
    }
    const paket = liesJson(path.join(ordner, 'package.json'));
    const paketName = text(paket.name) || name;
    const version = text(paket.version) || '0.0.0';
    const schluessel = `${paketName}@${version}`;
    if (gesehen.has(schluessel)) {
      return;
    }
    gesehen.add(schluessel);
    const datei = lizenzText(ordner);
    const autor = person(paket.author);
    eintraege.push({
      name: paketName,
      version,
      lizenz: lizenzName(paket),
      urheber: urheber(datei, autor),
      homepage: text(paket.homepage),
      text: datei,
    });
    for (const abhaengig of abhaengigkeiten(paket.dependencies)) {
      besuche(abhaengig, ordner, true);
    }
    for (const abhaengig of abhaengigkeiten(paket.optionalDependencies)) {
      besuche(abhaengig, ordner, false);
    }
  };

  for (const name of direkt) {
    besuche(name, wurzel, true);
  }
  if (fehlt.length > 0) {
    throw new Error(`Lizenzliste: Pakete fehlen: ${[...new Set(fehlt)].sort().join(', ')}`);
  }
  for (const name of direkt) {
    if (!eintraege.some((eintrag) => eintrag.name === name)) {
      throw new Error(`Lizenzliste ohne direkte Abhängigkeit ${name}`);
    }
  }
  eintraege.sort((links, rechts) => links.name.localeCompare(rechts.name) || links.version.localeCompare(rechts.version));
  return eintraege;
}

function block(eintrag: Eintrag): string {
  const zeilen = [`## ${eintrag.name}@${eintrag.version}`, `Lizenz: ${eintrag.lizenz}`];
  if (eintrag.urheber.length > 0) {
    zeilen.push(`Urheber: ${eintrag.urheber}`);
  }
  if (eintrag.homepage.length > 0) {
    zeilen.push(`Seite: ${eintrag.homepage}`);
  }
  if (eintrag.text.length > 0) {
    zeilen.push('', eintrag.text);
  }
  return zeilen.join('\n');
}

/** Schreibt die Produktionslizenzen nach `ziel`. Ohne neues Paket, ohne HTML-Kommentare. */
export function schreibeLizenzen(wurzel: string, ziel: string): void {
  const eintraege = sammle(wurzel);
  const kopf = [
    'Open-Source-Komponenten von Stride',
    'Liste der Produktionsabhängigkeiten mit Lizenz und Lizenztext.',
    '',
  ].join('\n');
  const inhalt = `${kopf}${eintraege.map(block).join('\n\n')}\n`;
  if (inhalt.includes('<!--')) {
    throw new Error('Lizenzliste enthält einen HTML-Kommentar.');
  }
  fs.mkdirSync(path.dirname(ziel), { recursive: true });
  fs.writeFileSync(ziel, inhalt);
}
