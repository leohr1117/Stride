import { afterEach, describe, expect, it } from 'vitest';
import { EINHEIT_LAEUFT, NUR_ABHAKEN, PLAN_ARCHIVIERT, PLAN_OHNE_EINTRAG } from '../../../shared/spiel/training.ts';
import { eine, mitWelt } from '../../db.ts';
import { erstelleProjekt } from '../../services/struktur.ts';
import { aktiviereAttribut } from '../attribute/attribute.ts';
import { ladeBestwerte } from './bestwerte.ts';
import { an, anzahl, attributId, DANACH, dauer, faktorEins, kraft, plan, raeumeAuf, saetze, START, vorlage, welt, xp } from './einheitenHilfe.ts';
import { schliesseEinheitAb, starteEinheit, verwirfEinheit } from './einheiten.ts';
import { ladeEinheiten } from './lesen.ts';
import { aendereTrainingsplan } from './plaene.ts';
import { hakeSatzAb, pruefeSatzKoerper } from './saetze.ts';

afterEach(() => {
  raeumeAuf();
});

describe('Einheiten', () => {
  it('kopiert die Sätze, lässt denselben Plan offen und lehnt den nächsten ab', () => {
    mitWelt(welt(), () => {
      an();
      const vorlageId = vorlage('Kraft');
      const leer = plan('Leer', [], vorlageId);
      expect(() => starteEinheit(leer.id, START)).toThrow(PLAN_OHNE_EINTRAG);
      const unter = plan('Unterkörper', [kraft('Kniebeuge', { zielSaetze: null, aufwaermSaetze: 2, aufwaermWiederholungen: 5, aufwaermGewichtG: 40000 })], vorlageId);
      const einheit = starteEinheit(unter.id, START);
      expect(einheit.eintragId).toBeNull();
      expect(einheit.status).toBe('offen');
      expect(einheit.aenderbar).toBe(true);
      expect(einheit.stunden).toBe(1);
      expect(saetze(einheit).map((satz) => satz.aufwaermen)).toEqual([true, true, false]);
      expect(saetze(einheit)[2]?.gewichtG).toBe(80000);
      expect(eine<{ krit: number }>('SELECT krit_festgelegt AS krit FROM trainingseinheiten WHERE id = ?', einheit.id)?.krit).toBe(0);
      expect(starteEinheit(unter.id, START).id).toBe(einheit.id);
      expect(anzahl('trainingseinheiten')).toBe(1);
      const anderer = plan('Ganzkörper', [kraft('Klimmzug')], vorlageId);
      expect(() => starteEinheit(anderer.id, START)).toThrow(EINHEIT_LAEUFT);
      verwirfEinheit(einheit.id);
      aendereTrainingsplan(anderer.id, { archiviert: true });
      expect(() => starteEinheit(anderer.id, START)).toThrow(PLAN_ARCHIVIERT);
    });
  });

  it('lässt die Satzzahlen stehen, wenn der Plan sich ändert, und hakt nur ab', () => {
    mitWelt(welt(), () => {
      an();
      const vorlageId = vorlage('Kraft');
      const angelegt = plan('Unterkörper', [kraft('Kniebeuge')], vorlageId);
      const einheit = starteEinheit(angelegt.id, START);
      aendereTrainingsplan(angelegt.id, { uebungen: [kraft('Kniebeuge', { zielGewichtG: 100000, zielWiederholungen: 3 })] });
      const satz = saetze(ladeEinheiten(START)[0] ?? einheit)[0];
      expect(satz?.gewichtG).toBe(80000);
      expect(satz?.wiederholungen).toBe(5);
      expect(() => pruefeSatzKoerper({ erledigt: true, gewichtG: 1 })).toThrow(NUR_ABHAKEN);
      expect(() => pruefeSatzKoerper({ wiederholungen: 8 })).toThrow(NUR_ABHAKEN);
      expect(() => pruefeSatzKoerper({ erledigt: 1 })).toThrow(NUR_ABHAKEN);
      expect(pruefeSatzKoerper({ erledigt: true })).toBe(true);
      const gehakt = hakeSatzAb(satz?.id ?? 0, true, START);
      expect(saetze(gehakt)[0]?.erledigt).toBe(true);
      expect(saetze(gehakt)[0]?.gewichtG).toBe(80000);
    });
  });

  it('bucht 45 Minuten mit erstem Bestwert auf 50 und ein zweites Mal ohne neue Zeilen', () => {
    mitWelt(welt(), () => {
      an();
      aktiviereAttribut('vitalitaet', 'behalten', null);
      const vorlageId = vorlage('Kraft');
      const projekt = erstelleProjekt({
        name: 'Kraft',
        beschreibung: '',
        visionId: null,
        organisationId: null,
        standardVorlageId: vorlageId,
      });
      const angelegt = plan('Unterkörper', [kraft('Kniebeuge')], null, projekt.id);
      const einheit = starteEinheit(angelegt.id, START);
      const gehakt = hakeSatzAb(saetze(einheit)[0]?.id ?? 0, true, START);
      const eintragId = gehakt.eintragId ?? 0;
      faktorEins(eintragId);
      const ergebnis = schliesseEinheitAb(einheit.id, DANACH);
      expect(ergebnis.eintrag.vorlageName).toBe('Kraft');
      expect(ergebnis.eintrag.meilenstein).toBe(true);
      expect(ergebnis.eintrag.stunden).toBe(0.75);
      expect(ergebnis.belohnung.xp).toBe(50);
      expect(xp(eintragId, 'koerper')).toBe(25);
      expect(xp(eintragId, 'disziplin')).toBe(15);
      expect(xp(eintragId, 'vitalitaet')).toBe(10);
      expect(eine<{ erstellt: string; krit: number }>('SELECT erstellt_am AS erstellt, krit FROM eintraege WHERE id = ?', eintragId)).toEqual({
        erstellt: START.toISOString(),
        krit: 0,
      });
      const zeilen = anzahl('xp_ereignisse');
      const nochmal = schliesseEinheitAb(einheit.id, new Date('2026-10-24T18:00:00.000Z'));
      expect(nochmal.eintrag.id).toBe(eintragId);
      expect(nochmal.belohnung.xp).toBe(50);
      expect(anzahl('eintraege')).toBe(1);
      expect(anzahl('xp_ereignisse')).toBe(zeilen);
      expect(ladeBestwerte(gehakt.uebungen[0]?.uebungId ?? 0).map((zeile) => zeile.wert).sort((a, b) => a - b)).toEqual([80000, 93333]);
    });
  });

  it('nimmt die Katalog-Tätigkeit Training statt der festen Gewichte', () => {
    mitWelt(welt(), () => {
      an();
      aktiviereAttribut('vitalitaet', 'behalten', null);
      vorlage('Training');
      const standardId = vorlage('Kraft', [{ attributId: attributId('disziplin'), gewicht: 1 }]);
      const projekt = erstelleProjekt({
        name: 'Kraft',
        beschreibung: '',
        visionId: null,
        organisationId: null,
        standardVorlageId: standardId,
      });
      const einheit = starteEinheit(plan('Unterkörper', [kraft('Kniebeuge')], null, projekt.id).id, START);
      const gehakt = hakeSatzAb(saetze(einheit)[0]?.id ?? 0, true, START);
      const eintragId = gehakt.eintragId ?? 0;
      expect(gehakt.planId).toBe(einheit.planId);
      expect(xp(eintragId, 'koerper')).toBeGreaterThan(0);
      expect(xp(eintragId, 'disziplin')).toBe(0);
      expect(xp(eintragId, 'vitalitaet')).toBe(0);
      expect(eine<{ name: string }>('SELECT v.name AS name FROM eintraege e JOIN vorlagen v ON v.id = e.vorlage_id WHERE e.id = ?', eintragId)?.name).toBe('Training');
    });
  });

  it('schreibt weder für Aufwärmen noch für Eigengewicht einen Bestwert', () => {
    mitWelt(welt(), () => {
      an();
      const vorlageId = vorlage('Kraft');
      const angelegt = plan(
        'Unterkörper',
        [kraft('Kniebeuge', { zielGewichtG: null, aufwaermSaetze: 1, aufwaermWiederholungen: 5, aufwaermGewichtG: 40000 })],
        vorlageId,
      );
      const einheit = starteEinheit(angelegt.id, START);
      const [warm, arbeit] = saetze(einheit);
      const nachWarm = hakeSatzAb(warm?.id ?? 0, true, START);
      expect(nachWarm.eintragId).toBeNull();
      expect(ladeBestwerte(warm?.uebungId ?? 0)).toEqual([]);
      const nachArbeit = hakeSatzAb(arbeit?.id ?? 0, true, START);
      expect(nachArbeit.eintragId).not.toBeNull();
      expect(eine<{ meilenstein: number }>('SELECT meilenstein FROM eintraege WHERE id = ?', nachArbeit.eintragId)?.meilenstein).toBe(0);
      expect(ladeBestwerte(arbeit?.uebungId ?? 0)).toEqual([]);
    });
  });

  it('hängt das zweite Kilogramm an und bucht den Meilenstein nicht noch einmal', () => {
    mitWelt(welt(), () => {
      an();
      const vorlageId = vorlage('Kraft');
      const erste = starteEinheit(plan('Unterkörper', [kraft('Kniebeuge', { zielSaetze: 1 })], vorlageId).id, START);
      const ersterEintrag = hakeSatzAb(saetze(erste)[0]?.id ?? 0, true, START).eintragId;
      schliesseEinheitAb(erste.id, START);
      const vorher = ladeBestwerte(erste.uebungen[0]?.uebungId ?? 0).map((zeile) => zeile.id);
      const zweite = starteEinheit(plan('Schwer', [kraft('Kniebeuge', { zielSaetze: 1, zielGewichtG: 90000 })], vorlageId).id, DANACH);
      const gehakt = hakeSatzAb(saetze(zweite)[0]?.id ?? 0, true, DANACH);
      expect(eine<{ meilenstein: number }>('SELECT meilenstein FROM eintraege WHERE id = ?', gehakt.eintragId)?.meilenstein).toBe(0);
      const nachher = ladeBestwerte(erste.uebungen[0]?.uebungId ?? 0);
      expect(nachher.map((zeile) => zeile.id)).toEqual(expect.arrayContaining(vorher));
      expect(nachher.length).toBe(vorher.length + 2);
      hakeSatzAb(saetze(gehakt)[0]?.id ?? 0, false, DANACH);
      expect(eine<{ meilenstein: number }>('SELECT meilenstein FROM eintraege WHERE id = ?', ersterEintrag)?.meilenstein).toBe(1);
    });
  });

  it('nimmt die längste Dauer als Bestwert und setzt den Meilenstein nur einmal', () => {
    mitWelt(welt(), () => {
      an();
      const vorlageId = vorlage('Kraft');
      const erste = starteEinheit(plan('Lauf', [dauer('Laufband', 60)], vorlageId).id, START);
      const gehakt = hakeSatzAb(saetze(erste)[0]?.id ?? 0, true, START);
      expect(ladeBestwerte(gehakt.uebungen[0]?.uebungId ?? 0)).toMatchObject([{ art: 'dauer', wert: 60, wiederholungen: null }]);
      schliesseEinheitAb(erste.id, START);
      const zweite = starteEinheit(plan('Lang', [dauer('Laufband', 120)], vorlageId).id, DANACH);
      const laenger = hakeSatzAb(saetze(zweite)[0]?.id ?? 0, true, DANACH);
      expect(eine<{ meilenstein: number }>('SELECT meilenstein FROM eintraege WHERE id = ?', laenger.eintragId)?.meilenstein).toBe(0);
      expect(ladeBestwerte(gehakt.uebungen[0]?.uebungId ?? 0).map((zeile) => zeile.wert)).toEqual([120, 60]);
    });
  });
});


