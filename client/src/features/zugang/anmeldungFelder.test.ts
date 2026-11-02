import { describe, expect, it } from 'vitest';
import { seitenwechsel } from './anmeldungFelder.ts';

describe('seitenwechsel', () => {
  it('schiebt nach der Anmeldung denselben Ort auf den Verlauf', () => {
    const aufrufe: unknown[][] = [];
    const zustand = { idx: 0, key: 'a' };
    seitenwechsel({
      history: {
        state: zustand,
        pushState: (...args: unknown[]) => {
          aufrufe.push(args);
        },
      },
      location: { pathname: '/mehr/profil/passwort', search: '?x=1', hash: '#oben' },
    });
    expect(aufrufe).toEqual([[zustand, '', '/mehr/profil/passwort?x=1#oben']]);
  });
});
