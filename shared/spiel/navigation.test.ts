import { describe, expect, it } from 'vitest';
import { standardEbenen } from './ebenen.ts';
import { BEREICH_SCHALTER, istFunktion, standardFunktionen, type Funktionen } from './funktionen.ts';
import { LEISTEN_SEITEN } from './leiste.ts';
import { BLOCK_NAME, SEITEN, seiteZuPfad, toastZielFuer, type Block } from './navigation.ts';
import { hatSchluessel } from '../sprache/index.ts';
import { pfadAktiv } from './sichtbarkeit.ts';
import { karteSichtbar, UEBERSICHT_KARTEN } from './uebersichtKarten.ts';

const VERZEICHNIS = [
  ['/', 'Übersicht', 'haus', 1],
  ['/ziele', 'Ziele', 'kompass', 1],
  ['/laufend', 'Laufend', 'laufend', 1],
  ['/basis', 'Basis', 'schichten', 1],
  ['/mehr/inhalte', 'Tätigkeiten', 'liste', 1],
  ['/chronik', 'Chronik', 'weg', 2],
  ['/rueckblick', 'Rückblick', 'kalender', 2],
  ['/statistiken', 'Statistiken', 'diagramm', 2],
  ['/vorbilder', 'Vorbilder', 'stern', 2],
  ['/charakter', 'Profil', 'person', 3],
  ['/koennen', 'Können', 'hirn', 3],
  ['/haben', 'Haben', 'boerse', 3],
  ['/faehigkeiten', 'Fähigkeiten', 'funken', 3],
  ['/investitionen', 'Investitionen', 'juwel', 3],
  ['/handbuch', 'Handbuch', 'buch', 4],
] as const;

const PROFILZEILE = new Set(['/koennen', '/haben', '/faehigkeiten', '/investitionen']);

describe('Seitentabelle', () => {
  it('hat für jede Seite Name, Symbol und Block, in der Reihenfolge aus 11.1', () => {
    const verzeichnis = SEITEN.filter((seite) => seite.pfad !== '/mehr');
    expect(verzeichnis.map((seite) => [seite.pfad, seite.name, seite.symbol, seite.block])).toEqual(
      VERZEICHNIS.map((zeile) => [...zeile]),
    );
    expect(new Set(verzeichnis.map((seite) => seite.block))).toEqual(new Set<Block>([1, 2, 3, 4]));
    expect(BLOCK_NAME).toEqual({
      1: 'Planen und Tun',
      2: 'Rückschau',
      3: 'Profil',
      4: 'Nachschlagen',
    });
    const mehr = SEITEN.find((seite) => seite.pfad === '/mehr');
    expect(mehr).toMatchObject({ name: 'Mehr', symbol: 'zahnrad', block: null, toastZiel: '/mehr' });
    expect(new Set(SEITEN.map((seite) => seite.pfad)).size).toBe(SEITEN.length);
    for (const seite of SEITEN) {
      expect(seite.name.trim()).toBe(seite.name);
      expect(seite.symbol.length).toBeGreaterThan(0);
      expect(seite.toastZiel).toBe(seite.pfad);
      expect(seite.profilzeile).toBe(PROFILZEILE.has(seite.pfad));
      expect(hatSchluessel(seite.name)).toBe(true);
    }
  });

  it('nimmt alle Seiten der Tabelle in die Leiste und übernimmt die Namen', () => {
    const pfade = LEISTEN_SEITEN.map((seite) => seite.pfad);
    expect(pfade).toEqual(SEITEN.map((seite) => seite.pfad));
    expect(pfade).toContain('/charakter');
    expect(pfade).toContain('/mehr/inhalte');
    for (const seite of LEISTEN_SEITEN) {
      expect(seite.label).toBe(SEITEN.find((eintrag) => eintrag.pfad === seite.pfad)?.name);
    }
  });

  it('schaltet den Pfad über den Schalter der Tabelle', () => {
    const funktionen: Funktionen = {
      ...standardFunktionen(),
      basis: false,
      chronik: false,
      handbuch: false,
      koennen: false,
      rueckblick: false,
      statistiken: false,
      status: false,
      vorbilder: false,
    };
    const ebenen = { visionen: false, organisationen: false, projekte: false, vorhaben: false };
    const aus = { funktionen, ebenen };
    for (const seite of SEITEN) {
      if (seite.schalter === null || seite.schalter === 'ziele' || seite.schalter === 'laufend') {
        expect(pfadAktiv(seite.pfad, aus)).toBe(seite.schalter === null);
      } else {
        expect(pfadAktiv(seite.pfad, aus)).toBe(false);
        expect(pfadAktiv(seite.pfad, { funktionen: { ...funktionen, [seite.schalter]: true }, ebenen })).toBe(true);
      }
    }
    expect(pfadAktiv('/ziele', { funktionen, ebenen: { ...ebenen, visionen: true } })).toBe(true);
    expect(pfadAktiv('/laufend', { funktionen, ebenen: { ...standardEbenen(), vorhaben: true } })).toBe(true);
    expect(pfadAktiv('/vorbilder/ada', aus)).toBe(false);
    expect(seiteZuPfad('/vorbilder/ada')?.pfad).toBe('/vorbilder');
    expect(seiteZuPfad('/vorbilder/ada')?.schalter).toBe('vorbilder');
    expect(seiteZuPfad('/faehigkeiten/2')?.pfad).toBe('/faehigkeiten');
    expect(seiteZuPfad('/faehigkeiten/2')?.schalter).toBe('faehigkeiten');
  });
});

const TOAST_ZIEL: Record<string, string> = {
  basis: '/basis',
  chronik: '/chronik',
  rueckblick: '/rueckblick',
  statistiken: '/statistiken',
  vorbilder: '/vorbilder',
  handbuch: '/handbuch',
  koennen: '/koennen',
  status: '/haben',
  faehigkeiten: '/faehigkeiten',
  ausruestung: '/investitionen',
  visionen: '/ziele',
  organisationen: '/ziele',
  projekte: '/ziele',
  vorhaben: '/ziele',
  bossAngriffe: '/laufend',
  verfallKoennen: '/koennen',
  verfallHaben: '/haben',
};

describe('17 Schalter', () => {
  it('liest das Toast-Ziel aus der Seitentabelle bzw. 11.2 b', () => {
    expect(BEREICH_SCHALTER).toHaveLength(17);
    for (const eintrag of BEREICH_SCHALTER) {
      const seite = SEITEN.find((kandidat) => kandidat.schalter === eintrag.schalter);
      if (seite) {
        expect(eintrag.label).toBe(seite.name);
        expect(toastZielFuer(eintrag.schalter)).toBe(seite.toastZiel);
      }
      expect(toastZielFuer(eintrag.schalter)).toBe(TOAST_ZIEL[eintrag.schalter]);
      expect(hatSchluessel(eintrag.label)).toBe(true);
      expect(hatSchluessel(eintrag.gruppe)).toBe(true);
    }
  });

  it('blendet ausgeschaltete Seiten überall außer in Bereiche aus', () => {
    const funktionen: Funktionen = { ...standardFunktionen() };
    for (const schluessel of Object.keys(funktionen) as (keyof Funktionen)[]) {
      funktionen[schluessel] = true;
    }
    const an = { funktionen, ebenen: standardEbenen() };
    for (const eintrag of BEREICH_SCHALTER) {
      if (!istFunktion(eintrag.schalter)) {
        continue;
      }
      const seite = SEITEN.find((kandidat) => kandidat.schalter === eintrag.schalter);
      if (!seite) {
        continue;
      }
      const aus = { funktionen: { ...funktionen, [eintrag.schalter]: false }, ebenen: standardEbenen() };
      expect(pfadAktiv(seite.pfad, aus)).toBe(false);
      expect(pfadAktiv(seite.pfad, an)).toBe(true);
      expect(SEITEN.some((kandidat) => kandidat.profilzeile && kandidat.schalter === eintrag.schalter)).toBe(
        seite.profilzeile,
      );
    }
  });

  it('blendet die Zeile ausgeschalteter Bereiche aus', () => {
    const funktionen: Funktionen = { ...standardFunktionen() };
    for (const schluessel of Object.keys(funktionen) as (keyof Funktionen)[]) {
      funktionen[schluessel] = true;
    }
    const an = { funktionen, ebenen: standardEbenen() };
    expect(UEBERSICHT_KARTEN.filter((karte) => karteSichtbar(karte.id, an)).map((karte) => karte.id)).toEqual([
      ...UEBERSICHT_KARTEN.map((karte) => karte.id),
    ]);
    expect(karteSichtbar('bosse', { funktionen: { ...funktionen, bossAngriffe: false }, ebenen: standardEbenen() })).toBe(
      false,
    );
    expect(karteSichtbar('basis', { funktionen: { ...funktionen, basis: false }, ebenen: standardEbenen() })).toBe(false);
    expect(
      karteSichtbar('comeback', { funktionen, ebenen: { ...standardEbenen(), vorhaben: false } }),
    ).toBe(false);
    expect(karteSichtbar('identitaet', { funktionen: { ...funktionen, basis: false }, ebenen: standardEbenen() })).toBe(
      true,
    );
    expect(karteSichtbar('aktivitaet', an)).toBe(true);
    expect(
      karteSichtbar('werte', { funktionen: { ...funktionen, koennen: false, status: true }, ebenen: standardEbenen() }),
    ).toBe(true);
  });
});
