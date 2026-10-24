import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ATTRIBUT_KENNUNGEN } from './begriffe.ts';
import { DURCHSCHNITT, findeVorbild, RICHTUNGEN, VORBILDER } from '../features/vorbilder/vorbilder.ts';

interface RecherchePerson {
  richtung: string;
  name: string;
  werte: number[];
  unsicher: boolean[];
}

function recherchePersonen(): RecherchePerson[] {
  const datei = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'vorbilderRecherche.md');
  const abschnitte = fs.readFileSync(datei, 'utf8').split('\n### ').slice(1);
  const personen: RecherchePerson[] = [];
  for (const abschnitt of abschnitte) {
    const kopf = abschnitt.split('\n')[0]?.match(/^4\.\d+\s+(.+)$/);
    if (!kopf) {
      continue;
    }
    const richtung = kopf[1].replace(/\s+\(.*\)$/, '');
    const attribute = new Map<string, string[]>();
    const status = new Map<string, string[]>();
    let modus: 'attr' | 'status' | null = null;
    for (const zeile of abschnitt.split('\n')) {
      if (zeile.startsWith('| Name | Kö |')) {
        modus = 'attr';
        continue;
      }
      if (zeile.startsWith('| Name | Ei |')) {
        modus = 'status';
        continue;
      }
      if (!zeile.startsWith('|')) {
        if (modus) {
          modus = null;
        }
        continue;
      }
      if (zeile.includes('---')) {
        continue;
      }
      const felder = zeile.split('|').slice(1, -1).map((feld) => feld.trim());
      if (felder.length !== 11) {
        continue;
      }
      (modus === 'attr' ? attribute : status).set(felder[0], felder.slice(1));
    }
    for (const [name, werte] of attribute) {
      const rest = status.get(name);
      if (!rest) {
        throw new Error(`Status fehlt: ${name}`);
      }
      const roh = [...werte, ...rest];
      personen.push({
        richtung,
        name,
        werte: roh.map((wert) => Number(wert.replace('°', ''))),
        unsicher: roh.map((wert) => wert.endsWith('°')),
      });
    }
  }
  return personen;
}

function anzeigeName(name: string): string {
  return name === 'Mozart' ? 'Wolfgang Amadeus Mozart' : name;
}

describe('Lebensweg', () => {
  it('folgt den elf Richtungen und 76 Profilen aus der Recherche', () => {
    const recherche = recherchePersonen();
    expect(recherche).toHaveLength(76);
    expect(RICHTUNGEN).toEqual([
      'Körper',
      'Wettkampf',
      'Strategie',
      'Esports/Gaming',
      'Kunst',
      'Content/Creator',
      'Innovation/Technik',
      'Business/Unternehmertum',
      'Finanzen/Investing/Crypto',
      'Wissenschaft/Genies',
      'Führung/Wandel',
    ]);
    expect(findeVorbild('ronaldo')?.richtung).toBe('Wettkampf');
    expect(findeVorbild('mrbeast')?.richtung).toBe('Content/Creator');
    expect(findeVorbild('einstein')?.richtung).toBe('Wissenschaft/Genies');
    expect(findeVorbild('mandela')?.richtung).toBe('Führung/Wandel');
    expect(findeVorbild(DURCHSCHNITT)?.richtung).toBeNull();
    const erwartet = new Map<string, number>([
      ['Körper', 8],
      ['Wettkampf', 8],
      ['Strategie', 6],
      ['Esports/Gaming', 6],
      ['Kunst', 8],
      ['Content/Creator', 7],
      ['Innovation/Technik', 8],
      ['Business/Unternehmertum', 7],
      ['Finanzen/Investing/Crypto', 6],
      ['Wissenschaft/Genies', 6],
      ['Führung/Wandel', 6],
    ]);
    const zaehler = new Map<string, number>();
    for (const richtung of RICHTUNGEN) {
      zaehler.set(richtung, 0);
    }
    const personen = VORBILDER.filter((vorbild) => vorbild.schluessel !== DURCHSCHNITT);
    expect(personen).toHaveLength(76);
    const todesjahre = new Map<string, number>([
      ['lee', 1973],
      ['ali', 2016],
      ['mozart', 1791],
      ['jobs', 2011],
      ['davinci', 1519],
      ['newton', 1727],
      ['einstein', 1955],
      ['tesla', 1943],
      ['curie', 1934],
      ['hawking', 2018],
      ['aurelius', 180],
      ['gandhi', 1948],
      ['king', 1968],
      ['mandela', 2013],
    ]);
    let unsichere = 0;
    for (const eintrag of recherche) {
      const vorbild = personen.find((person) => person.name === anzeigeName(eintrag.name));
      expect(vorbild, eintrag.name).toBeTruthy();
      if (!vorbild) {
        continue;
      }
      expect(vorbild.richtung).toBe(eintrag.richtung);
      expect(ATTRIBUT_KENNUNGEN.map((kennung) => vorbild.schaetzung[kennung])).toEqual(eintrag.werte);
      expect(ATTRIBUT_KENNUNGEN.map((kennung) => vorbild.unsicher[kennung])).toEqual(eintrag.unsicher);
      unsichere += eintrag.unsicher.filter(Boolean).length;
    }
    expect(unsichere).toBe(284);
    for (const vorbild of personen) {
      expect(vorbild.richtung && RICHTUNGEN.includes(vorbild.richtung)).toBe(true);
      expect(vorbild.gestorben).toBe(todesjahre.get(vorbild.schluessel) ?? null);
      zaehler.set(vorbild.richtung ?? '', (zaehler.get(vorbild.richtung ?? '') ?? 0) + 1);
      const saetze = vorbild.beschreibung.split('.').filter((teil) => teil.trim().length > 0);
      expect(saetze, vorbild.name).toHaveLength(1);
      expect(vorbild.beschreibung).not.toMatch(/umstritten|polarisier|Impf|Tate|Union Square|Datenschutz|Achterbahn/i);
      for (const kennung of ATTRIBUT_KENNUNGEN) {
        if (!vorbild.unsicher[kennung]) {
          continue;
        }
        expect(vorbild.schaetzung[kennung]).toBeGreaterThanOrEqual(45);
        expect(vorbild.schaetzung[kennung]).toBeLessThanOrEqual(75);
      }
    }
    expect(zaehler).toEqual(erwartet);
    expect(findeVorbild(DURCHSCHNITT)?.unsicher.koerper).toBe(false);
  });
});
