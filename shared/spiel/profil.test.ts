import { describe, expect, it } from 'vitest';
import { ICONS } from './begriffe.ts';
import { empfohleneFunktionen } from '../features/handbuch/handbuchPfad.ts';
import {
  alterInJahren,
  FOKUS_IDS,
  geburtsjahrGueltig,
  istZielstrebigkeit,
  leseZielstrebigkeit,
  normalisiereFokus,
  einfuehrungZurueck,
  ONBOARDING_SCHRITTE,
  profilFragenOffen,
  START_TAETIGKEITEN,
  startAttribute,
  startKennungen,
  startTaetigkeiten,
  ZIEL_FRAGE,
  ZIELSTREBIGKEIT_INFO,
} from './profil.ts';

describe('profilfragen', () => {
  it('führt die Einführung in der festen Reihenfolge', () => {
    expect(ONBOARDING_SCHRITTE).toEqual(['sprache', 'folien', 'profilname', 'geburtsjahr', 'ziel', 'fokus']);
  });

  it('zeigt den Ablauf nur bei leerer Welt ohne angelegtes Profil', () => {
    expect(profilFragenOffen({ profilAngelegt: false, weltLeer: true })).toBe(true);
    expect(profilFragenOffen({ profilAngelegt: true, weltLeer: true })).toBe(false);
    expect(profilFragenOffen({ profilAngelegt: false, weltLeer: false })).toBe(false);
  });

  it('holt die Einführung nur zurück, wenn die Fragen neu aufgehen', () => {
    expect(einfuehrungZurueck(false, true)).toBe(true);
    expect(einfuehrungZurueck(true, true)).toBe(false);
    expect(einfuehrungZurueck(true, false)).toBe(false);
    expect(einfuehrungZurueck(false, false)).toBe(false);
  });

  it('prüft Geburtsjahr und Alter am Jahr, nicht am Geburtstag', () => {
    const heute = new Date('2026-10-20T12:00:00');
    expect(geburtsjahrGueltig(1899, heute)).toBe(false);
    expect(geburtsjahrGueltig(1990, heute)).toBe(true);
    expect(geburtsjahrGueltig(2026, heute)).toBe(true);
    expect(geburtsjahrGueltig(2027, heute)).toBe(false);
    expect(geburtsjahrGueltig(1990.5, heute)).toBe(false);
    expect(alterInJahren(1990, heute)).toBe(36);
  });

  it('erkennt die Zielstrebigkeit und verwirft Unbekanntes beim Fokus', () => {
    expect(istZielstrebigkeit('bodenstaendig')).toBe(true);
    expect(istZielstrebigkeit('uebung')).toBe(true);
    expect(istZielstrebigkeit('einfach')).toBe(true);
    expect(istZielstrebigkeit('kleineErfolge')).toBe(false);
    expect(istZielstrebigkeit('traum')).toBe(false);
    expect(leseZielstrebigkeit('traeumer')).toBe('traeumer');
    expect(leseZielstrebigkeit('kleineErfolge')).toBe('bodenstaendig');
    expect(leseZielstrebigkeit('nein')).toBeNull();
    expect(ZIEL_FRAGE).toBe('Was willst du erreichen?');
    expect(ZIELSTREBIGKEIT_INFO.traeumer).toEqual({
      titel: 'Ein Lebensziel',
      text: 'Vision, Projekt und Vorhaben.',
    });
    expect(ZIELSTREBIGKEIT_INFO.macher).toEqual({ titel: 'Projekte umsetzen', text: 'Projekte und Vorhaben.' });
    expect(ZIELSTREBIGKEIT_INFO.bodenstaendig).toEqual({ titel: 'Konkrete Ziele', text: 'Vorhaben in Projekten.' });
    expect(ZIELSTREBIGKEIT_INFO.uebung).toEqual({
      titel: '(In etwas) besser werden',
      text: 'Tätigkeiten und Fähigkeiten.',
    });
    expect(ZIELSTREBIGKEIT_INFO.einfach).toEqual({ titel: 'Dranbleiben', text: 'Nur Einträge.' });
    expect(normalisiereFokus(['sport', 'sport', 'quatsch', 'geld'])).toEqual(['sport', 'geld']);
    expect(normalisiereFokus({ sport: true })).toEqual([]);
  });
});

describe('startAttribute', () => {
  it('aktiviert für Sport Vitalität, Körper und Disziplin', () => {
    expect(startAttribute(['sport']).gewaehlt).toEqual(['vitalitaet', 'koerper', 'disziplin']);
  });

  it('füllt keinen leeren Bereich auf', () => {
    expect(startAttribute(['sport']).ergaenzt).toEqual([]);
    expect(startKennungen(['sport'])).toEqual(['vitalitaet', 'koerper', 'disziplin']);
    expect(startAttribute(['sport', 'soziales', 'geld']).ergaenzt).toEqual([]);
  });

  it('doppelt keine Kennung', () => {
    for (const fokus of FOKUS_IDS) {
      const kennungen = startKennungen([fokus]);
      expect(new Set(kennungen).size).toBe(kennungen.length);
      expect(kennungen.length).toBeGreaterThan(0);
    }
  });
});

describe('startTaetigkeiten', () => {
  it('gibt jedem Fokus Tätigkeiten, deren Gewichte nur seine Kennungen treffen', () => {
    const namen = FOKUS_IDS.flatMap((id) => START_TAETIGKEITEN[id].map((taetigkeit) => taetigkeit.name));
    expect(new Set(namen).size).toBe(namen.length);
    expect(START_TAETIGKEITEN.sport.map((taetigkeit) => taetigkeit.name)).toEqual(['Training', 'Laufen', 'Dehnen']);
    expect(START_TAETIGKEITEN.gesundheit.map((taetigkeit) => taetigkeit.name)).toEqual(['Ausgeschlafen', 'Bewegt']);
    expect(START_TAETIGKEITEN.lernen.map((taetigkeit) => taetigkeit.name)).toEqual(['Lernen', 'Lesen']);
    expect(START_TAETIGKEITEN.erfolg.map((taetigkeit) => taetigkeit.name)).toEqual(['Liefern', 'Präsentieren']);
    expect(START_TAETIGKEITEN.geld.map((taetigkeit) => taetigkeit.name)).toEqual(['Sparen', 'Anlegen', 'Verdienen']);
    expect(START_TAETIGKEITEN.kreativitaet.map((taetigkeit) => taetigkeit.name)).toEqual(['Erschaffen', 'Brainstormen']);
    expect(START_TAETIGKEITEN.mut.map((taetigkeit) => taetigkeit.name)).toEqual(['Trauen', 'Anfangen']);
    expect(startKennungen(['mut'])).toEqual(['mut', 'disziplin', 'geist']);
    expect(FOKUS_IDS.some((id) => startKennungen([id]).includes('reichweite'))).toBe(false);
    for (const fokus of FOKUS_IDS) {
      const erlaubt = new Set(startKennungen([fokus]));
      const liste = START_TAETIGKEITEN[fokus];
      expect(liste.length).toBeGreaterThan(0);
      for (const taetigkeit of liste) {
        expect(ICONS).toContain(taetigkeit.icon);
        expect(taetigkeit.gewichte.length).toBeGreaterThan(0);
        expect(taetigkeit.gewichte.reduce((summe, gewicht) => summe + gewicht.gewicht, 0)).toBe(100);
        const kennungen = taetigkeit.gewichte.map((gewicht) => gewicht.kennung);
        expect(new Set(kennungen).size).toBe(kennungen.length);
        for (const gewicht of taetigkeit.gewichte) {
          expect(erlaubt.has(gewicht.kennung)).toBe(true);
          expect(gewicht.gewicht).toBeGreaterThan(0);
        }
      }
    }
  });

  it('führt mehrere Fokusse zusammen, ohne einen Namen zu doppeln', () => {
    const namen = startTaetigkeiten(['sport', 'lernen']).map((taetigkeit) => taetigkeit.name);
    expect(namen).toEqual(['Training', 'Laufen', 'Dehnen', 'Lernen', 'Lesen']);
    expect(startTaetigkeiten(['sport', 'sport'])).toHaveLength(3);
  });
});

describe('fokus empfiehlt im handbuch', () => {
  it('gibt jedem Fokus mindestens eine Empfehlung, dieselbe Seite darf mehrfach vorkommen', () => {
    for (const id of FOKUS_IDS) {
      expect(empfohleneFunktionen([id]).length).toBeGreaterThan(0);
    }
    expect(empfohleneFunktionen(['sport']).length).toBeGreaterThan(2);
    expect(empfohleneFunktionen(['geld']).map((eintrag) => eintrag.funktion)).toContain('statistiken');
    expect(empfohleneFunktionen(['soziales']).map((eintrag) => eintrag.funktion)).toContain('chronik');
    expect(empfohleneFunktionen(['mut']).map((eintrag) => eintrag.funktion)).toContain('chronik');
    const seiten = new Set(FOKUS_IDS.flatMap((id) => empfohleneFunktionen([id]).map((eintrag) => eintrag.funktion)));
    expect(seiten.has('chronik')).toBe(true);
    expect(seiten.has('vorbilder')).toBe(true);
    expect(seiten.has('statistiken')).toBe(true);
    expect(seiten.has('basis')).toBe(true);
  });
});
