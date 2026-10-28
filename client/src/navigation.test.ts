import { describe, expect, it } from 'vitest';
import { standardEbenen } from '../../shared/spiel/ebenen.ts';
import { standardFunktionen } from '../../shared/spiel/funktionen.ts';
import { seitenleistenPfade } from './navigation.ts';

describe('seitenleistenPfade', () => {
  it('zählt Tätigkeiten am PC als Leistenplatz', () => {
    const pfade = seitenleistenPfade(standardFunktionen(), standardEbenen());
    expect(pfade.filter((pfad) => pfad === '/mehr/inhalte')).toEqual(['/mehr/inhalte']);
  });
});
