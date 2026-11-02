import { describe, expect, it } from 'vitest';
import { kontrast, MINDEST_KONTRAST } from '../../spiel/farben.ts';
import { bedeutungsfarben } from './bedeutung.ts';
import { wacheKontrast } from './kontrastWaechter.ts';
import { kombination } from './kombination.ts';
import { erscheinungAus, vorlagen } from './paletten.ts';
import { STILE, type Stil } from './stile.ts';

const RAHMEN = 3;
const TEXT_ANSICHTEN: ReadonlySet<Stil> = new Set(['jade', 'holo', 'antik']);

describe('Palettenkombination', () => {
  it('hält Text, Rahmen und Symbole in jeder Ansicht und lässt Ring und Fehler fest', () => {
    let anzahl = 0;
    for (const ansicht of STILE) {
      for (const quelle of STILE) {
        for (const vorlage of vorlagen(quelle)) {
          anzahl += 1;
          const bild = erscheinungAus(vorlage);
          const fest = bedeutungsfarben(bild.flaechen.schema);
          const wache = wacheKontrast(bild, fest);
          const farben = kombination(bild, ansicht);
          const flaechen = [bild.hintergrund, bild.flaechen.flaeche, bild.flaechen.flaeche2];
          const name = `${ansicht} ${quelle} ${vorlage.name}`;
          for (const text of [farben.haupt, farben.leise]) {
            for (const grund of flaechen) {
              expect(kontrast(text, grund), `${name} Text`).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
            }
          }
          if (TEXT_ANSICHTEN.has(ansicht)) {
            for (const grund of flaechen) {
              expect(kontrast(farben.akzentSchrift, grund), `${name} Akzentschrift`).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
            }
            expect(kontrast(farben.rahmen, bild.flaechen.flaeche), `${name} Rahmen`).toBeGreaterThanOrEqual(RAHMEN);
            expect(kontrast(farben.rahmen, bild.hintergrund), `${name} Rahmen Grund`).toBeGreaterThanOrEqual(RAHMEN);
          } else {
            expect(farben.akzentSchrift, name).toBe(bild.primaer);
            expect(farben.rahmen, name).toBe(wache.feldrand);
          }
          for (const grund of flaechen) {
            expect(kontrast(farben.symbol, grund), `${name} Symbol`).toBeGreaterThanOrEqual(RAHMEN);
          }
          expect(kontrast(farben.aktionText, bild.primaer), `${name} Knopf`).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
          expect(farben.fortschritt, name).toBe(fest.fortschritt);
          expect(farben.gefahr, name).toBe(fest.gefahr);
          const schriftHaelt = flaechen.every((grund) => kontrast(bild.primaer, grund) >= MINDEST_KONTRAST);
          if (schriftHaelt) {
            expect(farben.akzentSchrift, name).toBe(bild.primaer);
          }
        }
      }
    }
    expect(anzahl).toBe(75);
  });
});
