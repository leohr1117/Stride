import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { changelogMarkdown } from './changelog.ts';
import { ABSCHNITTE, AKTUELLE_VERSION, VERSIONEN, type AbschnittTitel } from './versionen.ts';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('versionen', () => {
  it('ist absteigend nach Semantic Versioning und nennt Änderungen', () => {
    const paket = JSON.parse(readFileSync(join(WURZEL, 'package.json'), 'utf8')) as { version: string };
    expect(VERSIONEN.length).toBeGreaterThan(0);
    expect(AKTUELLE_VERSION).toBe('4.1.2');
    expect(AKTUELLE_VERSION).toBe(paket.version);
    expect(AKTUELLE_VERSION).toBe(VERSIONEN[0].version);
    const gesehen = new Set<string>();
    let vorher: number[] | null = null;
    for (const eintrag of VERSIONEN) {
      expect(eintrag.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(gesehen.has(eintrag.version)).toBe(false);
      gesehen.add(eintrag.version);
      expect(eintrag.seiten.trim()).toBe(eintrag.seiten);
      expect(eintrag.seiten.length).toBeGreaterThan(0);
      if (eintrag.behoben !== undefined) {
        expect(eintrag.behoben.trim()).toBe(eintrag.behoben);
        expect(eintrag.behoben.length).toBeGreaterThan(0);
      }
      expect(eintrag.abschnitte.length).toBeGreaterThan(0);
      const titel: AbschnittTitel[] = [];
      for (const abschnitt of eintrag.abschnitte) {
        expect(ABSCHNITTE).toContain(abschnitt.titel);
        expect(titel).not.toContain(abschnitt.titel);
        titel.push(abschnitt.titel);
        expect(abschnitt.punkte.length).toBeGreaterThan(0);
        for (const text of abschnitt.punkte) {
          expect(text.trim()).toBe(text);
          expect(text).not.toMatch(/SemVer|Migration|Schema|zählen ab 0|Interna/i);
        }
      }
      const geordnet = [...titel].sort((links, rechts) => ABSCHNITTE.indexOf(links) - ABSCHNITTE.indexOf(rechts));
      expect(titel).toEqual(geordnet);
      const teile = eintrag.version.split('.').map(Number);
      if (vorher) {
        const kleiner =
          teile[0] < vorher[0] ||
          (teile[0] === vorher[0] && teile[1] < vorher[1]) ||
          (teile[0] === vorher[0] && teile[1] === vorher[1] && teile[2] < vorher[2]);
        expect(kleiner).toBe(true);
      }
      vorher = teile;
    }
  });

  it('schreibt das deutsche Änderungsprotokoll aus den Einträgen', () => {
    const datei = readFileSync(join(WURZEL, 'CHANGELOG.md'), 'utf8');
    expect(datei).toBe(changelogMarkdown(VERSIONEN));
    expect(datei).not.toMatch(/\b[A-Z]\d+[a-z]?\b/);
  });
});
