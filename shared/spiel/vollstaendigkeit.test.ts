import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WURZEL = join(import.meta.dirname, '../..');

const WEG = [
  'client/src/components/ZurueckZumMehr.tsx',
  'client/src/components/EbenenWahl.tsx',
  'client/src/features/handbuch/SchutzKarte.tsx',
  'client/src/features/handbuch/AufgabenKarte.tsx',
  'client/src/features/handbuch/TrainingKarte.tsx',
  'client/src/features/todoist/ProjektZeile.tsx',
  'client/src/features/todoist/LabelZeile.tsx',
  'client/src/api/aufgaben.ts',
  'client/src/api/training.ts',
  'client/src/features/aufgaben/index.ts',
  'client/src/features/aufgaben/Aufgaben.tsx',
  'client/src/features/aufgaben/AufgabenDialog.tsx',
  'client/src/features/aufgaben/AufgabenSchnell.tsx',
  'client/src/features/aufgaben/AufgabenSeite.tsx',
  'client/src/features/aufgaben/AufgabenWeiteres.tsx',
  'client/src/features/aufgaben/schnellStand.ts',
  'client/src/features/training/index.ts',
  'client/src/features/training/TrainingSeite.tsx',
  'client/src/features/training/UebungSeite.tsx',
  'client/src/features/training/EinheitSeite.tsx',
  'client/src/features/training/EinheitAnsicht.tsx',
  'client/src/features/training/HeuteZeile.tsx',
  'client/src/features/training/PlanEditor.tsx',
  'client/src/features/training/PlanEintrag.tsx',
  'client/src/features/training/PlanKarte.tsx',
  'client/src/features/training/PlanZuordnung.tsx',
  'client/src/features/training/kapsel.tsx',
  'client/src/features/training/planStand.ts',
  'client/src/features/training/satzAnzeige.ts',
  'client/src/features/training/bestwertAnzeige.ts',
  'client/src/features/training/zieltext.ts',
  'e2e/aufgaben.spec.ts',
  'e2e/aufgaben-weiteres.spec.ts',
  'e2e/aufgaben-schnell.spec.ts',
  'e2e/aufgaben-prioritaet.spec.ts',
  'e2e/aufgaben-naechstes.spec.ts',
  'e2e/aufgabenHelfer.ts',
  'e2e/training.spec.ts',
  'e2e/training-heute.spec.ts',
  'e2e/training-einheit.spec.ts',
  'e2e/training-diagramm.spec.ts',
  'e2e/training-demnaechst.spec.ts',
  'e2e/trainingHelfer.ts',
];

const SYMBOLE = [
  'empfohleneFunktionen',
  'ZurueckZumMehr',
  'EbenenWahl',
  'HinweisKarte',
  'todoistVorschau',
  'XpVorschau',
  'INFO_PROJEKTE',
  'SchutzKarte',
];

const UMWEGE = [
  'aufgaben',
  'training',
  'training/*',
  'mehr/profil/benutzernamen/:kontoId',
  'mehr/profil/benutzernamen',
  'mehr/konto',
  'mehr/accounts',
  'mehr/leiste',
  'mehr/taetigkeiten',
  'mehr/sonstiges',
  'demnaechst',
  'verbindungen',
];

const SEITEN = ['koennen', 'haben', 'faehigkeiten', 'investitionen'];

function dateien(ordner: string): string[] {
  const ergebnis: string[] = [];
  for (const name of readdirSync(ordner, { withFileTypes: true })) {
    const pfad = join(ordner, name.name);
    if (name.isDirectory()) {
      if (name.name === 'node_modules' || name.name === 'weitere') {
        continue;
      }
      ergebnis.push(...dateien(pfad));
    } else if (/\.tsx?$/.test(name.name) && !name.name.endsWith('vollstaendigkeit.test.ts')) {
      ergebnis.push(pfad);
    }
  }
  return ergebnis;
}

describe('entfallene Reste', () => {
  it('lässt die gestrichenen Dateien weg und behält die Umleitungen', () => {
    const nochDa = WEG.filter((pfad) => existsSync(join(WURZEL, pfad)));
    expect(nochDa).toEqual([]);
    const app = readFileSync(join(WURZEL, 'client/src/App.tsx'), 'utf8');
    for (const pfad of UMWEGE) {
      expect(app, pfad).toContain(`path: '${pfad}'`);
    }
    for (const pfad of SEITEN) {
      expect(app, pfad).toContain(`path: '${pfad}'`);
    }
    const ziele = readFileSync(join(WURZEL, 'client/src/features/ziele/Ziele.tsx'), 'utf8');
    const wahl = readFileSync(join(WURZEL, 'client/src/components/HierarchieWahl.tsx'), 'utf8');
    expect(ziele).not.toContain('border-s-2');
    expect(wahl).not.toContain('border-s-2');
  });

  it('nennt die gestrichenen Bausteine im Quelltext nicht mehr', () => {
    const treffer: string[] = [];
    for (const ordner of ['client/src', 'shared', 'e2e']) {
      for (const datei of dateien(join(WURZEL, ordner))) {
        const text = readFileSync(datei, 'utf8');
        for (const symbol of SYMBOLE) {
          if (text.includes(symbol)) {
            treffer.push(`${datei.slice(WURZEL.length + 1)} ${symbol}`);
          }
        }
      }
    }
    expect(treffer).toEqual([]);
  });
});
