import { describe, expect, it } from 'vitest';
import { isoWochentag } from './aufgabe.ts';
import {
  anzeigeAusGramm,
  bestwertZeilen,
  epleyGramm,
  einheitStunden,
  grammAusAnzeige,
  grammBeimSpeichern,
  istArbeitssatz,
  istBestwert,
  istErsterBestwert,
  planLiegtAmTag,
  satzzeilen,
  schaetzungSichtbar,
  STANDARD_GEWICHT_EINHEIT,
  type BestwertStand,
  type PlanVorgabe,
  type SatzFuerBestwert,
} from './training.ts';

const STUNDE = 60 * 60 * 1000;

function kraft(teil: Partial<SatzFuerBestwert> = {}): SatzFuerBestwert {
  return {
    art: 'kraft',
    erledigt: true,
    aufwaermen: false,
    gewichtG: 80000,
    wiederholungen: 5,
    sekunden: null,
    ...teil,
  };
}

function vorgabe(teil: Partial<PlanVorgabe> = {}): PlanVorgabe {
  return {
    uebungId: 1,
    art: 'kraft',
    zielSaetze: 3,
    zielWiederholungen: 5,
    zielGewichtG: 80000,
    zielSekunden: null,
    aufwaermSaetze: 2,
    aufwaermWiederholungen: 5,
    aufwaermGewichtG: 40000,
    aufwaermSekunden: null,
    ...teil,
  };
}

describe('einheitStunden', () => {
  it('klemmt auf 0,25 und 24', () => {
    expect(einheitStunden(0, 60 * 1000)).toBe(0.25);
    expect(einheitStunden(0, 0.25 * STUNDE)).toBe(0.25);
    expect(einheitStunden(0, 48 * STUNDE)).toBe(24);
    expect(einheitStunden(0, 24 * STUNDE)).toBe(24);
  });

  it('bleibt bei 1, wenn die Uhr fehlt oder das Ende nicht nach dem Start liegt', () => {
    expect(einheitStunden(null, null)).toBe(1);
    expect(einheitStunden(0, null)).toBe(1);
    expect(einheitStunden(null, STUNDE)).toBe(1);
    expect(einheitStunden(1000, 1000)).toBe(1);
    expect(einheitStunden(1000, 0)).toBe(1);
    expect(einheitStunden(Number.NaN, STUNDE)).toBe(1);
  });

  it('rundet die gestoppte Zeit und lässt Sätze außen vor', () => {
    expect(einheitStunden(0, 0.75 * STUNDE)).toBe(0.75);
    expect(einheitStunden(0, 1.5 * STUNDE)).toBe(1.5);
    expect(einheitStunden(0, STUNDE + 60 * 1000)).toBe(1.02);
  });
});

describe('Gramm und Anzeige', () => {
  it('zeigt 80 000 g als 176,4 lb und die weiteren Beispiele', () => {
    expect(STANDARD_GEWICHT_EINHEIT).toBe('kg');
    expect(anzeigeAusGramm(80000, 'kg')).toBe(80);
    expect(anzeigeAusGramm(80000, 'lb')).toBe(176.4);
    expect(anzeigeAusGramm(40000, 'lb')).toBe(88.2);
    expect(anzeigeAusGramm(77500, 'lb')).toBe(170.9);
    expect(anzeigeAusGramm(82500, 'lb')).toBe(181.9);
    expect(anzeigeAusGramm(100000, 'lb')).toBe(220.5);
    expect(anzeigeAusGramm(77500, 'kg')).toBe(77.5);
    expect(anzeigeAusGramm(82500, 'kg')).toBe(82.5);
  });

  it('lässt unberührte Gramm stehen', () => {
    expect(grammAusAnzeige(176.4, 'lb')).not.toBe(80000);
    expect(grammBeimSpeichern(80000, 176.4, 'lb')).toBe(80000);
    expect(grammBeimSpeichern(80001, 80, 'kg')).toBe(80001);
    expect(grammBeimSpeichern(80000, null, 'lb')).toBeNull();
    expect(grammBeimSpeichern(null, null, 'kg')).toBeNull();
  });

  it('rechnet eine geänderte Anzeige neu in Gramm', () => {
    expect(grammBeimSpeichern(80000, 80.5, 'kg')).toBe(80500);
    expect(grammBeimSpeichern(null, 40, 'kg')).toBe(40000);
    expect(grammAusAnzeige(80, 'kg')).toBe(80000);
  });
});

describe('epleyGramm', () => {
  it('rechnet 80 kg mal 5 als 93 333 g und darunter das Satzgewicht', () => {
    expect(epleyGramm(80000, 5)).toBe(93333);
    expect(epleyGramm(82500, 5)).toBe(96250);
    expect(epleyGramm(80000, 1)).toBe(80000);
    expect(epleyGramm(80000, 2)).toBe(80000);
    expect(anzeigeAusGramm(93333, 'kg')).toBe(93.3);
    expect(anzeigeAusGramm(96250, 'kg')).toBe(96.3);
    expect(anzeigeAusGramm(93333, 'lb')).toBe(205.8);
    expect(anzeigeAusGramm(96250, 'lb')).toBe(212.2);
  });

  it('zeigt die Schätzung nur über dem Satzgewicht', () => {
    expect(schaetzungSichtbar(80000, 2)).toBe(false);
    expect(schaetzungSichtbar(80000, 5)).toBe(true);
  });
});

describe('ISO-Wochentag', () => {
  it('setzt den 2026-10-23 auf Freitag', () => {
    const utc = new Date(Date.UTC(2026, 9, 23));
    expect((utc.getUTCDay() + 6) % 7 + 1).toBe(5);
    expect(isoWochentag('2026-10-23')).toBe(5);
    expect(isoWochentag('2026-10-19')).toBe(1);
    expect(isoWochentag('2026-10-25')).toBe(7);
    expect(planLiegtAmTag([5], '2026-10-23')).toBe(true);
    expect(planLiegtAmTag([1, 3], '2026-10-23')).toBe(false);
    expect(planLiegtAmTag([], '2026-10-23')).toBe(false);
  });
});

describe('Arbeitssatz und Bestwert', () => {
  it('erkennt einen Arbeitssatz nur als erledigt und ohne Aufwärmen', () => {
    expect(istArbeitssatz(kraft())).toBe(true);
    expect(istArbeitssatz(kraft({ aufwaermen: true }))).toBe(false);
    expect(istArbeitssatz(kraft({ erledigt: false }))).toBe(false);
  });

  it('hängt Gewicht und Schätzung an und lässt Aufwärmen und Eigengewicht aus', () => {
    expect(bestwertZeilen(kraft(), [])).toEqual([
      { art: 'gewicht', wert: 80000, wiederholungen: 5 },
      { art: 'eins', wert: 93333, wiederholungen: 5 },
    ]);
    expect(istErsterBestwert(kraft(), [])).toBe(true);
    expect(bestwertZeilen(kraft({ aufwaermen: true }), [])).toEqual([]);
    expect(bestwertZeilen(kraft({ erledigt: false }), [])).toEqual([]);
    expect(bestwertZeilen(kraft({ gewichtG: null }), [])).toEqual([]);
    expect(istBestwert(kraft({ gewichtG: null }), [])).toBe(false);
    expect(istErsterBestwert(kraft({ aufwaermen: true }), [])).toBe(false);
  });

  it('nimmt das Maximum und hängt ein späteres Kilogramm nur bei einem strikt besseren Wert an', () => {
    const bisher: BestwertStand[] = [
      { art: 'gewicht', wert: 80000, wiederholungen: 5 },
      { art: 'eins', wert: 93333, wiederholungen: 5 },
    ];
    expect(bestwertZeilen(kraft(), bisher)).toEqual([]);
    expect(istErsterBestwert(kraft({ gewichtG: 82500 }), bisher)).toBe(false);
    expect(bestwertZeilen(kraft({ gewichtG: 82500 }), bisher)).toEqual([
      { art: 'gewicht', wert: 82500, wiederholungen: 5 },
      { art: 'eins', wert: 96250, wiederholungen: 5 },
    ]);
    expect(bestwertZeilen(kraft({ gewichtG: 70000 }), bisher)).toEqual([]);
  });

  it('vergleicht das Gewicht je Wiederholungszahl und die Schätzung über alle Sätze', () => {
    const bisher: BestwertStand[] = [
      { art: 'gewicht', wert: 100000, wiederholungen: 5 },
      { art: 'gewicht', wert: 80000, wiederholungen: 5 },
      { art: 'eins', wert: 116666, wiederholungen: 5 },
    ];
    expect(bestwertZeilen(kraft({ gewichtG: 90000 }), bisher)).toEqual([]);
    expect(bestwertZeilen(kraft({ gewichtG: 50000, wiederholungen: 1 }), bisher)).toEqual([
      { art: 'gewicht', wert: 50000, wiederholungen: 1 },
    ]);
    expect(schaetzungSichtbar(50000, 1)).toBe(false);
  });

  it('nimmt bei Dauer die längsten Sekunden und kein Gewicht', () => {
    const satz = kraft({ art: 'dauer', gewichtG: 80000, wiederholungen: null, sekunden: 45 });
    expect(bestwertZeilen(satz, [])).toEqual([{ art: 'dauer', wert: 45, wiederholungen: null }]);
    expect(bestwertZeilen(satz, [{ art: 'dauer', wert: 45, wiederholungen: null }])).toEqual([]);
    expect(bestwertZeilen(satz, [{ art: 'dauer', wert: 60, wiederholungen: null }])).toEqual([]);
    expect(bestwertZeilen({ ...satz, sekunden: 90 }, [{ art: 'dauer', wert: 60, wiederholungen: null }])).toEqual([
      { art: 'dauer', wert: 90, wiederholungen: null },
    ]);
    expect(bestwertZeilen({ ...satz, aufwaermen: true }, [])).toEqual([]);
  });
});

describe('satzzeilen', () => {
  it('macht aus zwei Aufwärmsätzen und drei Arbeitssätzen fünf Zeilen, Aufwärmen zuerst', () => {
    const zeilen = satzzeilen([vorgabe()]);
    expect(zeilen).toHaveLength(5);
    expect(zeilen.map((zeile) => zeile.aufwaermen)).toEqual([true, true, false, false, false]);
    expect(zeilen.map((zeile) => zeile.reihenfolge)).toEqual([1, 2, 3, 4, 5]);
    expect(zeilen.every((zeile) => zeile.erledigt === false)).toBe(true);
    expect(zeilen[0]).toMatchObject({ gewichtG: 40000, wiederholungen: 5, sekunden: null });
    expect(zeilen[2]).toMatchObject({ gewichtG: 80000, wiederholungen: 5, sekunden: null });
  });

  it('lässt leeres Gewicht null und schreibt bei Dauer keine Gramm', () => {
    const zeilen = satzzeilen([
      vorgabe({
        uebungId: 2,
        zielSaetze: 3,
        zielWiederholungen: 8,
        zielGewichtG: null,
        aufwaermSaetze: null,
        aufwaermWiederholungen: null,
        aufwaermGewichtG: null,
      }),
      vorgabe({
        uebungId: 3,
        art: 'dauer',
        zielSaetze: 2,
        zielWiederholungen: null,
        zielGewichtG: 80000,
        zielSekunden: 45,
        aufwaermSaetze: 1,
        aufwaermWiederholungen: null,
        aufwaermGewichtG: 40000,
        aufwaermSekunden: 20,
      }),
    ]);
    expect(zeilen).toHaveLength(6);
    expect(zeilen.slice(0, 3).every((zeile) => zeile.gewichtG === null && zeile.wiederholungen === 8)).toBe(true);
    expect(zeilen[3]).toMatchObject({ aufwaermen: true, gewichtG: null, wiederholungen: null, sekunden: 20, reihenfolge: 4 });
    expect(zeilen[4]).toMatchObject({ aufwaermen: false, gewichtG: null, sekunden: 45, reihenfolge: 5 });
  });
});
