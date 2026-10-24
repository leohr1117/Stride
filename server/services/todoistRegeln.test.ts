import { describe, expect, it } from 'vitest';
import {
  fuehreRegelnZusammen,
  istNachtstunde,
  istTodoistFaellig,
  notizFuerEintrag,
  stundeInZone,
  stundenAusDauer,
  type RegelQuelle,
} from './todoistRegeln.ts';

function quelle(teil: Partial<RegelQuelle> = {}): RegelQuelle {
  return {
    zielArt: null,
    zielId: null,
    projektId: null,
    vorlageId: null,
    stunden: null,
    faehigkeitId: null,
    abschluss: null,
    erkenntnis: '',
    notiz: '',
    meilenstein: null,
    ...teil,
  };
}

describe('stundenAusDauer', () => {
  it('rechnet Minuten und Tage in den erlaubten Bereich', () => {
    expect(stundenAusDauer(null)).toBeNull();
    expect(stundenAusDauer(undefined)).toBeNull();
    expect(stundenAusDauer({ amount: 0, unit: 'minute' })).toBeNull();
    expect(stundenAusDauer({ amount: 10, unit: 'minute' })).toBe(0.25);
    expect(stundenAusDauer({ amount: 30, unit: 'minute' })).toBe(0.5);
    expect(stundenAusDauer({ amount: 90, unit: 'minute' })).toBe(1.5);
    expect(stundenAusDauer({ amount: 1, unit: 'day' })).toBe(24);
    expect(stundenAusDauer({ amount: 3, unit: 'day' })).toBe(24);
  });
});

describe('nacht', () => {
  it('kennt die Ortszeit und bremst nur nachts', () => {
    expect(istNachtstunde(23)).toBe(true);
    expect(istNachtstunde(5)).toBe(true);
    expect(istNachtstunde(6)).toBe(false);
    expect(istNachtstunde(22)).toBe(false);
    expect(stundeInZone(new Date('2026-01-15T22:30:00.000Z'), 'Europe/Berlin')).toBe(23);
    expect(stundeInZone(new Date('2026-07-15T21:00:00.000Z'), 'Europe/Berlin')).toBe(23);
    expect(stundeInZone(new Date('2026-07-15T20:00:00.000Z'), 'Europe/Berlin')).toBe(22);
    expect(stundeInZone(new Date('2026-07-15T04:00:00.000Z'), 'Europe/Berlin')).toBe(6);
    expect(stundeInZone(new Date('2026-07-15T21:00:00.000Z'), 'Kein/Zone')).toBeNull();

    const nacht = new Date('2026-07-15T21:00:00.000Z');
    const tag = new Date('2026-07-15T20:00:00.000Z');
    const frueh = new Date('2026-07-15T04:00:00.000Z');
    const vorKurzem = new Date(nacht.getTime() - 60 * 60 * 1000).toISOString();
    const vorLangem = new Date(nacht.getTime() - 3 * 60 * 60 * 1000).toISOString();
    expect(istTodoistFaellig(nacht, 'Europe/Berlin', null)).toBe(true);
    expect(istTodoistFaellig(nacht, 'Europe/Berlin', vorKurzem)).toBe(false);
    expect(istTodoistFaellig(nacht, 'Europe/Berlin', vorLangem)).toBe(true);
    expect(istTodoistFaellig(tag, 'Europe/Berlin', vorKurzem)).toBe(true);
    expect(istTodoistFaellig(frueh, 'Europe/Berlin', vorKurzem)).toBe(true);
    expect(istTodoistFaellig(nacht, 'Kein/Zone', vorKurzem)).toBe(true);
    expect(istTodoistFaellig(new Date('2026-01-15T22:30:00.000Z'), 'Europe/Berlin', new Date('2026-01-15T22:00:00.000Z').toISOString())).toBe(false);
  });
});

describe('fuehreRegelnZusammen', () => {
  it('nimmt pro Feld die oberste gesetzte Regel und danach das Projekt', () => {
    const oben = quelle({ vorlageId: 3, stunden: null, notiz: '' });
    const unten = quelle({ vorlageId: 9, faehigkeitId: 4, stunden: 2, notiz: 'leise' });
    const basis = quelle({ zielArt: 'projekt', zielId: 1, projektId: 1, vorlageId: 8, stunden: 1, meilenstein: false, notiz: 'basis' });
    const ergebnis = fuehreRegelnZusammen([oben, unten], basis);
    expect(ergebnis.vorlageId).toBe(3);
    expect(ergebnis.faehigkeitId).toBe(4);
    expect(ergebnis.stunden).toBe(2);
    expect(ergebnis.zielId).toBe(1);
    expect(ergebnis.notiz).toBe('leise');
  });

  it('leert mit Dauer 0, Fähigkeit 0 und Dran geblieben, ohne leere Notiz', () => {
    const label = quelle({ stunden: 0, faehigkeitId: 0, abschluss: 'offen', erkenntnis: '', notiz: '   ' });
    const basis = quelle({
      zielArt: 'vorhaben',
      zielId: 5,
      projektId: 1,
      stunden: 1,
      faehigkeitId: 7,
      abschluss: 'geschafft',
      erkenntnis: 'alt',
      notiz: 'bleibt',
      meilenstein: true,
    });
    const ergebnis = fuehreRegelnZusammen([label], basis);
    expect(ergebnis.stunden).toBeNull();
    expect(ergebnis.faehigkeitId).toBeNull();
    expect(ergebnis.abschluss).toBeNull();
    expect(ergebnis.erkenntnis).toBe('alt');
    expect(ergebnis.notiz).toBe('bleibt');
    expect(ergebnis.meilenstein).toBe(true);
  });

  it('holt die Erkenntnis der nächsten Regel, wenn die Stand-Regel leer ist', () => {
    const oben = quelle({ abschluss: 'gescheitert', erkenntnis: '  ' });
    const unten = quelle({ erkenntnis: 'mehr Pausen' });
    expect(fuehreRegelnZusammen([oben, unten], null).erkenntnis).toBe('mehr Pausen');
    expect(notizFuerEintrag('Kapitel', 'leise')).toBe('Kapitel\nleise');
    expect(notizFuerEintrag('  ', '')).toBe('');
  });
});
