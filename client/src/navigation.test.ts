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
  it('zählt Tätigkeiten am PC als Leistenplatz', () => {
    const pfade = seitenleistenPfade(standardFunktionen(), standardEbenen());
    expect(pfade.filter((pfad) => pfad === '/mehr/inhalte')).toEqual(['/mehr/inhalte']);
  });
});

describe('Seitenleiste aus der Tabelle', () => {
  it('behält die Gruppen und liest Namen aus der Seitentabelle', () => {
    const gruppen = sichtbareGruppen(alleAn(), standardEbenen());
    expect(gruppen.map((gruppe) => gruppe.titel)).toEqual([null, 'Reise']);
    const pfade = gruppen.flatMap((gruppe) => gruppe.eintraege.map((eintrag) => eintrag.pfad));
    expect(pfade).toEqual(['/', '/laufend', '/basis', '/ziele', '/chronik', '/rueckblick', '/statistiken', '/vorbilder']);
    for (const eintrag of gruppen.flatMap((gruppe) => gruppe.eintraege)) {
      expect(eintrag.label).toBe(SEITEN.find((seite) => seite.pfad === eintrag.pfad)?.name);
      expect(eintrag.icon).toBeTruthy();
    }
    expect(seitenleistenPfade(alleAn(), standardEbenen())).toEqual([
      ...pfade,
      '/mehr/inhalte',
      '/handbuch',
      '/mehr',
      '/charakter',
    ]);
  });
});

