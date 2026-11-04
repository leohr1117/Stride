import { describe, expect, it } from 'vitest';
import { helligkeit, kontrast, MINDEST_KONTRAST } from '../../spiel/farben.ts';
import { fuellToene, FUELL_KONTRAST, spitzeTon } from './balkenAbschluss.ts';
import { bedeutungsfarben } from './bedeutung.ts';
import { flaecheHebtSich, wacheKontrast, type GewachteFarben } from './kontrastWaechter.ts';
import { erscheinungAus, standardVorlage, vorlagen, type Erscheinung } from './paletten.ts';
import { STILE } from './stile.ts';

const UI = 3;

function flaechenVon(bild: Erscheinung, wache?: GewachteFarben): string[] {
  return [bild.hintergrund, wache?.flaeche ?? bild.flaechen.flaeche, wache?.flaeche2 ?? bild.flaechen.flaeche2];
}

function farbton(hex: string): number {
  const roh = hex.replace('#', '');
  const rot = Number.parseInt(roh.slice(0, 2), 16) / 255;
  const gruen = Number.parseInt(roh.slice(2, 4), 16) / 255;
  const blau = Number.parseInt(roh.slice(4, 6), 16) / 255;
  const max = Math.max(rot, gruen, blau);
  const min = Math.min(rot, gruen, blau);
  const spanne = max - min;
  if (spanne === 0) {
    return 0;
  }
  let h = 0;
  if (max === rot) {
    h = ((gruen - blau) / spanne) % 6;
  } else if (max === gruen) {
    h = (blau - rot) / spanne + 2;
  } else {
    h = (rot - gruen) / spanne + 4;
  }
  h *= 60;
  return h < 0 ? h + 360 : h;
}

function tonAbstand(a: string, b: string): number {
  const delta = Math.abs(farbton(a) - farbton(b));
  return Math.min(delta, 360 - delta);
}

function bunt(hex: string): boolean {
  const roh = hex.replace('#', '');
  const werte = [0, 2, 4].map((start) => Number.parseInt(roh.slice(start, start + 2), 16));
  return Math.max(...werte) - Math.min(...werte) >= 24;
}

function pruefePaare(bild: Erscheinung, wache: GewachteFarben): void {
  const flaechen = flaechenVon(bild, wache);
  for (const farbe of [wache.haupt, wache.leise, wache.gefahr, wache.streak, wache.fortschritt]) {
    for (const hintergrund of flaechen) {
      expect(kontrast(farbe, hintergrund)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
    }
  }
  expect(kontrast(wache.schalterKnopfAn, wache.schalterAn)).toBeGreaterThanOrEqual(UI);
  expect(kontrast(wache.schalterAn, wache.flaeche)).toBeGreaterThanOrEqual(UI);
  expect(kontrast(wache.schalterKnopfAus, wache.schalterAus)).toBeGreaterThanOrEqual(UI);
  expect(kontrast(wache.feldrand, wache.flaeche)).toBeGreaterThanOrEqual(UI);
  expect(kontrast(wache.fortschritt, wache.flaeche2)).toBeGreaterThanOrEqual(UI);
  expect(kontrast(wache.fokus, bild.hintergrund)).toBeGreaterThanOrEqual(UI);
  expect(kontrast(wache.aktionText, wache.aktion)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
}

describe('Kontrastwächter', () => {
  it('lässt die festen Bedeutungsfarben auf allen 15 Paletten unverändert', () => {
    let anzahl = 0;
    for (const stil of STILE) {
      for (const vorlage of vorlagen(stil)) {
        anzahl += 1;
        const bild = erscheinungAus(vorlage);
        const fest = bedeutungsfarben(bild.flaechen.schema);
        const wache = wacheKontrast(bild, fest);
        expect(wache.streak, vorlage.name).toBe(fest.streak);
        expect(wache.fortschritt, vorlage.name).toBe(fest.fortschritt);
        expect(wache.gefahr, vorlage.name).toBe(fest.gefahr);
        expect(wache.fokus, vorlage.name).toBe(fest.fokus);
        expect(wache.schalterAn, vorlage.name).toBe(fest.schalterAn);
        expect(wache.schalterKnopfAn, vorlage.name).toBe(fest.schalterKnopfAn);
        expect(wache.schalterKnopfAus, vorlage.name).toBe(fest.schalterKnopfAus);
        expect(wache.feldrand, vorlage.name).toBe('#767676');
        expect(wache.haupt, vorlage.name).toBe(bild.flaechen.haupt);
        const leiseRoh = flaechenVon(bild, wache).every((hintergrund) => kontrast(bild.flaechen.leise, hintergrund) >= MINDEST_KONTRAST);
        if (leiseRoh) {
          expect(wache.leise, vorlage.name).toBe(bild.flaechen.leise);
        } else {
          expect(wache.leise, vorlage.name).not.toBe(bild.flaechen.leise);
        }
        expect(wache.aktionText, vorlage.name).toBe(bild.text);
        pruefePaare(bild, wache);
      }
    }
    expect(anzahl).toBe(15);
    const nebel = vorlagen('standard').find((vorlage) => vorlage.name === 'Nebel');
    expect(nebel).toBeDefined();
    if (nebel) {
      const bild = erscheinungAus(nebel);
      const roh = flaechenVon(bild, wacheKontrast(bild, bedeutungsfarben(bild.flaechen.schema))).every(
        (hintergrund) => kontrast(bild.flaechen.leise, hintergrund) >= MINDEST_KONTRAST,
      );
      expect(roh).toBe(false);
    }
  });

  it('hält Text, Schalter und Ring bei fast weißen eigenen Farben', () => {
    const hell = erscheinungAus({ primaer: '#f4f4f4', akzent: '#fbfbfb', hintergrund: '#fefefe' });
    const wacheHell = wacheKontrast(hell, bedeutungsfarben(hell.flaechen.schema));
    pruefePaare(hell, wacheHell);
    expect(kontrast(wacheHell.fortschritt, hell.flaechen.flaeche2)).toBeGreaterThanOrEqual(UI);
    expect(kontrast(wacheHell.haupt, hell.flaechen.flaeche)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);

    const akzent = erscheinungAus({ primaer: '#141414', akzent: '#f8f8f8', hintergrund: '#141414' });
    const wacheAkzent = wacheKontrast(akzent, bedeutungsfarben(akzent.flaechen.schema));
    pruefePaare(akzent, wacheAkzent);
    expect(wacheAkzent.streak).toBe('#fb923c');
    expect(wacheAkzent.fortschritt).toBe('#60a5fa');
  });

  it('zieht eine verfehlte Bedeutungsfarbe nach und behält Orange', () => {
    const bild = erscheinungAus({ primaer: '#3355ff', akzent: '#cc8800', hintergrund: '#808080' });
    const fest = bedeutungsfarben(bild.flaechen.schema);
    const roh = flaechenVon(bild).every((hintergrund) => kontrast(fest.streak, hintergrund) >= MINDEST_KONTRAST);
    expect(roh).toBe(false);
    const wache = wacheKontrast(bild, fest);
    pruefePaare(bild, wache);
    expect(wache.streak).not.toBe(fest.streak);
    expect(tonAbstand(wache.streak, fest.streak)).toBeLessThanOrEqual(20);
    expect(bunt(wache.streak)).toBe(true);
    expect(tonAbstand(wache.fortschritt, fest.fortschritt)).toBeLessThanOrEqual(20);
    expect(bunt(wache.fortschritt)).toBe(true);
  });

  it('hält hellsten und dunkelsten Füllton gegen den Track, in hellen Ansichten auch die Spitze', () => {
    const bilder: Erscheinung[] = [];
    for (const stil of STILE) {
      for (const vorlage of vorlagen(stil)) {
        bilder.push(erscheinungAus(vorlage));
      }
    }
    bilder.push(erscheinungAus({ primaer: '#3355ff', akzent: '#cc8800', hintergrund: '#f7f4ee' }));
    bilder.push(erscheinungAus({ primaer: '#141414', akzent: '#f8f8f8', hintergrund: '#10141c' }));
    expect(bilder.length).toBeGreaterThanOrEqual(17);
    for (const bild of bilder) {
      const schema = bild.flaechen.schema;
      const track = bild.flaechen.flaeche2;
      const fest = bedeutungsfarben(schema);
      const wache = wacheKontrast(bild, fest);
      for (const farbe of [wache.fortschritt, wache.gefahr]) {
        const toene = fuellToene(farbe);
        const ort = `${schema} ${farbe} auf ${track}`;
        expect(kontrast(toene.hell, track), `hell ${ort}`).toBeGreaterThanOrEqual(FUELL_KONTRAST);
        expect(kontrast(toene.dunkel, track), `dunkel ${ort}`).toBeGreaterThanOrEqual(FUELL_KONTRAST);
        if (schema === 'light') {
          expect(kontrast(spitzeTon(farbe, schema), track), `spitze ${ort}`).toBeGreaterThanOrEqual(FUELL_KONTRAST);
          expect(helligkeit(spitzeTon(farbe, schema)), ort).toBeLessThan(helligkeit(farbe));
        } else {
          expect(helligkeit(spitzeTon(farbe, schema)), ort).toBeGreaterThan(helligkeit(farbe));
        }
        expect(helligkeit(toene.hell), ort).toBeGreaterThan(helligkeit(toene.dunkel));
      }
    }
  });

  it('hebt die Fläche in jeder Ansicht und Palette vom Grund ab', () => {
    for (const stil of STILE) {
      for (const vorlage of vorlagen(stil)) {
        const bild = erscheinungAus(vorlage);
        const wache = wacheKontrast(bild, bedeutungsfarben(bild.flaechen.schema));
        const name = `${stil} ${vorlage.name}`;
        const minimalHell = stil === 'minimal' && vorlage.name === 'Hell';
        if (minimalHell) {
          expect(wache.flaeche, name).toBe('#ffffff');
          expect(kontrast(bild.primaer, '#fefefe'), name).toBeLessThan(MINDEST_KONTRAST);
        } else {
          expect(flaecheHebtSich(wache.flaeche, bild.hintergrund), name).toBe(true);
        }
        for (const grund of [wache.flaeche, wache.flaeche2]) {
          expect(kontrast(wache.haupt, grund), `${name} Text`).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
          expect(kontrast(wache.leise, grund), `${name} Leise`).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
        }
      }
    }
    const hell = erscheinungAus(standardVorlage('standard', false));
    expect(hell.flaechen.flaeche).toBe('#ffffff');
    expect(hell.flaechen.flaeche2).toBe('#ebebeb');
    const dunkel = wacheKontrast(erscheinungAus(standardVorlage('standard', true)), bedeutungsfarben('dark'));
    expect(dunkel.flaeche).toBe('#202020');
    expect(dunkel.flaeche2).toBe('#2a2a2a');
    const eigene = [
      { primaer: '#3355ff', akzent: '#cc8800', hintergrund: '#fefefe' },
      { primaer: '#3355ff', akzent: '#cc8800', hintergrund: '#010203' },
      { primaer: '#f4f4f4', akzent: '#fbfbfb', hintergrund: '#fefefe' },
    ];
    for (const trio of eigene) {
      const bild = erscheinungAus(trio);
      const wache = wacheKontrast(bild, bedeutungsfarben(bild.flaechen.schema));
      expect(flaecheHebtSich(wache.flaeche, bild.hintergrund), trio.hintergrund).toBe(true);
      for (const grund of [wache.flaeche, wache.flaeche2]) {
        expect(kontrast(wache.haupt, grund), `${trio.hintergrund} Text`).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
        expect(kontrast(wache.leise, grund), `${trio.hintergrund} Leise`).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
      }
      for (const farbe of [wache.fortschritt, wache.gefahr]) {
        const toene = fuellToene(farbe);
        expect(kontrast(toene.hell, wache.flaeche2), trio.hintergrund).toBeGreaterThanOrEqual(FUELL_KONTRAST);
        expect(kontrast(toene.dunkel, wache.flaeche2), trio.hintergrund).toBeGreaterThanOrEqual(FUELL_KONTRAST);
      }
    }
  });
});
