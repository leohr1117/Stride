import { describe, expect, it } from 'vitest';
import type { SchnellStueck } from '../../../../shared/spiel/schnelleingabe.ts';
import type { SchnellKontext } from './schnellStand.ts';
import {
  anfangsStand,
  bereinigterName,
  ergebnisVon,
  kreuz,
  nebenweg,
  nebenwege,
  schiebeSpannen,
  tippe,
  uebernimmVorschlag,
  vorschlagAmCursor,
} from './schnellStand.ts';

const HEUTE = '2026-10-24';

const kontext: SchnellKontext = {
  heute: HEUTE,
  sprache: 'de',
  projekte: [
    { id: 1, name: 'Geld' },
    { id: 2, name: 'Haus' },
  ],
  organisationen: [{ id: 3, name: 'Arbeit' }],
  visionen: [{ id: 4, name: 'Ruhiger Alltag' }],
  ebenen: { projekte: true, organisationen: true, visionen: true },
};

function leer(name = '') {
  return anfangsStand(
    {
      name,
      faelligAm: '',
      faelligUm: '',
      prioritaet: null,
      projektId: null,
      organisationId: null,
      visionId: null,
    },
    kontext,
  );
}

function termin(name: string): SchnellStueck {
  const stand = tippe(leer(), name, kontext);
  const stueck = ergebnisVon(stand, kontext).stuecke.find((eintrag) => eintrag.art === 'termin');
  if (!stueck) {
    throw new Error('kein Termin');
  }
  return stueck;
}

describe('schiebeSpannen', () => {
  it('zieht eine Spanne mit, wenn davor Text dazukommt', () => {
    expect(schiebeSpannen('Arzt morgen', 'XArzt morgen', [{ von: 5, bis: 11 }])).toEqual([{ von: 6, bis: 12 }]);
  });

  it('lässt eine Spanne stehen, wenn danach Text dazukommt', () => {
    expect(schiebeSpannen('Arzt morgen', 'Arzt morgen!', [{ von: 5, bis: 11 }])).toEqual([{ von: 5, bis: 11 }]);
  });

  it('verwirft eine Spanne, deren Text sich ändert', () => {
    expect(schiebeSpannen('Arzt morgen', 'Arzt mXorgen', [{ von: 5, bis: 11 }])).toEqual([]);
  });
});

describe('tippe', () => {
  it('setzt Datum, Uhrzeit, Priorität und Projekt aus dem Mockup-Namen', () => {
    const stand = tippe(leer(), 'Arzt anrufen morgen 9 Uhr p1 #Geld', kontext);
    expect(stand.name).toBe('Arzt anrufen morgen 9 Uhr p1 #Geld');
    expect(stand.faelligAm).toBe('2026-10-25');
    expect(stand.faelligUm).toBe('09:00');
    expect(stand.prioritaet).toBe(1);
    expect(stand.projektId).toBe(1);
    expect(stand.herkunft.datum).toBe('stueck');
    expect(ergebnisVon(stand, kontext).stuecke.map((stueck) => stueck.text)).toEqual(['morgen 9 Uhr', 'p1', '#Geld']);
    expect(bereinigterName(stand, kontext)).toBe('Arzt anrufen');
  });

  it('lässt einen Namen leer, der nur aus Stücken besteht', () => {
    const stand = tippe(leer(), 'morgen 9 Uhr', kontext);
    expect(bereinigterName(stand, kontext)).toBe('');
  });

  it('setzt Organisation und Vision', () => {
    const arbeit = tippe(leer(), 'Anruf +Arbeit', kontext);
    expect(arbeit.organisationId).toBe(3);
    const vision = tippe(leer(), 'Anruf *Ruhiger Alltag', kontext);
    expect(vision.visionId).toBe(4);
    expect(bereinigterName(vision, kontext)).toBe('Anruf');
  });

  it('setzt ein Präfix nicht und merkt sich die Vorschläge', () => {
    const stand = tippe(leer(), 'Arzt #G', kontext);
    const ergebnis = ergebnisVon(stand, kontext);
    expect(stand.projektId).toBeNull();
    expect(ergebnis.stuecke).toEqual([]);
    expect(ergebnis.vorschlaege[0]?.treffer.map((treffer) => treffer.name)).toEqual(['Geld']);
    expect(vorschlagAmCursor(ergebnis.vorschlaege, stand.name.length)?.praefix).toBe('G');
    expect(vorschlagAmCursor(ergebnis.vorschlaege, 0)).toBeNull();
  });

  it('behält ein gleiches Nebenfeld als Hand, damit das Kreuz es nicht leert', () => {
    const stand = anfangsStand(
      {
        name: 'Arzt morgen',
        faelligAm: '2026-10-25',
        faelligUm: '',
        prioritaet: null,
        projektId: null,
        organisationId: null,
        visionId: null,
      },
      kontext,
    );
    expect(stand.herkunft.datum).toBe('hand');
    const nach = kreuz(stand, termin('Arzt morgen'), kontext);
    expect(nach.faelligAm).toBe('2026-10-25');
    expect(nach.name).toBe('Arzt morgen');
  });
});

describe('kreuz und Nebenweg', () => {
  it('leert Datum und Uhrzeit, lässt den Wortlaut stehen und erkennt ihn nicht wieder', () => {
    const stand = tippe(leer(), 'Arzt anrufen morgen 9 Uhr', kontext);
    const nach = kreuz(stand, termin('Arzt anrufen morgen 9 Uhr'), kontext);
    expect(nach.name).toBe('Arzt anrufen morgen 9 Uhr');
    expect(nach.faelligAm).toBe('');
    expect(nach.faelligUm).toBe('');
    expect(bereinigterName(nach, kontext)).toBe('Arzt anrufen morgen 9 Uhr');
    const weiter = tippe(nach, `${nach.name} `, kontext);
    expect(weiter.faelligAm).toBe('');
  });

  it('behält beim Datum den neuen Wert und die Uhrzeit aus demselben Stück', () => {
    const stand = tippe(leer(), 'Arzt morgen 9 Uhr', kontext);
    const nach = nebenweg(stand, 'datum', '2026-12-01', kontext);
    expect(nach.faelligAm).toBe('2026-12-01');
    expect(nach.faelligUm).toBe('09:00');
    expect(nach.herkunft.uhrzeit).toBe('hand');
    expect(bereinigterName(nach, kontext)).toBe('Arzt morgen 9 Uhr');
  });

  it('leert Datum und Uhrzeit zusammen, ohne das Datum wiederherzustellen', () => {
    const stand = tippe(leer(), 'Arzt morgen 9 Uhr', kontext);
    const nach = nebenwege(stand, { datum: null, uhrzeit: null }, kontext);
    expect(nach.faelligAm).toBe('');
    expect(nach.faelligUm).toBe('');
  });

  it('übernimmt einen Vorschlag in das Stück und setzt die Id', () => {
    const stand = tippe(leer(), 'Arzt #', kontext);
    const vorschlag = ergebnisVon(stand, kontext).vorschlaege[0];
    const geld = vorschlag?.treffer.find((treffer) => treffer.name === 'Geld');
    if (!vorschlag || !geld) {
      throw new Error('kein Vorschlag');
    }
    const nach = uebernimmVorschlag(stand, vorschlag, geld, kontext);
    expect(nach.name).toBe('Arzt #Geld');
    expect(nach.projektId).toBe(1);
    expect(vorschlagAmCursor(ergebnisVon(nach, kontext).vorschlaege, nach.name.length)).toBeNull();
  });

  it('schiebt eine entlassene Spanne mit, wenn davor etwas getippt wird', () => {
    const stand = kreuz(tippe(leer(), 'Arzt morgen', kontext), termin('Arzt morgen'), kontext);
    const nach = tippe(stand, `X${stand.name}`, kontext);
    expect(nach.faelligAm).toBe('');
    expect(nach.entlassen[0]).toEqual({ von: 6, bis: 12 });
  });
});
