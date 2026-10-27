import { describe, expect, it } from 'vitest';
import { ebenenFuerStufe } from './ebenen.ts';
import { standardFunktionen } from './funktionen.ts';
import {
  entfernePlatz,
  haengePlatzAn,
  istLeiste,
  LEISTE_MAX,
  LEISTE_STANDARD,
  LEISTEN_SEITEN,
  leistenMitte,
  sichtbareLeiste,
  tauschMitSichtbar,
  zeigtZurueckZumMehr,
  bereinigteLeiste,
  zurueckFuerSeite,
} from './leiste.ts';

describe('istLeiste', () => {
  it('nimmt die Standardleiste und eine leere Leiste an', () => {
    expect(LEISTE_STANDARD).toEqual(['/', '/laufend', '/ziele', '/mehr']);
    expect(istLeiste(LEISTE_STANDARD)).toBe(true);
    expect(istLeiste([])).toBe(true);
    const pfade = LEISTEN_SEITEN.map((seite) => seite.pfad);
    expect(pfade[pfade.indexOf('/basis') + 1]).toBe('/training');
    expect(istLeiste(['/', '/aufgaben'])).toBe(false);
    expect(istLeiste(['/', '/training'])).toBe(true);
  });

  it('lehnt Unbekanntes und Doppeltes ab und behält versteckte Seiten', () => {
    expect(istLeiste(['/unbekannt'])).toBe(false);
    expect(istLeiste(['/', '/'])).toBe(false);
    expect(istLeiste(['/', '/laufend', '/ziele', '/mehr', '/chronik'])).toBe(true);
    expect(istLeiste(['/charakter'])).toBe(false);
    expect(istLeiste(['/', '/charakter'])).toBe(false);
    expect(istLeiste('')).toBe(false);
  });
});

describe('leistenMitte', () => {
  it('legt den Plus-Knopf in die Mitte, bei ungerader Zahl einen Platz weiter links', () => {
    expect(leistenMitte(0)).toBe(0);
    expect(leistenMitte(1)).toBe(1);
    expect(leistenMitte(2)).toBe(1);
    expect(leistenMitte(3)).toBe(2);
    expect(leistenMitte(4)).toBe(2);
  });
});

describe('leistenPlätze', () => {
  const liste = ['/', '/laufend', '/ziele', '/mehr'];

  it('hängt einen freien Platz an und leert einen Platz', () => {
    expect(haengePlatzAn(['/', '/laufend'], '/ziele')).toEqual(['/', '/laufend', '/ziele']);
    expect(haengePlatzAn(liste, '/chronik')).toEqual(liste);
    expect(haengePlatzAn(['/'], '/')).toEqual(['/']);
    expect(entfernePlatz(liste, 2)).toEqual(['/', '/laufend', '/mehr']);
    expect(liste).toHaveLength(LEISTE_MAX);
  });

  it('zählt nur sichtbare Seiten und lässt versteckte liegen', () => {
    const aktiv = (pfad: string) => pfad !== '/laufend' && pfad !== '/ziele';
    expect(haengePlatzAn(liste, '/chronik', aktiv)).toEqual(['/', '/laufend', '/ziele', '/mehr', '/chronik']);
    const vierSichtbar = ['/', '/laufend', '/ziele', '/mehr', '/chronik'];
    const fastAlles = (pfad: string) => pfad !== '/laufend';
    expect(haengePlatzAn(vierSichtbar, '/basis', fastAlles)).toEqual(vierSichtbar);
  });
});

describe('sichtbareLeiste', () => {
  it('lässt ausgeschaltete Bereiche weg', () => {
    const funktionen = standardFunktionen();
    funktionen.basis = false;
    funktionen.chronik = false;
    expect(sichtbareLeiste(['/', '/basis', '/chronik', '/mehr'], funktionen)).toEqual(['/', '/mehr']);
  });

  it('zeigt im Standard das Handbuch und blendet die übrigen Bereiche aus', () => {
    expect(sichtbareLeiste(['/', '/basis', '/chronik', '/handbuch', '/vorbilder', '/mehr'], standardFunktionen())).toEqual([
      '/',
      '/handbuch',
      '/mehr',
    ]);
  });

  it('lässt Ziele nur bei Vision, Projekt oder Vorhaben', () => {
    const funktionen = standardFunktionen();
    expect(sichtbareLeiste(['/', '/ziele', '/mehr'], funktionen, ebenenFuerStufe('bodenstaendig'))).toEqual([
      '/',
      '/ziele',
      '/mehr',
    ]);
    expect(sichtbareLeiste(['/', '/ziele', '/mehr'], funktionen, ebenenFuerStufe('einfach'))).toEqual(['/', '/mehr']);
    expect(sichtbareLeiste(['/', '/laufend', '/ziele', '/mehr'], funktionen, ebenenFuerStufe('einfach'))).toEqual([
      '/',
      '/mehr',
    ]);
    expect(sichtbareLeiste(['/', '/laufend', '/mehr'], funktionen, ebenenFuerStufe('bodenstaendig'))).toEqual([
      '/',
      '/laufend',
      '/mehr',
    ]);
    expect(sichtbareLeiste(['/', '/ziele', '/mehr'], funktionen, ebenenFuerStufe('uebung'))).toEqual(['/', '/mehr']);
    expect(
      sichtbareLeiste(['/', '/ziele', '/mehr'], funktionen, {
        visionen: false,
        organisationen: true,
        projekte: false,
        vorhaben: false,
      }),
    ).toEqual(['/', '/mehr']);
  });
});

describe('tauschMitSichtbar', () => {
  it('tauscht mit dem nächsten sichtbaren Platz und lässt versteckte Pfade liegen', () => {
    const aktiv = (pfad: string) => pfad !== '/ziele';
    expect(tauschMitSichtbar(['/', '/ziele', '/mehr'], 2, -1, aktiv)).toEqual(['/mehr', '/ziele', '/']);
    expect(tauschMitSichtbar(['/', '/ziele', '/mehr'], 0, 1, aktiv)).toEqual(['/mehr', '/ziele', '/']);
    expect(tauschMitSichtbar(['/', '/ziele', '/mehr'], 2, 1, aktiv)).toEqual(['/', '/ziele', '/mehr']);
  });
});

describe('zeigtZurueckZumMehr', () => {
  it('zeigt den Knopf nur, wenn die Seite gerade nicht in der Leiste liegt', () => {
    expect(zeigtZurueckZumMehr('/chronik', LEISTE_STANDARD)).toBe(true);
    expect(zeigtZurueckZumMehr('/laufend', [])).toBe(true);
    expect(zeigtZurueckZumMehr('/', LEISTE_STANDARD)).toBe(false);
    expect(zeigtZurueckZumMehr('/mehr', ['/', '/laufend', '/ziele', '/charakter'])).toBe(false);
    expect(zeigtZurueckZumMehr('/mehr', [])).toBe(false);
    expect(zeigtZurueckZumMehr('/projekte/1', LEISTE_STANDARD)).toBe(false);
    expect(zeigtZurueckZumMehr('/mehr/konto', LEISTE_STANDARD)).toBe(false);
    expect(zeigtZurueckZumMehr('/verbindungen', LEISTE_STANDARD)).toBe(false);
  });

  it('folgt der sichtbaren Leiste, nicht der gespeicherten Auswahl', () => {
    const funktionen = standardFunktionen();
    funktionen.basis = false;
    const leiste = sichtbareLeiste(['/', '/basis', '/ziele', '/mehr'], funktionen);
    expect(zeigtZurueckZumMehr('/basis', leiste)).toBe(true);
    expect(zeigtZurueckZumMehr('/ziele', leiste)).toBe(false);
  });
});

describe('zurueckFuerSeite', () => {
  it('führt vom Charakter zur Übersicht und lässt Haupt-Tabs ohne Pfeil', () => {
    expect(zurueckFuerSeite('/charakter', LEISTE_STANDARD)).toEqual({ pfad: '/', label: 'Übersicht' });
    expect(zurueckFuerSeite('/charakter', ['/'])).toEqual({ pfad: '/', label: 'Übersicht' });
    expect(zurueckFuerSeite('/chronik', LEISTE_STANDARD)).toBeNull();
    expect(zurueckFuerSeite('/basis', [])).toBeNull();
    expect(zurueckFuerSeite('/', LEISTE_STANDARD)).toBeNull();
    expect(zurueckFuerSeite('/mehr', LEISTE_STANDARD)).toBeNull();
  });
});

describe('bereinigteLeiste', () => {
  it('lässt Charakter und Unbekanntes weg und behält den Rest', () => {
    expect(bereinigteLeiste(['/', '/aufgaben', '/mehr'])).toEqual(['/', '/mehr']);
    expect(bereinigteLeiste(['/', '/charakter', '/ziele', '/mehr'])).toEqual(['/', '/ziele', '/mehr']);
    expect(bereinigteLeiste(['/', '/'])).toEqual(['/']);
    expect(bereinigteLeiste([])).toEqual([]);
    expect(bereinigteLeiste('keine liste')).toBeNull();
    expect(bereinigteLeiste(['/', '/laufend', '/ziele', '/chronik', '/mehr'])).toEqual([
      '/',
      '/laufend',
      '/ziele',
      '/chronik',
      '/mehr',
    ]);
  });
});