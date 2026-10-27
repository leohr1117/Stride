import { describe, expect, it } from 'vitest';
import {
  bestaetigungFuer,
  fuegeAktivesAttribut,
  primaerPunkt,
  punkteFuer,
  wendeQuery,
  type SchnellPunkt,
} from './schnell.ts';

function arten(punkte: SchnellPunkt[]): string[] {
  return punkte.map((punkt) => punkt.art);
}

describe('punkteFuer', () => {
  it('bietet bei Ungenutztem nur Löschen', () => {
    expect(arten(punkteFuer({ art: 'vision', loeschbar: true }))).toEqual(['loeschen']);
  });

  it('bietet bei Genutztem nur Archivieren', () => {
    expect(arten(punkteFuer({ art: 'vision', loeschbar: false }))).toEqual(['archivieren']);
  });

  it('bietet bei archiviertem Genutztem nur Wiederherstellen', () => {
    expect(arten(punkteFuer({ art: 'vorlage', archiviert: true, loeschbar: false }))).toEqual(['wiederherstellen']);
  });

  it('bietet bei archiviertem Ungenutztem Wiederherstellen und Löschen', () => {
    expect(arten(punkteFuer({ art: 'basis', archiviert: true, loeschbar: true }))).toEqual(['wiederherstellen', 'loeschen']);
  });

  it('blendet den letzten aktiven Wert aus', () => {
    expect(punkteFuer({ art: 'attribut', loeschbar: true, gesperrt: true })).toEqual([]);
  });

  it('lässt einen archivierten ungenutzten Wert trotz Sperre löschen', () => {
    expect(arten(punkteFuer({ art: 'attribut', archiviert: true, loeschbar: true, gesperrt: true }))).toEqual([
      'wiederherstellen',
      'loeschen',
    ]);
  });

  it('löscht Einträge, Kalender und Todoist immer, mit eigener Beschriftung', () => {
    expect(punkteFuer({ art: 'eintrag' })).toEqual([{ art: 'loeschen', label: 'Löschen' }]);
    expect(punkteFuer({ art: 'kalender' })).toEqual([{ art: 'loeschen', label: 'Entfernen' }]);
    expect(punkteFuer({ art: 'todoist' })).toEqual([{ art: 'loeschen', label: 'Trennen' }]);
  });

  it('versteckt den Inhaber und genutzte Knoten oder Vorhaben', () => {
    expect(punkteFuer({ art: 'konto', gesperrt: true })).toEqual([]);
    expect(punkteFuer({ art: 'konto' })).toEqual([{ art: 'loeschen', label: 'Löschen' }]);
    expect(punkteFuer({ art: 'knoten', loeschbar: false })).toEqual([]);
    expect(punkteFuer({ art: 'vorhaben', loeschbar: true })).toEqual([{ art: 'loeschen', label: 'Löschen' }]);
  });
});

describe('primaerPunkt', () => {
  it('bevorzugt Löschen vor Archivieren und Wiederherstellen', () => {
    const punkte: SchnellPunkt[] = [
      { art: 'wiederherstellen', label: 'Wiederherstellen' },
      { art: 'loeschen', label: 'Löschen' },
    ];
    expect(primaerPunkt(punkte)?.art).toBe('loeschen');
    expect(primaerPunkt([{ art: 'archivieren', label: 'Archivieren' }])?.label).toBe('Archivieren');
    expect(primaerPunkt([])).toBeNull();
  });
});

describe('bestaetigungFuer', () => {
  it('formuliert endgültige Aktionen ohne Rückgängig', () => {
    expect(bestaetigungFuer({ art: 'eintrag', id: 1, name: 'Notiz', hinweis: 'Die 12 XP werden wieder abgezogen.' })).toEqual({
      titel: 'Eintrag löschen?',
      text: 'Die 12 XP werden wieder abgezogen.',
      knopf: 'Löschen',
    });
    expect(bestaetigungFuer({ art: 'kalender', id: 2, name: 'Arbeit' }).knopf).toBe('Entfernen');
    expect(bestaetigungFuer({ art: 'todoist', id: 0, name: 'Todoist' })).toMatchObject({
      titel: 'Todoist trennen?',
      knopf: 'Trennen',
    });
    expect(bestaetigungFuer({ art: 'konto', id: 3, name: 'mia' }).text).toBe('Die Welt dieses Accounts wird mitgelöscht.');
    expect(bestaetigungFuer({ art: 'knoten', id: 4, name: 'Wurzel' }).text).toBe('Alle Skills darunter werden ebenfalls gelöscht.');
    expect(bestaetigungFuer({ art: 'vision', id: 5, name: 'Meer' })).toEqual({
      titel: 'Meer löschen?',
      text: 'Das lässt sich nicht rückgängig machen.',
      knopf: 'Löschen',
    });
  });
});

describe('wendeQuery', () => {
  it('setzt das Archiv-Flag bei Trainingsplänen', () => {
    const daten = [
      { id: 1, archiviert: false },
      { id: 2, archiviert: false },
    ];
    expect(wendeQuery(['aufgaben', false], daten, 'basis', 1, 'archivieren')).toBe(daten);
    const plaene = wendeQuery(['trainingsplaene', false], daten, 'trainingsplan', 1, 'archivieren') as typeof daten;
    expect(plaene[0]?.archiviert).toBe(true);
    expect(wendeQuery(['trainingsplaene', false], daten, 'uebung', 1, 'archivieren')).toBe(daten);
    const uebungen = wendeQuery(['uebungen'], daten, 'uebung', 2, 'entfernen') as typeof daten;
    expect(uebungen.map((eintrag) => eintrag.id)).toEqual([1]);
  });

  it('setzt das Archiv-Flag und lässt fremde Zeilen unangetastet', () => {
    const daten = { visionen: [{ id: 4, archiviert: false }, { id: 5, archiviert: false }] };
    const neu = wendeQuery(['ziele'], daten, 'vision', 4, 'archivieren') as typeof daten;
    expect(neu.visionen[0]?.archiviert).toBe(true);
    expect(neu.visionen[1]).toBe(daten.visionen[1]);
    expect(wendeQuery(['ziele'], daten, 'vision', 9, 'archivieren')).toBe(daten);
  });

  it('nimmt archivierte Attribute aus den aktiven Listen', () => {
    const daten = {
      attribute: [{ id: 1, archiviert: false }, { id: 2, archiviert: false }],
      status: [{ id: 3, archiviert: false }],
    };
    const neu = wendeQuery(['charakter'], daten, 'attribut', 1, 'archivieren') as typeof daten;
    expect(neu.attribute.map((eintrag) => eintrag.id)).toEqual([2]);
    expect(neu.status).toBe(daten.status);
  });

  it('filtert nur Chronik-Einträge und behält Skill-Ereignisse', () => {
    const daten = {
      pages: [
        {
          eintraege: [
            { typ: 'eintrag', eintrag: { id: 5 } },
            { typ: 'skill', eintrag: { id: 5 } },
            { typ: 'eintrag', eintrag: { id: 6 } },
          ],
        },
      ],
    };
    const neu = wendeQuery(['eintraege'], daten, 'eintrag', 5, 'entfernen') as typeof daten;
    expect(neu.pages[0]?.eintraege).toEqual([
      { typ: 'skill', eintrag: { id: 5 } },
      { typ: 'eintrag', eintrag: { id: 6 } },
    ]);
  });

  it('entfernt einen Skill samt Nachkommen', () => {
    const daten = {
      id: 1,
      knoten: [
        { id: 10, elternId: null },
        { id: 11, elternId: 10 },
        { id: 12, elternId: 11 },
        { id: 13, elternId: null },
      ],
    };
    const neu = wendeQuery(['faehigkeit', 1], daten, 'knoten', 10, 'entfernen') as typeof daten;
    expect(neu.knoten.map((eintrag) => eintrag.id)).toEqual([13]);
  });

  it('trennt Todoist und entfernt einen Kalender', () => {
    const daten = {
      kalender: [{ id: 1 }, { id: 2 }],
      todoist: { verbunden: true, nutzer: 'leo', projekte: [{ id: 1 }], labels: [{ id: 2 }] },
    };
    const ohneKalender = wendeQuery(['verbindungen'], daten, 'kalender', 1, 'entfernen') as typeof daten;
    expect(ohneKalender.kalender).toEqual([{ id: 2 }]);
    const getrennt = wendeQuery(['verbindungen'], daten, 'todoist', 0, 'entfernen') as {
      todoist: { verbunden: boolean; nutzer: string | null; projekte: unknown[]; labels: unknown[] };
    };
    expect(getrennt.todoist).toEqual({ verbunden: false, nutzer: null, projekte: [], labels: [] });
  });
});

describe('fuegeAktivesAttribut', () => {
  it('setzt Können und Haben zurück und lässt vorhandene Zeilen stehen', () => {
    const daten = { attribute: [{ id: 1, typ: 'attribut' }], status: [] as { id: number; typ: string }[] };
    const mitHaben = fuegeAktivesAttribut(daten, { id: 2, typ: 'status' }) as typeof daten;
    expect(mitHaben.status).toEqual([{ id: 2, typ: 'status' }]);
    expect(fuegeAktivesAttribut(mitHaben, { id: 2, typ: 'status' })).toBe(mitHaben);
    expect(fuegeAktivesAttribut('kein-objekt', { id: 1, typ: 'attribut' })).toBe('kein-objekt');
  });
});
