import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { PlanEintragDaten } from '../../../shared/api/training.ts';
import { WOCHENTAG_FORMAT } from '../../../shared/spiel/aufgabe.ts';
import {
  ART_GENUTZT,
  AUFWAERM_BRAUCHT_SAETZE,
  DAUER_OHNE_GEWICHT,
  KRAFT_BRAUCHT_WIEDERHOLUNGEN,
  SAETZE_HINWEIS,
  UEBUNG_ART_KONFLIKT,
  UEBUNG_SCHON_DA,
  VORGABE_MISCHUNG,
} from '../../../shared/spiel/training.ts';
import { ausfuehren, eine, mitWelt, schliesseWelt } from '../../db.ts';
import { loescheProjekt, loescheVorlage } from '../../services/loeschen.ts';
import { erstelleProjekt } from '../../services/struktur.ts';
import { trainingsplanSchema } from '../../validierung.ts';
import { aendereEinstellungen, ladeEinstellungen } from '../einstellungen/einstellungen.ts';
import { erstelleVorlage } from '../taetigkeiten/vorlagen.ts';
import {
  aendereTrainingsplan,
  erstelleTrainingsplan,
  ladeTrainingsplaene,
  loescheTrainingsplan,
} from './plaene.ts';
import { aendereUebung, erstelleUebung, ladeUebungen, loescheUebung } from './uebungen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-training-'));
const offen: string[] = [];
let nummer = 0;
const ARCHIV = 'Das ist schon genutzt und kann nur archiviert werden.';

function welt(): string {
  nummer += 1;
  const datei = path.join(ordner, `${nummer}.db`);
  offen.push(datei);
  return datei;
}

afterEach(() => {
  for (const datei of offen) {
    schliesseWelt(datei);
  }
  offen.length = 0;
});

function anzahl(tabelle: string): number {
  return eine<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tabelle}`)?.n ?? 0;
}

function an(): void {
  aendereEinstellungen({ funktionen: { training: true } });
}

function vorlage(name = 'Training'): number {
  const attributId = eine<{ id: number }>(`SELECT id FROM attribute WHERE kennung = 'koerper'`)?.id;
  if (attributId === undefined) {
    throw new Error('Körper fehlt.');
  }
  return erstelleVorlage({ name, icon: 'dumbbell', gewichte: [{ attributId, gewicht: 1 }] }).id;
}

function kraft(name: string, extra: Partial<PlanEintragDaten> = {}): PlanEintragDaten {
  return {
    name,
    art: 'kraft',
    zielSaetze: 3,
    zielWiederholungen: 5,
    zielGewichtG: 80000,
    zielSekunden: null,
    aufwaermSaetze: null,
    aufwaermWiederholungen: null,
    aufwaermGewichtG: null,
    aufwaermSekunden: null,
    ...extra,
  };
}

function plan(name: string, uebungen: PlanEintragDaten[] = [], vorlageId = vorlage()) {
  return erstelleTrainingsplan({ name, wochentage: [5, 1, 1], projektId: null, vorlageId, uebungen });
}

describe('Übungen und Pläne', () => {
  it('liefert bei ausgeschaltetem Schalter nichts und lässt die Zeilen stehen', () => {
    mitWelt(welt(), () => {
      expect(ladeTrainingsplaene()).toEqual([]);
      expect(ladeUebungen()).toEqual([]);
      expect(() => plan('Leer', [])).toThrow('Training ist ausgeschaltet.');
      an();
      const angelegt = plan('Bleibt', [kraft('Kniebeuge')]);
      aendereEinstellungen({ funktionen: { training: false } });
      expect(ladeTrainingsplaene()).toEqual([]);
      expect(ladeUebungen()).toEqual([]);
      expect(() => loescheTrainingsplan(angelegt.id)).toThrow('Training ist ausgeschaltet.');
      expect(() => loescheUebung(angelegt.uebungen[0]?.uebungId ?? 0)).toThrow('Training ist ausgeschaltet.');
      expect(anzahl('trainingsplaene')).toBe(1);
      expect(anzahl('uebungen')).toBe(1);
    });
  });

  it('legt eine Übung beim Plan an, sortiert die Tage und benutzt denselben Namen wieder', () => {
    mitWelt(welt(), () => {
      an();
      const vorlageId = vorlage();
      const leer = plan('Leer', [], vorlageId);
      expect(leer.wochentage).toEqual([1, 5]);
      expect(leer.uebungen).toEqual([]);
      expect(leer.vorlageName).toBe('Training');
      expect(leer.loeschbar).toBe(true);
      const erster = plan('Unterkörper', [kraft('Kniebeuge', { aufwaermSaetze: 2, aufwaermWiederholungen: 5, aufwaermGewichtG: 40000 })], vorlageId);
      const zweiter = plan('Ganzkörper', [kraft('Kniebeuge'), kraft('Klimmzug', { zielGewichtG: null, zielWiederholungen: 8 })], vorlageId);
      expect(anzahl('uebungen')).toBe(2);
      expect(zweiter.uebungen[0]?.uebungId).toBe(erster.uebungen[0]?.uebungId);
      expect(erster.uebungen[0]).toMatchObject({ name: 'Kniebeuge', art: 'kraft', aufwaermSaetze: 2, aufwaermGewichtG: 40000 });
      expect(zweiter.uebungen.map((eintrag) => eintrag.name)).toEqual(['Kniebeuge', 'Klimmzug']);
    });
  });

  it('lehnt die andere Art ab und rollt den Plan zurück', () => {
    mitWelt(welt(), () => {
      an();
      const vorlageId = vorlage();
      erstelleUebung({ name: 'Kniebeuge', art: 'dauer' });
      expect(() => plan('Streit', [kraft('Kniebeuge')], vorlageId)).toThrow(UEBUNG_ART_KONFLIKT);
      expect(anzahl('trainingsplaene')).toBe(0);
      expect(anzahl('uebungen')).toBe(1);
      expect(() =>
        plan('Neu', [kraft('Bankdrücken'), { ...kraft('Bankdrücken'), art: 'dauer', zielWiederholungen: null, zielGewichtG: null, zielSekunden: 30 }], vorlageId),
      ).toThrow(UEBUNG_ART_KONFLIKT);
      expect(anzahl('trainingsplaene')).toBe(0);
      expect(anzahl('uebungen')).toBe(1);
    });
  });

  it('prüft Art, Sätze, Gewicht, Wochentag und die Tätigkeit', () => {
    mitWelt(welt(), () => {
      an();
      const vorlageId = vorlage();
      expect(() => erstelleTrainingsplan({ name: 'Ohne', wochentage: [8], projektId: null, vorlageId, uebungen: [] })).toThrow(WOCHENTAG_FORMAT);
      expect(() => erstelleTrainingsplan({ name: '  ', wochentage: [], projektId: null, vorlageId, uebungen: [] })).toThrow(/leer/);
      expect(() => erstelleTrainingsplan({ name: 'Frei', wochentage: [], projektId: null, vorlageId: null, uebungen: [] })).toThrow('Wähle eine Tätigkeit.');
      expect(() => plan('Zu viel', [kraft('Kniebeuge', { zielSaetze: 21 })], vorlageId)).toThrow(SAETZE_HINWEIS);
      expect(() => plan('Ohne Reps', [kraft('Kniebeuge', { zielWiederholungen: null })], vorlageId)).toThrow(KRAFT_BRAUCHT_WIEDERHOLUNGEN);
      expect(() => plan('Beides', [kraft('Kniebeuge', { zielSekunden: 30 })], vorlageId)).toThrow(VORGABE_MISCHUNG);
      expect(() => plan('Dauer', [{ ...kraft('Plank'), art: 'dauer', zielWiederholungen: null, zielGewichtG: 1, zielSekunden: 60 }], vorlageId)).toThrow(DAUER_OHNE_GEWICHT);
      expect(() => plan('Warm', [kraft('Kniebeuge', { aufwaermGewichtG: 1000 })], vorlageId)).toThrow(AUFWAERM_BRAUCHT_SAETZE);
      const dauer = plan('Halten', [{ ...kraft('Plank'), art: 'dauer', zielWiederholungen: null, zielGewichtG: null, zielSekunden: 60, aufwaermSaetze: 1, aufwaermSekunden: 20 }], vorlageId);
      expect(dauer.uebungen[0]).toMatchObject({ art: 'dauer', zielSekunden: 60, aufwaermSekunden: 20, zielGewichtG: null });
      const band = plan('Band', [{ ...kraft('Laufband'), art: 'dauer', zielSaetze: null, zielWiederholungen: null, zielGewichtG: null, zielSekunden: 600 }], vorlageId);
      expect(band.uebungen[0]).toMatchObject({ zielSaetze: null, zielSekunden: 600, zielGewichtG: null });
      expect(anzahl('trainingsplaene')).toBe(2);
    });
  });

  it('archiviert ohne die Einträge anzufassen und ersetzt die Liste in der neuen Reihenfolge', () => {
    mitWelt(welt(), () => {
      an();
      const vorlageId = vorlage();
      const angelegt = plan('Unterkörper', [kraft('Kniebeuge')], vorlageId);
      const archiv = aendereTrainingsplan(angelegt.id, { archiviert: true });
      expect(archiv.uebungen).toHaveLength(1);
      expect(ladeTrainingsplaene(false)).toEqual([]);
      expect(ladeTrainingsplaene(true)[0]?.name).toBe('Unterkörper');
      const wieder = aendereTrainingsplan(angelegt.id, {
        archiviert: false,
        name: 'Neu',
        uebungen: [kraft('Klimmzug', { zielGewichtG: null, zielWiederholungen: 8 }), kraft('Kniebeuge')],
      });
      expect(wieder.name).toBe('Neu');
      expect(wieder.uebungen.map((eintrag) => eintrag.name)).toEqual(['Klimmzug', 'Kniebeuge']);
      expect(aendereTrainingsplan(angelegt.id, { name: 'Nur Name' }).uebungen).toHaveLength(2);
    });
  });

  it('legt Übungen nur einmal an und lässt die Art einer genutzten Übung', () => {
    mitWelt(welt(), () => {
      an();
      const vorlageId = vorlage();
      const erste = erstelleUebung({ name: '  Kniebeuge ', art: 'kraft' });
      expect(erste.name).toBe('Kniebeuge');
      expect(erste.loeschbar).toBe(true);
      expect(() => erstelleUebung({ name: 'Kniebeuge', art: 'kraft' })).toThrow(UEBUNG_SCHON_DA);
      expect(() => erstelleUebung({ name: 'Kniebeuge', art: 'dauer' })).toThrow(UEBUNG_ART_KONFLIKT);
      expect(aendereUebung(erste.id, { art: 'dauer' }).art).toBe('dauer');
      plan('Drin', [kraft('Bank')], vorlageId);
      const gebunden = ladeUebungen().find((eintrag) => eintrag.name === 'Bank');
      expect(gebunden?.loeschbar).toBe(false);
      expect(() => aendereUebung(gebunden?.id ?? 0, { art: 'dauer' })).toThrow(ART_GENUTZT);
      expect(() => aendereUebung(999, { name: 'Fehlt' })).toThrow('Die Übung wurde nicht gefunden.');
      aendereUebung(erste.id, { archiviert: true });
      expect(ladeUebungen(false).some((eintrag) => eintrag.name === 'Kniebeuge')).toBe(false);
      expect(ladeUebungen(true).some((eintrag) => eintrag.archiviert && eintrag.name === 'Kniebeuge')).toBe(true);
    });
  });

  it('löscht nur Ungenutztes und lässt eine vorhandene Einheit stehen', () => {
    mitWelt(welt(), () => {
      an();
      const vorlageId = vorlage();
      const angelegt = plan('Unterkörper', [kraft('Kniebeuge', { zielGewichtG: 80000 })], vorlageId);
      const uebungId = angelegt.uebungen[0]?.uebungId ?? 0;
      expect(() => loescheUebung(uebungId)).toThrow(ARCHIV);
      const einheit = ausfuehren(
        `INSERT INTO trainingseinheiten (plan_id, status, begonnen_am) VALUES (?, 'offen', ?)`,
        angelegt.id,
        '2026-10-24T08:00:00.000Z',
      ).id;
      const satz = ausfuehren(
        `INSERT INTO trainingssaetze (einheit_id, uebung_id, reihenfolge, gewicht_g, wiederholungen) VALUES (?, ?, 1, 80000, 5)`,
        einheit,
        uebungId,
      ).id;
      aendereTrainingsplan(angelegt.id, { uebungen: [kraft('Kniebeuge', { zielGewichtG: 100000 })] });
      expect(eine<{ g: number }>('SELECT gewicht_g AS g FROM trainingssaetze WHERE id = ?', satz)?.g).toBe(80000);
      expect(eine<{ status: string }>('SELECT status FROM trainingseinheiten WHERE id = ?', einheit)?.status).toBe('offen');
      expect(() => loescheTrainingsplan(angelegt.id)).toThrow(ARCHIV);
      expect(anzahl('trainingsplaene')).toBe(1);

      const frei = erstelleUebung({ name: 'Frei', art: 'kraft' });
      const andere = erstelleUebung({ name: 'Andere', art: 'kraft' });
      ausfuehren(
        `INSERT INTO bestwerte (uebung_id, art, wert, wiederholungen, satz_id, erreicht_am) VALUES (?, 'gewicht', 80000, 5, ?, ?)`,
        andere.id,
        satz,
        '2026-10-24T08:00:00.000Z',
      );
      expect(() => loescheUebung(andere.id)).toThrow(ARCHIV);
      loescheUebung(frei.id);
      expect(anzahl('uebungen')).toBe(2);

      const ohne = plan('Ohne', [], vorlageId);
      loescheTrainingsplan(ohne.id);
      expect(ladeTrainingsplaene().some((eintrag) => eintrag.id === ohne.id)).toBe(false);
    });
  });

  it('blockiert Projekt und Tätigkeit, solange ein Plan darauf zeigt', () => {
    mitWelt(welt(), () => {
      an();
      const standard = vorlage('Standard');
      const extra = vorlage('Extra');
      const projekt = erstelleProjekt({
        name: 'Haus',
        beschreibung: '',
        visionId: null,
        organisationId: null,
        standardVorlageId: standard,
      });
      const angelegt = erstelleTrainingsplan({
        name: 'Drin',
        wochentage: [],
        projektId: projekt.id,
        vorlageId: extra,
        uebungen: [],
      });
      expect(angelegt.projektName).toBe('Haus');
      expect(() => loescheProjekt(projekt.id)).toThrow(ARCHIV);
      expect(() => loescheVorlage(extra)).toThrow(ARCHIV);
      loescheTrainingsplan(angelegt.id);
      loescheVorlage(extra);
      loescheProjekt(projekt.id);
      loescheVorlage(standard);
      expect(anzahl('trainingsplaene')).toBe(0);
      expect(anzahl('projekte')).toBe(0);
      expect(anzahl('vorlagen')).toBe(0);
    });
  });

  it('liest und schreibt die Gewichtseinheit und fällt sonst auf kg zurück', () => {
    mitWelt(welt(), () => {
      expect(ladeEinstellungen().gewichtEinheit).toBe('kg');
      expect(aendereEinstellungen({ gewichtEinheit: 'lb' }).gewichtEinheit).toBe('lb');
      expect(ladeEinstellungen().gewichtEinheit).toBe('lb');
      ausfuehren(`UPDATE einstellungen SET wert = ? WHERE schluessel = 'gewicht_einheit'`, '"stein"');
      expect(ladeEinstellungen().gewichtEinheit).toBe('kg');
      ausfuehren(`UPDATE einstellungen SET wert = ? WHERE schluessel = 'gewicht_einheit'`, 'kaputt');
      expect(ladeEinstellungen().gewichtEinheit).toBe('kg');
      expect(trainingsplanSchema.safeParse({ name: '', wochentage: [], projektId: null, vorlageId: null, uebungen: [] }).success).toBe(false);
      expect(
        trainingsplanSchema.safeParse({
          name: 'Plan',
          wochentage: [1],
          projektId: null,
          vorlageId: null,
          uebungen: [{ ...kraft('Kniebeuge'), zielSaetze: 0 }],
        }).success,
      ).toBe(false);
      expect(
        trainingsplanSchema.safeParse({
          name: 'Plan',
          wochentage: [],
          projektId: null,
          vorlageId: null,
          uebungen: [{ ...kraft('Laufband'), art: 'dauer', zielSaetze: null, zielWiederholungen: null, zielGewichtG: null, zielSekunden: 600 }],
        }).success,
      ).toBe(true);
    });
  });
});
