import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hatSchluessel, texteDer, zeige } from './index.ts';
import { ZIEL_SPRACHEN } from './kern.ts';

const WURZEL = join(import.meta.dirname, '../..');
const CLIENT = join(WURZEL, 'client/src');
const ERLAUBT = new Set(['Stride', 'XP']);
const UEBERSETZER = ['tx', 'zeige', 'attributName', 'erfolgText', 'klassenText'];

function dateien(ordner: string): string[] {
  const ergebnis: string[] = [];
  for (const name of readdirSync(ordner, { withFileTypes: true })) {
    const pfad = join(ordner, name.name);
    if (name.isDirectory()) {
      ergebnis.push(...dateien(pfad));
    } else if (/\.tsx?$/.test(name.name) && !name.name.includes('.test.')) {
      ergebnis.push(pfad);
    }
  }
  return ergebnis;
}

function relativ(pfad: string): string {
  return pfad.slice(WURZEL.length + 1).replaceAll('\\', '/');
}

function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
}

function ohneWurf(quelle: string): string {
  return quelle.replace(/throw new Error\((['"`])(?:\\.|(?!\1)[^\\])*\1\)/g, ' ');
}

function texteIn(quelle: string, muster: RegExp): string[] {
  return [...quelle.matchAll(muster)].map((treffer) => treffer[1] ?? '').filter((text) => text.length > 0);
}

function palettenNamen(): string[] {
  const quelle = readFileSync(join(WURZEL, 'shared/features/darstellung/paletten.ts'), 'utf8');
  return texteIn(quelle, /name: '([^']+)'/g);
}

function stilLabel(): string[] {
  const quelle = readFileSync(join(WURZEL, 'shared/features/darstellung/stile.ts'), 'utf8');
  return texteIn(quelle, /label: '([^']+)'/g);
}

const CODEWORT =
  /\b(const|let|return|function|import|export|type|interface|default|case|void|null|undefined|true|false|new|switch|else|break|continue|throw|catch|from|async|await|typeof|instanceof|yield|var|this|super|class|extends)\b/;

function lesbar(text: string): string {
  return text
    .replace(/\$\{[^}]*\}/g, ' ')
    .replace(/["'`¶]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Eine Vorlage wie `{name} löschen?` übersetzt zeige schon. Der Quelltext enthält dann `${…}`. */
function musterGedeckt(text: string): boolean {
  if (!text.includes('${')) {
    return false;
  }
  const probe = text.replace(/\$\{[^}]*\}/g, '¶');
  if (probe.includes('${') || probe.includes('{')) {
    return false;
  }
  return zeige(probe, 'en') !== probe;
}

function istOberflaeche(text: string): boolean {
  const sauber = text.replace(/\s+/g, ' ').trim();
  const kern = sauber.replace(/[.,:!?…–—-]/g, '').trim();
  if (sauber.length < 2 || ERLAUBT.has(sauber) || ERLAUBT.has(kern) || CODEWORT.test(sauber)) {
    return false;
  }
  if (!/^[A-Za-zÄÖÜäöüß]/.test(sauber)) {
    return false;
  }
  if (sauber.includes(',') || /:\s*\S/.test(sauber) || /\s\?\s/.test(sauber)) {
    return false;
  }
  if (/[^\p{L}\p{N}\s.,:!?…–—-]/u.test(sauber) || /\w\.\w/.test(sauber)) {
    return false;
  }
  if (!sauber.includes(' ') && /[a-zäöüß][A-ZÄÖÜ]/.test(sauber)) {
    return false;
  }
  return /[äöüÄÖÜß]/.test(sauber) || sauber.includes(' ') || /[:.!?]$/.test(sauber);
}

function sichtbareLiterale(): Map<string, string> {
  const fund = new Map<string, string>();
  const merke = (ort: string, text: string) => {
    const sauber = text.replace(/\s+/g, ' ').trim();
    if (sauber.length < 2 || ERLAUBT.has(sauber) || /^[+\d\s.×%−-]+$/.test(sauber)) {
      return;
    }
    if (sauber.includes('${')) {
      if (musterGedeckt(sauber) || !istOberflaeche(lesbar(sauber))) {
        return;
      }
    }
    if (!fund.has(sauber)) {
      fund.set(sauber, ort);
    }
  };
  for (const name of palettenNamen()) {
    merke('shared/features/darstellung/paletten.ts', name);
  }
  for (const label of stilLabel()) {
    merke('shared/features/darstellung/stile.ts', label);
  }
  const feld = /\b(?:text|label|titel|info|hinweis|beschreibung|frage):\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  const attribut = /\b(?:text|label|titel|title|info|hinweis|beschreibung|frage|placeholder|alt|aria-label)=(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  for (const datei of dateien(CLIENT)) {
    const quelle = ohneWurf(ohneKommentare(readFileSync(datei, 'utf8')));
    const ort = relativ(datei);
    const zeilen = quelle.split('\n');
    zeilen.forEach((zeile, index) => {
      const nummer = `${ort}:${index + 1}`;
      for (const treffer of zeile.matchAll(feld)) {
        merke(nummer, treffer[2] ?? '');
      }
      for (const treffer of zeile.matchAll(attribut)) {
        merke(nummer, treffer[2] ?? '');
      }
      const text = zeile.replace(/\{[^{}]*\}/g, ' ').replace(/<[^>]*>/g, ' ');
      if (istOberflaeche(text)) {
        merke(nummer, text);
      }
    });
    const ohneAufruf = quelle.replace(
      /\b(?:tx|zeige|AppFehler|TodoistFehler)\(\s*(?:\d+\s*,\s*)?(['"`])(?:\\.|(?!\1)[^\\])*\1/g,
      ' ',
    );
    const literale = [...ohneAufruf.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((treffer) => treffer[2] ?? '');
    literale.forEach((text, index) => {
      if (!/[äöüÄÖÜß]/.test(text) && !/[äöüÄÖÜß]/.test(lesbar(text))) {
        return;
      }
      merke(`${ort}:umlaut-${index + 1}`, text);
    });
  }
  return fund;
}

function fehltSchluessel(): string[] {
  const fehlend: string[] = [];
  for (const [text, ort] of sichtbareLiterale()) {
    if (!hatSchluessel(text)) {
      fehlend.push(`${ort} «${text}»`);
      continue;
    }
    for (const sprache of ZIEL_SPRACHEN) {
      const ziel = texteDer(sprache).get(text);
      if (!ziel) {
        fehlend.push(`${ort} ${sprache} «${text}»`);
      }
    }
  }
  return fehlend;
}

function zeileRoh(zeile: string, ausdruck: string): boolean {
  if (!zeile.includes(ausdruck) || /^\s*\/\//.test(zeile)) {
    return false;
  }
  let rest = zeile.replace(/key=\{(?:`[^`]*`|'[^']*'|"[^"]*"|[^{}]*)\}/g, '');
  const escaped = ausdruck.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const name of UEBERSETZER) {
    rest = rest.replace(new RegExp(`\\b${name}\\([^)]*\\b${escaped}\\b[^)]*\\)`, 'g'), '');
  }
  return rest.includes(ausdruck);
}

function hartcodiert(): string[] {
  const fund: string[] = [];
  const merke = (datei: string, zeile: number, text: string) => {
    fund.push(`${relativ(datei)}:${zeile} ${text.trim()}`);
  };
  for (const datei of dateien(CLIENT)) {
    const quelle = ohneKommentare(readFileSync(datei, 'utf8'));
    const name = relativ(datei);
    const palette = name.endsWith('MehrAnsicht.tsx');
    quelle.split('\n').forEach((zeile, index) => {
      const nummer = index + 1;
      if (zeileRoh(zeile, 'vorbild.name')) {
        merke(datei, nummer, zeile);
      }
      if (zeileRoh(zeile, 'anteil.name')) {
        merke(datei, nummer, zeile);
      }
      if (zeileRoh(zeile, 'stufe.name')) {
        merke(datei, nummer, zeile);
      }
      if (/\{aufstieg\.name\}/.test(zeile) && zeileRoh(zeile, 'aufstieg.name')) {
        merke(datei, nummer, zeile);
      }
      if (/titel:\s*erfolg\b/.test(zeile) && !/tx\(/.test(zeile)) {
        merke(datei, nummer, zeile);
      }
      if (palette && /\{vorlage\.name\}/.test(zeile) && !/key=/.test(zeile)) {
        merke(datei, nummer, zeile);
      }
      if (/ATTRIBUT_TYP_INFO\[[^\]]+\]\.label/.test(zeile) && !/tx\(/.test(zeile)) {
        merke(datei, nummer, zeile);
      }
      if (/name:\s*attribut\.name\b/.test(zeile) && !/tx\(|attributName\(/.test(zeile)) {
        merke(datei, nummer, zeile);
      }
      if (/namen\(punkt\.kennung\)|name:\s*name\(punkt\.kennung\)/.test(zeile) && !/attributName\(/.test(zeile)) {
        merke(datei, nummer, zeile);
      }
    });
  }
  return fund;
}

describe('sprachlücken', () => {
  it('findet fehlende Schlüssel in allen Zielsprachen', () => {
    expect(fehltSchluessel().sort()).toEqual([]);
  });

  it('findet deutsch gezeichnete Katalogtexte', () => {
    expect(hartcodiert().sort()).toEqual([]);
  });
});
