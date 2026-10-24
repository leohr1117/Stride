import { afterEach, describe, expect, it } from 'vitest';
import { grammAusAnzeige, KRAFT_BRAUCHT_WIEDERHOLUNGEN, SAETZE_HINWEIS } from '../../../../shared/spiel/training.ts';
import { setzeAktiveSprache } from '../../../../shared/sprache/index.ts';
import { eintragAus, leererEintrag, NAME_LEER, pruefePlan, wechselEinheit, type PlanEingabe } from './planStand.ts';

function eingabe(teil: Partial<PlanEingabe> & Pick<PlanEingabe, 'eintraege'>): PlanEingabe {
  return {
    name: 'Unterkörper',
    wochentage: [],
    projektId: null,
    vorlageId: 1,
    einheit: 'kg',
    ...teil,
  };
}

describe('planStand', () => {
  afterEach(() => {
    setzeAktiveSprache('de');
  });

  it('behält unberührte Gramm und schreibt die Anzeige bei der Einheit neu', () => {
    setzeAktiveSprache('de');
    const eintrag = eintragAus(
      {
        name: 'Kniebeuge',
        art: 'kraft',
        zielSaetze: 3,
        zielWiederholungen: 5,
        zielGewichtG: 80000,
        zielSekunden: null,
        aufwaermSaetze: 2,
        aufwaermWiederholungen: 5,
        aufwaermGewichtG: 40000,
        aufwaermSekunden: null,
      },
      'kg',
    );
    expect(eintrag.gewicht.text).toBe('80');
    const lb = wechselEinheit(eintrag, 'lb');
    expect(lb.gewicht.text).toBe('176,4');
    expect(lb.aufwaermGewicht.text).toBe('88,2');
    expect(lb.gewicht.beruehrt).toBe(false);
    const pruefung = pruefePlan(eingabe({ eintraege: [lb], einheit: 'lb' }));
    expect(pruefung.daten?.uebungen[0]?.zielGewichtG).toBe(80000);
    expect(pruefung.daten?.uebungen[0]?.aufwaermGewichtG).toBe(40000);
  });

  it('liest eine berührte Zahl in der neuen Einheit', () => {
    const eintrag = eintragAus(
      {
        name: 'Kniebeuge',
        art: 'kraft',
        zielSaetze: null,
        zielWiederholungen: 5,
        zielGewichtG: 80000,
        zielSekunden: null,
        aufwaermSaetze: null,
        aufwaermWiederholungen: null,
        aufwaermGewichtG: null,
        aufwaermSekunden: null,
      },
      'kg',
    );
    const beruehrt = { ...eintrag, gewicht: { ...eintrag.gewicht, text: '80', beruehrt: true } };
    const lb = wechselEinheit(beruehrt, 'lb');
    expect(lb.gewicht.text).toBe('80');
    const pruefung = pruefePlan(eingabe({ eintraege: [lb], einheit: 'lb' }));
    expect(pruefung.daten?.uebungen[0]?.zielGewichtG).toBe(grammAusAnzeige(80, 'lb'));
  });

  it('lässt leeres Gewicht leer und verlangt bei Kraft Wiederholungen', () => {
    const mitReps = leererEintrag();
    mitReps.name = 'Kniebeuge';
    mitReps.wiederholungen = '5';
    mitReps.gewicht = { text: '', gramm: null, beruehrt: false };
    const leer = pruefePlan(eingabe({ eintraege: [mitReps] }));
    expect(leer.daten?.uebungen[0]?.zielGewichtG).toBeNull();

    const ohne = leererEintrag();
    ohne.name = 'Kniebeuge';
    const fehler = pruefePlan(eingabe({ eintraege: [ohne] }));
    expect(fehler.daten).toBeNull();
    expect(fehler.eintraege[0]?.vorgabeFehler).toBe(KRAFT_BRAUCHT_WIEDERHOLUNGEN);
  });

  it('schickt bei Dauer nur Sekunden und bei ausgeschaltetem Aufwärmen nichts', () => {
    const eintrag = leererEintrag();
    eintrag.name = 'Unterarmstütz';
    eintrag.art = 'dauer';
    eintrag.saetze = '3';
    eintrag.sekunden = '45';
    eintrag.wiederholungen = '5';
    eintrag.gewicht = { text: '80', gramm: 80000, beruehrt: true };
    eintrag.aufwaermSaetze = '2';
    eintrag.aufwaermSekunden = '20';
    const pruefung = pruefePlan(eingabe({ eintraege: [eintrag] }));
    expect(pruefung.daten?.uebungen[0]).toMatchObject({
      art: 'dauer',
      zielSaetze: 3,
      zielSekunden: 45,
      zielWiederholungen: null,
      zielGewichtG: null,
      aufwaermSaetze: null,
      aufwaermSekunden: null,
      aufwaermWiederholungen: null,
      aufwaermGewichtG: null,
    });
  });

  it('meldet leeren Namen und ungültige Sätze', () => {
    const eintrag = leererEintrag();
    eintrag.saetze = '0';
    eintrag.wiederholungen = '5';
    const pruefung = pruefePlan(eingabe({ name: '  ', eintraege: [eintrag] }));
    expect(pruefung.nameFehler).toBe(NAME_LEER);
    expect(pruefung.eintraege[0]?.nameFehler).toBe(NAME_LEER);
    expect(pruefung.eintraege[0]?.vorgabeFehler).toBe(SAETZE_HINWEIS);
    expect(pruefung.daten).toBeNull();
  });
});
