import { describe, expect, it } from 'vitest';
import { kontrast, MINDEST_KONTRAST } from './farben.ts';
import { erscheinungAus, palettenNachDesign, standardVorlage, vorlagen, type Farbtrio } from '../features/darstellung/paletten.ts';
import { STANDARD_STIL, STILE } from '../features/darstellung/stile.ts';

function gleichesTrio(a: Farbtrio, b: Farbtrio): boolean {
  return a.primaer === b.primaer && a.akzent === b.akzent && a.hintergrund === b.hintergrund;
}

describe('paletten', () => {
  it('gibt jeder Ansicht mehrere eigene Vorlagen', () => {
    for (const stil of STILE) {
      const liste = vorlagen(stil);
      expect(liste.length).toBeGreaterThanOrEqual(3);
      expect(new Set(liste.map((vorlage) => vorlage.name)).size).toBe(liste.length);
      expect(new Set(liste.map((vorlage) => vorlage.hintergrund)).size).toBe(liste.length);
    }
  });

  it('nimmt für Schlicht und Minimal das System und für die anderen Ansichten ihre dunkle Vorlage', () => {
    expect(STANDARD_STIL).toBe('schlicht');
    const hell = standardVorlage('schlicht', false);
    const dunkel = standardVorlage('schlicht', true);
    expect(hell.name).toBe('Hell');
    expect(hell.primaer).toBe('#141414');
    expect(hell.akzent).toBe('#707070');
    expect(hell.hintergrund).toBe('#f2f2f2');
    expect(dunkel.name).toBe('Dunkel');
    expect(dunkel.primaer).toBe('#f2f2f2');
    expect(dunkel.hintergrund).toBe('#141414');
    expect(dunkel.akzent).not.toBe('#707070');
    expect(dunkel.flaechen.rand).not.toBe('#707070');
    expect(kontrast('#707070', dunkel.hintergrund)).toBeLessThan(MINDEST_KONTRAST);
    expect(kontrast(dunkel.akzent, dunkel.flaechen.flaeche)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
    expect(standardVorlage('minimal', false).name).toBe('Hell');
    expect(standardVorlage('minimal', true).name).toBe('Dunkel');
    expect(standardVorlage('jade', false).primaer).toBe('#3dd68c');
    expect(standardVorlage('jade', true).hintergrund).toBe('#0c0d0f');
    expect(standardVorlage('holo', false).hintergrund).toBe('#050914');
    expect(standardVorlage('antik', true).hintergrund).toBe('#0d0c0a');
  });

  it('behält die historischen Standardfarben und den Stahlton von Antik', () => {
    const hell = erscheinungAus(standardVorlage('minimal', false));
    expect(hell.primaer).toBe('#6d5efc');
    expect(hell.akzent).toBe('#d99a16');
    expect(hell.flaechen.flaeche).toBe('#ffffff');
    expect(hell.text).toBe('#ffffff');

    const dunkel = erscheinungAus(standardVorlage('minimal', true));
    expect(dunkel.primaer).toBe('#8b7dff');
    expect(dunkel.akzent).toBe('#f5b942');
    expect(dunkel.flaechen.flaeche).toBe('#16161c');

    const jade = erscheinungAus(standardVorlage('jade', true));
    expect(jade.flaechen.flaeche).toBe('#141518');
    expect(jade.flaechen.diagramm).toBe('#c4b5fd');

    const holo = erscheinungAus(standardVorlage('holo', true));
    expect(holo.hintergrund).toBe('#050914');
    expect(holo.flaechen.flaeche).toBe('#0a1224');

    const antik = erscheinungAus(standardVorlage('antik', true));
    expect(antik.primaer).toBe('#d6c79c');
    expect(antik.akzent).toBe('#c9a24d');
    expect(antik.flaechen.diagramm).toBe('#8fa8bf');
    expect(antik.flaechen.haupt).toBe('#ece6d6');
  });

  it('hält Schrift, Knöpfe und Flächen der Vorlagen lesbar', () => {
    for (const stil of STILE) {
      for (const vorlage of vorlagen(stil)) {
        const bild = erscheinungAus(vorlage);
        expect(kontrast(bild.text, bild.primaer)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
        expect(kontrast(bild.flaechen.haupt, bild.flaechen.flaeche)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
        expect(kontrast(bild.flaechen.leise, bild.flaechen.flaeche)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
      }
    }
  });

  it('korrigiert freie Farben und leitet unbekannte Hintergründe ab', () => {
    const frei = erscheinungAus({ primaer: '#ffff00', akzent: '#ffffff', hintergrund: '#f4f1ea' });
    expect(kontrast(frei.primaer, frei.hintergrund)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
    expect(kontrast(frei.primaer, frei.flaechen.flaeche)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
    expect(kontrast(frei.akzent, frei.flaechen.flaeche)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
    expect(kontrast(frei.text, frei.primaer)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
    expect(kontrast(frei.flaechen.haupt, frei.flaechen.flaeche)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
    expect(frei.primaer).not.toBe('#ffff00');

    const grau = erscheinungAus({ primaer: '#3355ff', akzent: '#cc8800', hintergrund: '#808080' });
    expect(kontrast(grau.flaechen.haupt, grau.flaechen.flaeche)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
    expect(kontrast(grau.flaechen.haupt, grau.hintergrund)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
  });

  it('bietet bei jedem Design die Paletten der anderen und behält die eigene als Standard', () => {
    const trios = new Set<string>();
    for (const aktiv of STILE) {
      const gruppen = palettenNachDesign(aktiv);
      expect(gruppen.map((gruppe) => gruppe.stil)).toEqual([aktiv, ...STILE.filter((stil) => stil !== aktiv)]);
      expect(gruppen.map((gruppe) => gruppe.label)).toEqual(gruppen.map((gruppe) => gruppe.label.trim()));
      for (const dunkel of [false, true]) {
        const standard = standardVorlage(aktiv, dunkel);
        expect(vorlagen(aktiv).some((vorlage) => gleichesTrio(vorlage, standard))).toBe(true);
      }
      for (const gruppe of gruppen) {
        expect(gruppe.vorlagen.length).toBeGreaterThan(0);
        for (const vorlage of gruppe.vorlagen) {
          trios.add(`${vorlage.primaer}|${vorlage.akzent}|${vorlage.hintergrund}`);
          const bild = erscheinungAus(vorlage);
          expect(bild.primaer).toBe(vorlage.primaer);
          expect(bild.akzent).toBe(vorlage.akzent);
          expect(bild.hintergrund).toBe(vorlage.hintergrund);
          expect(bild.flaechen).toEqual(vorlage.flaechen);
          expect(kontrast(bild.text, bild.primaer), `${aktiv} ${gruppe.label} ${vorlage.name} Knopf`).toBeGreaterThanOrEqual(
            MINDEST_KONTRAST,
          );
          expect(kontrast(bild.flaechen.haupt, bild.flaechen.flaeche), `${vorlage.name} Text`).toBeGreaterThanOrEqual(
            MINDEST_KONTRAST,
          );
          expect(kontrast(bild.flaechen.haupt, bild.hintergrund), `${vorlage.name} Grund`).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
          expect(kontrast(bild.flaechen.leise, bild.flaechen.flaeche), `${vorlage.name} Leise`).toBeGreaterThanOrEqual(
            MINDEST_KONTRAST,
          );
          expect(kontrast(bild.primaer, bild.flaechen.flaeche), `${vorlage.name} Akzent`).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
        }
      }
    }
    expect(trios.size).toBe([...STILE].reduce((summe, stil) => summe + vorlagen(stil).length, 0));
  });

  it('nutzt bei bekanntem Hintergrund die Flächen der Ansicht und folgt mit dem Diagramm dem Akzent', () => {
    const geaendert = erscheinungAus({ primaer: '#3dd68c', akzent: '#f0d48a', hintergrund: '#0c0d0f' });
    expect(geaendert.flaechen.flaeche).toBe('#141518');
    expect(geaendert.flaechen.diagramm).toBe(geaendert.akzent);
    expect(geaendert.flaechen.diagramm).not.toBe('#8fa8bf');
  });
});
