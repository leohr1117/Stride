import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOSS_DATUM_INFO, BOSS_SCHALTER, INVESTITION_INFO, MEILENSTEIN_INFO } from '../../../shared/spiel/xp.ts';
import { INFO_LABELS } from '../features/todoist/Zuordnungen.tsx';
import { HINWEIS_MEILENSTEIN } from '../features/todoist/gemeinsam.ts';
import { WERTE_HINWEIS } from '../features/vorbilder/vorbildTeile.tsx';

const WURZEL = join(import.meta.dirname, '../../..');

const ERLAUBT = new Set([
  'Ein Tag Pause ist frei. Danach ist der Streak angeschlagen.',
  'Ein Eintrag in sieben Tagen, ohne Abzug.',
  'Trag heute etwas ein, damit der Streak bleibt.',
  'Gestern war dein freier Tag.',
  'Einmalig Bonus-XP nach den Einträgen im Projekt. Wieder öffnen gibt den Bonus nicht noch einmal.',
  INVESTITION_INFO,
  BOSS_DATUM_INFO,
  MEILENSTEIN_INFO,
  WERTE_HINWEIS,
  'Tägliche Aufgaben zum Abhaken.',
  BOSS_SCHALTER,
  'Ungenutzte Attribute verlieren XP. Wie stark, stellst du pro Attribut ein.',
  'Gilt für die Oberfläche. Namen und Einträge bleiben, wie du sie geschrieben hast.',
  'Primär: Knöpfe. Akzent: Hervorhebungen. Hintergrund: Fläche. Streak, Ring und Schalter haben feste Farben.',
  'Die Palette dieser Ansicht, danach die anderen.',
  'Beim Öffnen und alle 15 Minuten, nachts alle 3 Stunden.',
  INFO_LABELS,
  HINWEIS_MEILENSTEIN,
  'Beim Öffnen und alle 15 Minuten.',
  'Die XP richtet sich nach der Dauer des Termins.',
]);

const KONSTANTEN: Record<string, string> = {
  BOSS_DATUM_INFO,
  BOSS_SCHALTER,
  INVESTITION_INFO,
  MEILENSTEIN_INFO,
  WERTE_HINWEIS,
  INFO_LABELS,
  HINWEIS_MEILENSTEIN,
};

const DURCHREICHEN = new Set(['info', 'angabe.info']);

function dateien(ordner: string): string[] {
  const ergebnis: string[] = [];
  for (const name of readdirSync(ordner, { withFileTypes: true })) {
    const pfad = join(ordner, name.name);
    if (name.isDirectory()) {
      ergebnis.push(...dateien(pfad));
    } else if (/\.tsx?$/.test(name.name) && !name.name.endsWith('.test.ts')) {
      ergebnis.push(pfad);
    }
  }
  return ergebnis;
}

function relativ(pfad: string): string {
  return pfad.slice(WURZEL.length + 1).replaceAll('\\', '/');
}

function lokaleKonstante(quelle: string, name: string): string | null {
  const einfach = quelle.match(new RegExp(`const ${name} = '([^']*)'`));
  if (einfach?.[1]) {
    return einfach[1];
  }
  const doppelt = quelle.match(new RegExp(`const ${name} = "([^"]*)"`));
  return doppelt?.[1] ?? null;
}

function ernteWeitergabe(quelle: string, texte: Set<string>): void {
  for (const treffer of quelle.matchAll(/\binfo=\{tx\('([^']+)'\)/g)) {
    texte.add(treffer[1] ?? '');
  }
  for (const treffer of quelle.matchAll(/\b(?:info=\{|info:\s*)([A-Z][A-Z0-9_]*)/g)) {
    const name = treffer[1] ?? '';
    const wert = KONSTANTEN[name] ?? lokaleKonstante(quelle, name);
    if (wert) {
      texte.add(wert);
    }
  }
  const koerper = quelle.match(/const FUNKTION_INFO\b[\s\S]*?=\s*\{([\s\S]*?)\n\};/);
  if (!koerper?.[1]) {
    return;
  }
  for (const satz of koerper[1].matchAll(/'([^']+)'/g)) {
    texte.add(satz[1] ?? '');
  }
  for (const name of koerper[1].matchAll(/\b([A-Z][A-Z0-9_]*)\b/g)) {
    const wert = KONSTANTEN[name[1] ?? ''] ?? lokaleKonstante(quelle, name[1] ?? '');
    if (wert) {
      texte.add(wert);
    }
  }
}

function hinweisBloecke(quelle: string): string[] {
  return [...quelle.matchAll(/<InfoHinweis\b[\s\S]*?(?:\/>|>)/g)].map((treffer) => treffer[0]);
}

describe('Hinweistexte', () => {
  it('nennt genau die vorgesehenen Sätze und einen Namen', () => {
    const texte = new Set<string>();
    const ohneNamen: string[] = [];
    for (const datei of dateien(join(WURZEL, 'client/src'))) {
      const quelle = readFileSync(datei, 'utf8');
      ernteWeitergabe(quelle, texte);
      if (!quelle.includes('InfoHinweis')) {
        continue;
      }
      for (const block of hinweisBloecke(quelle)) {
        if (!/\b(?:name|label)=/.test(block)) {
          ohneNamen.push(`${relativ(datei)}: ${block.slice(0, 80)}`);
        }
        const literal = block.match(/\btext="([^"]+)"/);
        if (literal?.[1]) {
          texte.add(literal[1]);
          continue;
        }
        const aufruf = block.match(/\btext=\{(?:tx\()?"([^"]+)"/);
        if (aufruf?.[1]) {
          texte.add(aufruf[1]);
          continue;
        }
        const name = block.match(/\btext=\{([A-Za-z0-9_.]+)/);
        const konstant = name?.[1];
        if (!konstant || DURCHREICHEN.has(konstant)) {
          continue;
        }
        const wert = KONSTANTEN[konstant];
        expect(wert, konstant).toBeTruthy();
        texte.add(wert ?? '');
      }
    }
    expect(ohneNamen).toEqual([]);
    expect([...texte].sort()).toEqual([...ERLAUBT].sort());
  });

  it('lässt keinen Ortstext im laufenden Code', () => {
    const verboten = ['Auf dem Charakter', 'Auf dem Profil', 'liegt unter'];
    const fund: string[] = [];
    const wurzeln = ['client/src', 'shared/spiel', 'shared/features', 'shared/sprache/paare'].map((pfad) =>
      join(WURZEL, pfad),
    );
    for (const wurzel of wurzeln) {
      for (const datei of dateien(wurzel)) {
        if (relativ(datei).endsWith('versionen.ts')) {
          continue;
        }
        const quelle = readFileSync(datei, 'utf8');
        for (const satz of verboten) {
          if (quelle.includes(satz)) {
            fund.push(`${relativ(datei)}: ${satz}`);
          }
        }
      }
    }
    expect(fund).toEqual([]);
  });
});
