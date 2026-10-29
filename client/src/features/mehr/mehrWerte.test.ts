import { describe, expect, it } from 'vitest';
import { standardEbenen, type Ebenen } from '../../../../shared/spiel/ebenen.ts';
import { standardFunktionen, type Funktionen } from '../../../../shared/spiel/funktionen.ts';
import type { FunktionsAttribute, Sichtbarkeit } from '../../../../shared/spiel/sichtbarkeit.ts';
import { setzeAktiveSprache } from '../../../../shared/sprache/index.ts';
import { bereicheAn, kartenStand, verbindungsKurz } from './mehrWerte.ts';

function sicht(teil: {
  funktionen?: Partial<Funktionen>;
  ebenen?: Partial<Ebenen>;
  attribute?: FunktionsAttribute;
} = {}): Sichtbarkeit {
  return {
    funktionen: { ...standardFunktionen(), ...teil.funktionen },
    ebenen: { ...standardEbenen(), ...teil.ebenen },
    attribute: teil.attribute,
  };
}

describe('Werte unter Mehr', () => {
  it('zählt eingeschaltete Funktionen und gespeicherte Ebenen', () => {
    expect(bereicheAn(sicht())).toBe(8);
    expect(
      bereicheAn(
        sicht({
          funktionen: { bossAngriffe: true },
          attribute: { disziplin: true, ressourcen: false },
        }),
      ),
    ).toBe(9);
    expect(
      bereicheAn(
        sicht({
          funktionen: { bossAngriffe: true },
          ebenen: { vorhaben: false },
          attribute: { disziplin: false, ressourcen: false },
        }),
      ),
    ).toBe(7);
    expect(bereicheAn(sicht({ ebenen: { projekte: false, organisationen: true } }))).toBe(7);
  });

  it('zählt gewählte Karten von sechs', () => {
    expect(kartenStand(undefined)).toEqual({ an: 6, gesamt: 6 });
    expect(kartenStand({ identitaet: false, bosse: true })).toEqual({ an: 5, gesamt: 6 });
  });

  it('nennt verbundene Arten oder Aus', () => {
    expect(verbindungsKurz({ todoist: { verbunden: true }, kalender: [{}] })).toBe('Todoist, Kalender');
    expect(verbindungsKurz({ todoist: { verbunden: true }, kalender: [] })).toBe('Todoist');
    expect(verbindungsKurz({ todoist: { verbunden: false }, kalender: [{}] })).toBe('Kalender');
    expect(verbindungsKurz({ todoist: { verbunden: false }, kalender: [] })).toBe('Aus');
    setzeAktiveSprache('en');
    expect(verbindungsKurz({ todoist: { verbunden: true }, kalender: [{}] })).toBe('Todoist, Calendar');
    expect(verbindungsKurz({ todoist: { verbunden: false }, kalender: [] })).toBe('Off');
    setzeAktiveSprache('de');
  });
});
