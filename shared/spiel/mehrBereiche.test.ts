import { describe, expect, it } from 'vitest';
import { MEHR_BEREICHE, MEHR_BEREICH_IDS, sichtbareMehrBereiche } from './mehrBereiche.ts';

describe('MEHR_BEREICHE', () => {
  it('ordnet die Einstellungen, ohne Tätigkeiten und mit Verbindungen vor Bereichen', () => {
    expect(MEHR_BEREICHE.map((bereich) => bereich.id)).toEqual([...MEHR_BEREICH_IDS]);
    expect(MEHR_BEREICHE.map((bereich) => bereich.pfad)).toEqual([
      '/mehr/profil',
      '/mehr/inhalte/verbindungen',
      '/mehr/funktionen',
      '/mehr/uebersicht',
      '/mehr/darstellung',
      '/mehr/benachrichtigungen',
      '/mehr/daten',
    ]);
    expect(MEHR_BEREICHE.map((bereich) => bereich.label)).toEqual([
      'Konto',
      'Verbindungen',
      'Bereiche',
      'Karten auf Heute',
      'Darstellung',
      'Benachrichtigungen',
      'Daten',
    ]);
    expect(MEHR_BEREICHE.some((bereich) => bereich.pfad === '/mehr/inhalte' || bereich.label === 'Tätigkeiten')).toBe(false);
    const ids = MEHR_BEREICHE.map((bereich) => bereich.id);
    expect(ids.indexOf('daten')).toBe(ids.indexOf('benachrichtigungen') + 1);
    expect(sichtbareMehrBereiche().map((bereich) => bereich.id)).toEqual([...MEHR_BEREICH_IDS]);
  });
});
