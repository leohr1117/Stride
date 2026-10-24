import { afterEach, describe, expect, it } from 'vitest';
import type { Bestwert } from '../../../../shared/api/training.ts';
import { setzeAktiveSprache } from '../../../../shared/sprache/index.ts';
import { kurzesDatum } from '../../format.ts';
import { bestwertZeilen, schaetzPunkte } from './bestwertAnzeige.ts';

function wert(teil: Partial<Bestwert> & Pick<Bestwert, 'id' | 'art' | 'wert'>): Bestwert {
  return { wiederholungen: null, erreichtAm: '2026-10-23T12:00:00.000Z', ...teil };
}

describe('bestwertAnzeige', () => {
  afterEach(() => {
    setzeAktiveSprache('de');
  });

  it('zeigt Gewicht mit Schätzung nur über dem Satz, Dauer als Sekunden', () => {
    setzeAktiveSprache('de');
    const zeilen = bestwertZeilen(
      [
        wert({ id: 4, art: 'eins', wert: 96250, wiederholungen: 5, erreichtAm: '2026-10-23T12:00:00.000Z' }),
        wert({ id: 3, art: 'gewicht', wert: 82500, wiederholungen: 5, erreichtAm: '2026-10-23T12:00:00.000Z' }),
        wert({ id: 2, art: 'gewicht', wert: 80000, wiederholungen: 5, erreichtAm: '2026-10-21T12:00:00.000Z' }),
        wert({ id: 1, art: 'gewicht', wert: 100000, wiederholungen: 1, erreichtAm: '2026-10-18T12:00:00.000Z' }),
        wert({ id: 5, art: 'dauer', wert: 60, erreichtAm: '2026-10-18T12:00:00.000Z' }),
      ],
      'kg',
    );
    expect(zeilen.map((zeile) => zeile.haupt)).toEqual(['82,5 kg × 5', '80,0 kg × 5', '100,0 kg × 1', '60 s']);
    expect(zeilen[0]?.schaetzung).toBe('Schätzung 96,3 kg');
    expect(zeilen[1]?.schaetzung).toBe('Schätzung 93,3 kg');
    expect(zeilen[2]?.schaetzung).toBeNull();
    expect(zeilen[3]?.schaetzung).toBeNull();
    expect(zeilen[0]?.datum).toBe(kurzesDatum('2026-10-23T12:00:00.000Z'));
  });

  it('rechnet die Schätzung in lb aus den Gramm', () => {
    setzeAktiveSprache('de');
    const zeilen = bestwertZeilen(
      [
        wert({ id: 3, art: 'gewicht', wert: 82500, wiederholungen: 5 }),
        wert({ id: 2, art: 'gewicht', wert: 80000, wiederholungen: 5, erreichtAm: '2026-10-21T12:00:00.000Z' }),
        wert({ id: 1, art: 'gewicht', wert: 100000, wiederholungen: 1, erreichtAm: '2026-10-18T12:00:00.000Z' }),
      ],
      'lb',
    );
    expect(zeilen.map((zeile) => zeile.haupt)).toEqual(['181,9 lb × 5', '176,4 lb × 5', '220,5 lb × 1']);
    expect(zeilen[0]?.schaetzung).toBe('Schätzung 212,2 lb');
    expect(zeilen[1]?.schaetzung).toBe('Schätzung 205,8 lb');
    expect(zeilen[2]?.schaetzung).toBeNull();
  });

  it('zeichnet das Diagramm erst ab zwei Schätzpunkten, älteste links', () => {
    setzeAktiveSprache('de');
    const einer = [
      wert({ id: 9, art: 'eins', wert: 96250, wiederholungen: 5, erreichtAm: '2026-10-23T12:00:00.000Z' }),
      wert({ id: 3, art: 'gewicht', wert: 82500, wiederholungen: 5, erreichtAm: '2026-10-23T12:00:00.000Z' }),
      wert({ id: 2, art: 'gewicht', wert: 80000, wiederholungen: 5, erreichtAm: '2026-10-21T12:00:00.000Z' }),
      wert({ id: 8, art: 'eins', wert: 1, erreichtAm: 'kein-datum' }),
    ];
    expect(schaetzPunkte(einer, 'kg')).toEqual([]);

    const zwei = [
      wert({ id: 12, art: 'eins', wert: 96250, wiederholungen: 5, erreichtAm: '2026-10-23T12:00:00.000Z' }),
      wert({ id: 11, art: 'eins', wert: 93333, wiederholungen: 5, erreichtAm: '2026-10-21T12:00:00.000Z' }),
      wert({ id: 5, art: 'dauer', wert: 60, erreichtAm: '2026-10-18T12:00:00.000Z' }),
      wert({ id: 20, art: 'eins', wert: 87500, wiederholungen: 5, erreichtAm: '2026-10-18T12:00:00.000Z' }),
      wert({ id: 10, art: 'eins', wert: 100000, wiederholungen: 1, erreichtAm: '2026-10-18T12:00:00.000Z' }),
    ];
    const punkte = schaetzPunkte(zwei, 'kg');
    const tag = (iso: string) => `${new Date(iso).getDate()}.`;
    expect(punkte.map((punkt) => punkt.wert)).toEqual([100, 87.5, 93.3, 96.3]);
    expect(punkte.map((punkt) => punkt.label)).toEqual([
      tag('2026-10-18T12:00:00.000Z'),
      tag('2026-10-18T12:00:00.000Z'),
      tag('2026-10-21T12:00:00.000Z'),
      tag('2026-10-23T12:00:00.000Z'),
    ]);
    expect(punkte[0]?.titel).toBe(kurzesDatum('2026-10-18T12:00:00.000Z'));

    setzeAktiveSprache('en');
    const englisch = schaetzPunkte(zwei, 'lb');
    expect(englisch.map((punkt) => punkt.wert)).toEqual([220.5, 192.9, 205.8, 212.2]);
    expect(englisch[0]?.label).toBe(String(new Date('2026-10-18T12:00:00.000Z').getDate()));
  });
});
