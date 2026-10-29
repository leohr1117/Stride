import { describe, expect, it } from 'vitest';
import { standardEbenen } from '../../shared/spiel/ebenen.ts';
import { standardFunktionen, type Funktionen } from '../../shared/spiel/funktionen.ts';
import { SEITEN } from '../../shared/spiel/navigation.ts';
import { seitenleistenPfade, sichtbareGruppen } from './navigation.ts';

function alleAn(): Funktionen {
  const funktionen = standardFunktionen();
  for (const schluessel of Object.keys(funktionen) as (keyof Funktionen)[]) {
    funktionen[schluessel] = true;
  }
  return funktionen;
}

describe('seitenleistenPfade', () => {
  it('folgt bei Standard der sichtbaren Reihe und zählt Tätigkeiten einmal', () => {
    expect(seitenleistenPfade(standardFunktionen(), standardEbenen())).toEqual([
      '/',
      '/ziele',
      '/laufend',
      '/mehr/inhalte',
      '/chronik',
      '/charakter',
      '/koennen',
      '/haben',
      '/handbuch',
      '/mehr',
    ]);
  });
});

describe('Seitenleiste aus der Tabelle', () => {
  it('zeigt vier Blöcke ohne Überschrift, in der Reihenfolge aus 11.1', () => {
    const gruppen = sichtbareGruppen(alleAn(), standardEbenen());
    expect(gruppen.map((gruppe) => gruppe.titel)).toEqual([null, null, null, null]);
    const pfade = gruppen.flatMap((gruppe) => gruppe.eintraege.map((eintrag) => eintrag.pfad));
    expect(pfade).toEqual([
      '/',
      '/ziele',
      '/laufend',
      '/basis',
      '/mehr/inhalte',
      '/chronik',
      '/rueckblick',
      '/statistiken',
      '/vorbilder',
      '/charakter',
      '/koennen',
      '/haben',
      '/faehigkeiten',
      '/investitionen',
      '/handbuch',
    ]);
    for (const eintrag of gruppen.flatMap((gruppe) => gruppe.eintraege)) {
      const seite = SEITEN.find((kandidat) => kandidat.pfad === eintrag.pfad);
      expect(eintrag.label).toBe(seite?.name);
      expect(eintrag.icon).toBeTruthy();
    }
    expect(seitenleistenPfade(alleAn(), standardEbenen())).toEqual([...pfade, '/mehr']);
  });

  it('lässt ausgeschaltete Seiten weg und zeigt keine leere Gruppe', () => {
    const funktionen = alleAn();
    funktionen.basis = false;
    funktionen.chronik = false;
    funktionen.rueckblick = false;
    funktionen.statistiken = false;
    funktionen.vorbilder = false;
    funktionen.handbuch = false;
    const ebenen = { visionen: false, organisationen: false, projekte: false, vorhaben: false };
    const gruppen = sichtbareGruppen(funktionen, ebenen);
    const pfade = gruppen.flatMap((gruppe) => gruppe.eintraege.map((eintrag) => eintrag.pfad));
    expect(pfade).toEqual(['/', '/mehr/inhalte', '/charakter', '/koennen', '/haben', '/faehigkeiten', '/investitionen']);
    expect(gruppen.every((gruppe) => gruppe.titel === null && gruppe.eintraege.length > 0)).toBe(true);
    expect(seitenleistenPfade(funktionen, ebenen)).toEqual([...pfade, '/mehr']);
  });

  it('nimmt eingeschaltete Seiten mit gleichem Namen auf und lässt ausgeschaltete weg', () => {
    const funktionen = alleAn();
    const ebenen = standardEbenen();
    const pfade = sichtbareGruppen(funktionen, ebenen).flatMap((gruppe) => gruppe.eintraege.map((eintrag) => eintrag.pfad));
    for (const seite of SEITEN) {
      if (seite.block === null) {
        continue;
      }
      if (seite.schalter === null || seite.schalter === 'ziele' || seite.schalter === 'laufend') {
        expect(pfade).toContain(seite.pfad);
        continue;
      }
      expect(pfade).toContain(seite.pfad);
      const ohne = sichtbareGruppen({ ...funktionen, [seite.schalter]: false }, ebenen).flatMap((gruppe) =>
        gruppe.eintraege.map((eintrag) => eintrag.pfad),
      );
      expect(ohne).not.toContain(seite.pfad);
    }
  });
});


