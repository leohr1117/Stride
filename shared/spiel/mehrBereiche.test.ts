import { describe, expect, it } from 'vitest';
import { MEHR_BEREICHE, MEHR_BEREICH_IDS, sichtbareMehrBereiche } from './mehrBereiche.ts';

describe('MEHR_BEREICHE', () => {
  it('ordnet die Einstellungen und hält Benachrichtigungen zwischen App und Daten frei', () => {
    expect(MEHR_BEREICHE.map((bereich) => bereich.id)).toEqual([...MEHR_BEREICH_IDS]);
    const ids = MEHR_BEREICHE.map((bereich) => bereich.id);
    expect(ids.indexOf('benachrichtigungen')).toBe(ids.indexOf('app') + 1);
    expect(ids.indexOf('daten')).toBe(ids.indexOf('benachrichtigungen') + 1);
    expect(MEHR_BEREICHE.find((bereich) => bereich.id === 'benachrichtigungen')).toEqual({
      id: 'benachrichtigungen',
      pfad: '/mehr/benachrichtigungen',
      label: 'Benachrichtigungen',
      sichtbar: false,
    });
    expect(MEHR_BEREICHE.find((bereich) => bereich.id === 'uebersicht')?.pfad).toBe('/mehr/uebersicht');
    expect(sichtbareMehrBereiche().map((bereich) => bereich.id)).toEqual([
      'profil',
      'taetigkeiten',
      'darstellung',
      'uebersicht',
      'app',
      'daten',
    ]);
  });
});
