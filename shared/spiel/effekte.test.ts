import { describe, expect, it } from 'vitest';
import {
  effektDarfFedern,
  effektDarfSichBewegen,
  effektStufe,
  groessterEffekt,
  groesstesFeierZiel,
  ketteDarfSichBewegen,
  ketteMoment,
  ketteMomentGroesse,
  levelAbstieg,
  levelAbstiegGroesse,
  levelWeg,
  levelWegStrich,
  wirksameEffektStufe,
} from './effekte.ts';

describe('effekte', () => {
  it('nimmt nur voll, reduziert und aus, sonst voll', () => {
    expect(effektStufe('voll')).toBe('voll');
    expect(effektStufe('reduziert')).toBe('reduziert');
    expect(effektStufe('aus')).toBe('aus');
    expect(effektStufe(undefined)).toBe('voll');
    expect(effektStufe('foo')).toBe('voll');
    expect(effektStufe(true)).toBe('voll');
  });

  it('lässt aus aus und zieht voll bei reduzierter Bewegung auf reduziert', () => {
    expect(wirksameEffektStufe('aus', true)).toBe('aus');
    expect(wirksameEffektStufe('aus', false)).toBe('aus');
    expect(wirksameEffektStufe('voll', true)).toBe('reduziert');
    expect(wirksameEffektStufe('voll', false)).toBe('voll');
    expect(wirksameEffektStufe('reduziert', false)).toBe('reduziert');
    expect(wirksameEffektStufe('reduziert', true)).toBe('reduziert');
  });

  it('federt nur bei voll', () => {
    expect(effektDarfFedern('voll')).toBe(true);
    expect(effektDarfFedern('reduziert')).toBe(false);
    expect(effektDarfFedern('aus')).toBe(false);
  });

  it('behält bei mehreren Effekten nur den größten und bei Gleichstand den ersten', () => {
    const klein = { groesse: 'klein' as const, name: 'xp' };
    const mittel = { groesse: 'mittel' as const, name: 'meilenstein' };
    const gross = { groesse: 'gross' as const, name: 'level' };
    const nochmalGross = { groesse: 'gross' as const, name: 'zweiter' };
    expect(groessterEffekt([])).toBeNull();
    expect(groessterEffekt([klein])).toBe(klein);
    expect(groessterEffekt([klein, mittel, gross])).toBe(gross);
    expect(groessterEffekt([gross, nochmalGross])).toBe(gross);
    expect(groesstesFeierZiel(['klein', 'mittel'], false)).toBe('meldung');
    expect(groesstesFeierZiel(['mittel'], true)).toBe('aufstieg');
    expect(groesstesFeierZiel([], false)).toBeNull();
  });

  it('lässt die Flamme bei genau einem Tag mehr zucken und bei 7, 30 und 100 einen größeren Moment machen', () => {
    expect(ketteMoment(0, 1)).toBe('zucken');
    expect(ketteMoment(4, 5)).toBe('zucken');
    expect(ketteMoment(6, 7)).toBe('meilenstein');
    expect(ketteMoment(7, 8)).toBe('zucken');
    expect(ketteMoment(29, 30)).toBe('meilenstein');
    expect(ketteMoment(99, 100)).toBe('meilenstein');
    expect(ketteMoment(100, 101)).toBe('zucken');
    expect(ketteMoment(5, 5)).toBeNull();
    expect(ketteMoment(5, 7)).toBeNull();
    expect(ketteMoment(8, 7)).toBeNull();
    expect(ketteMoment(6.5, 7.5)).toBeNull();
    expect(ketteMomentGroesse('zucken')).toBe('klein');
    expect(ketteMomentGroesse('meilenstein')).toBe('mittel');
  });

  it('hält die Flamme still, wenn ein anderer Effekt streng größer ist', () => {
    expect(ketteDarfSichBewegen('klein', [])).toBe(true);
    expect(ketteDarfSichBewegen('klein', ['klein'])).toBe(true);
    expect(ketteDarfSichBewegen('klein', ['mittel'])).toBe(false);
    expect(ketteDarfSichBewegen('mittel', ['klein'])).toBe(true);
    expect(ketteDarfSichBewegen('mittel', ['mittel'])).toBe(true);
    expect(ketteDarfSichBewegen('mittel', ['gross'])).toBe(false);
    expect(ketteDarfSichBewegen('klein', ['gross'])).toBe(false);
    expect(ketteDarfSichBewegen('klein', ['mittel'])).toBe(effektDarfSichBewegen('klein', ['mittel']));
  });

  it('erkennt einen Level-Rückgang und lässt Anstieg und Stand still', () => {
    expect(levelAbstieg(5, 4)).toBe(true);
    expect(levelAbstieg(8, 3)).toBe(true);
    expect(levelAbstieg(1, 0)).toBe(true);
    expect(levelAbstieg(4, 4)).toBe(false);
    expect(levelAbstieg(4, 5)).toBe(false);
    expect(levelAbstieg(1, 1)).toBe(false);
    expect(levelAbstieg(2.5, 1)).toBe(false);
    expect(levelAbstieg(0, -1)).toBe(false);
    expect(levelAbstiegGroesse()).toBe('klein');
    expect(effektDarfSichBewegen(levelAbstiegGroesse(), [])).toBe(true);
    expect(effektDarfSichBewegen(levelAbstiegGroesse(), ['klein'])).toBe(true);
    expect(effektDarfSichBewegen(levelAbstiegGroesse(), ['mittel'])).toBe(false);
    expect(effektDarfSichBewegen(levelAbstiegGroesse(), ['gross'])).toBe(false);
  });

  it('legt den Weg im Uhrzeigersinn von der Spitze bis 12 Uhr', () => {
    expect(levelWeg(Number.NaN)).toBeNull();
    expect(levelWeg(1)).toBeNull();
    expect(levelWeg(1.4)).toBeNull();
    const leer = levelWeg(0);
    expect(leer).toEqual({ startGrad: 0, endeGrad: 360 });
    const viertel = levelWeg(0.25);
    expect(viertel).toEqual({ startGrad: 90, endeGrad: 360 });
    if (!leer || !viertel) {
      return;
    }
    const voll = levelWegStrich(leer, 42);
    expect(voll.drehung).toBe(-90);
    expect(voll.luecke).toBeCloseTo(0);
    expect(voll.strich).toBeCloseTo(2 * Math.PI * 42);
    const rest = levelWegStrich(viertel, 42);
    expect(rest.drehung).toBe(0);
    expect(rest.strich).toBeGreaterThan(rest.luecke);
    expect(rest.strich / (rest.strich + rest.luecke)).toBeCloseTo(0.75);
    const haelfte = levelWeg(0.5);
    expect(haelfte).toEqual({ startGrad: 180, endeGrad: 360 });
    expect(levelWegStrich(haelfte ?? { startGrad: 0, endeGrad: 0 }, 42).drehung).toBe(90);
  });
});
