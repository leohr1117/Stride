import { afterEach, describe, expect, it } from 'vitest';
import { EINHEIT_GESPERRT, NUR_OFFEN_VERWERFEN } from '../../../shared/spiel/training.ts';
import { ausfuehren, eine, mitWelt } from '../../db.ts';
import { aendereAttribut, aktiviereAttribut } from '../attribute/attribute.ts';
import { aendereEinstellungen } from '../einstellungen/einstellungen.ts';
import { ladeBestwerte } from './bestwerte.ts';
import {
  an,
  anzahl,
  attributId,
  faktorEins,
  kraft,
  plan,
  quellen,
  raeumeAuf,
  saetze,
  START,
  vorlage,
  welt,
  xp,
} from './einheitenHilfe.ts';
import { schliesseEinheitAb, starteEinheit, verwirfEinheit } from './einheiten.ts';
import { ladeEinheiten, ladeTrainingHeute } from './lesen.ts';
import { hakeSatzAb } from './saetze.ts';

afterEach(() => {
  raeumeAuf();
});

describe('Einheiten Buchung', () => {
  it('lässt Vitalität auf 0 und hält Körper zu Disziplin bei 50 zu 30', () => {
    mitWelt(welt(), () => {
      an();
      aktiviereAttribut('vitalitaet', 'behalten', null);
      const vorlageId = vorlage('Hantel', [
        { attributId: attributId('koerper'), gewicht: 50 },
        { attributId: attributId('disziplin'), gewicht: 30 },
        { attributId: attributId('vitalitaet'), gewicht: 20 },
      ]);
      const angelegt = plan(
        'Unterkörper',
        [kraft('Kniebeuge', { aufwaermSaetze: 1, aufwaermWiederholungen: 5, aufwaermGewichtG: 20000 })],
        vorlageId,
      );
      const einheit = starteEinheit(angelegt.id, START);
      aendereAttribut(attributId('vitalitaet'), { archiviert: true });
      schliesseEinheitAb(einheit.id, START);
      const eintragId = ladeEinheiten(START)[0]?.eintragId ?? 0;
      faktorEins(eintragId);
      const warm = saetze(ladeEinheiten(START)[0] ?? einheit).find((satz) => satz.aufwaermen);
      hakeSatzAb(warm?.id ?? 0, true, START);
      expect(xp(eintragId, 'koerper')).toBe(16);
      expect(xp(eintragId, 'disziplin')).toBe(9);
      expect(xp(eintragId, 'vitalitaet')).toBe(0);
      expect(eine<{ meilenstein: number }>('SELECT meilenstein FROM eintraege WHERE id = ?', eintragId)?.meilenstein).toBe(0);
    });
  });

  it('ersetzt die Buchung, lässt krit und erstellt_am und verdoppelt weitermachen nicht', () => {
    mitWelt(welt(), () => {
      an();
      aendereEinstellungen({ funktionen: { training: true, verfallKoennen: true } });
      const vorlageId = vorlage('Kraft');
      const gestern = new Date(START.getTime() - 24 * 60 * 60 * 1000);
      ausfuehren(`INSERT INTO eintraege (vorlage_id, stunden, notiz, erstellt_am) VALUES (?, 1, '', ?)`, vorlageId, gestern.toISOString());
      ausfuehren(
        `INSERT INTO vorhaben (titel, status, abgeschlossen_am, weitermachen_eingeloest) VALUES ('Rückschlag', 'gescheitert', ?, 0)`,
        gestern.toISOString(),
      );
      ausfuehren(
        `INSERT INTO xp_ereignisse (quelle, attribut_id, xp, erstellt_am) VALUES ('umverteilung', ?, 500, ?)`,
        attributId('geist'),
        gestern.toISOString(),
      );
      const einheit = starteEinheit(plan('Unterkörper', [kraft('Kniebeuge', { zielSaetze: 2 })], vorlageId).id, START);
      const [erster, zweiter] = saetze(einheit);
      const gehakt = hakeSatzAb(erster?.id ?? 0, true, START);
      const eintragId = gehakt.eintragId ?? 0;
      const erstellt = eine<{ erstellt: string }>('SELECT erstellt_am AS erstellt FROM eintraege WHERE id = ?', eintragId)?.erstellt;
      hakeSatzAb(zweiter?.id ?? 0, true, START);
      expect(eine<{ erstellt: string; krit: number }>('SELECT erstellt_am AS erstellt, krit FROM eintraege WHERE id = ?', eintragId)).toEqual({
        erstellt,
        krit: 0,
      });
      expect(quellen(eintragId, 'eintrag')).toBe(1);
      expect(quellen(eintragId, 'belastung')).toBe(1);
      expect(quellen(eintragId, 'bestaendigkeit')).toBe(1);
      expect(quellen(eintragId, 'meilenstein')).toBe(1);
      expect(quellen(eintragId, 'weitermachen')).toBe(2);
      expect(anzahl('eintraege')).toBe(2);
    });
  });

  it('löscht beim letzten offenen Haken den Eintrag und lässt die Einheit liegen', () => {
    mitWelt(welt(), () => {
      an();
      const vorlageId = vorlage('Kraft');
      const einheit = starteEinheit(plan('Unterkörper', [kraft('Kniebeuge', { zielSaetze: 1 })], vorlageId).id, START);
      const gehakt = hakeSatzAb(saetze(einheit)[0]?.id ?? 0, true, START);
      expect(anzahl('eintraege')).toBe(1);
      const offenWieder = hakeSatzAb(saetze(gehakt)[0]?.id ?? 0, false, START);
      expect(offenWieder.id).toBe(einheit.id);
      expect(offenWieder.eintragId).toBeNull();
      expect(anzahl('eintraege')).toBe(0);
      expect(anzahl('trainingseinheiten')).toBe(1);
      expect(anzahl('trainingssaetze')).toBe(1);
      expect(ladeBestwerte(offenWieder.uebungen[0]?.uebungId ?? 0)).toEqual([]);
      verwirfEinheit(offenWieder.id);
      const ohne = starteEinheit(plan('Leer starten', [kraft('Klimmzug', { zielSaetze: 1 })], vorlageId).id, START);
      verwirfEinheit(ohne.id);
      expect(anzahl('trainingseinheiten')).toBe(0);
      const fertig = starteEinheit(plan('Fertig', [kraft('Rudern', { zielSaetze: 1 })], vorlageId).id, START);
      schliesseEinheitAb(fertig.id, START);
      expect(() => verwirfEinheit(fertig.id)).toThrow(NUR_OFFEN_VERWERFEN);
    });
  });

  it('bucht den Abschluss ohne Arbeitssatz einmal', () => {
    mitWelt(welt(), () => {
      an();
      const einheit = starteEinheit(plan('Unterkörper', [kraft('Kniebeuge')], vorlage('Kraft')).id, START);
      const erste = schliesseEinheitAb(einheit.id, START);
      const zeilen = anzahl('xp_ereignisse');
      expect(erste.eintrag.meilenstein).toBe(false);
      expect(erste.belohnung.xp).toBeGreaterThan(0);
      const zweite = schliesseEinheitAb(einheit.id, new Date('2026-10-24T12:00:00.000Z'));
      expect(zweite.eintrag.id).toBe(erste.eintrag.id);
      expect(zweite.belohnung.xp).toBe(erste.belohnung.xp);
      expect(anzahl('eintraege')).toBe(1);
      expect(anzahl('xp_ereignisse')).toBe(zeilen);
    });
  });

  it('sperrt eine fertige Einheit am nächsten Tag und rechnet am Starttag neu', () => {
    mitWelt(welt(), () => {
      an();
      const einheit = starteEinheit(plan('Unterkörper', [kraft('Kniebeuge', { zielSaetze: 1 })], vorlage('Kraft')).id, START);
      const satzId = saetze(einheit)[0]?.id ?? 0;
      hakeSatzAb(satzId, true, START);
      schliesseEinheitAb(einheit.id, START);
      const gramm = eine<{ gewicht: number }>('SELECT gewicht_g AS gewicht FROM trainingssaetze WHERE id = ?', satzId)?.gewicht;
      expect(() => hakeSatzAb(satzId, false, new Date('2026-10-24T00:30:00.000Z'))).toThrow(EINHEIT_GESPERRT);
      expect(eine<{ gewicht: number }>('SELECT gewicht_g AS gewicht FROM trainingssaetze WHERE id = ?', satzId)?.gewicht).toBe(gramm);
      const zurueck = hakeSatzAb(satzId, false, new Date('2026-10-23T18:00:00.000Z'));
      expect(zurueck.eintragId).not.toBeNull();
      expect(eine<{ meilenstein: number }>('SELECT meilenstein FROM eintraege WHERE id = ?', zurueck.eintragId)?.meilenstein).toBe(0);
      const spaet = starteEinheit(plan('Nacht', [kraft('Klimmzug', { zielSaetze: 1 })], vorlage('Kraft')).id, new Date('2026-10-23T23:30:00.000Z'));
      expect(hakeSatzAb(saetze(spaet)[0]?.id ?? 0, true, new Date('2026-10-24T00:30:00.000Z')).aenderbar).toBe(true);
    });
  });

  it('liefert Heute nach Zone und bei ausgeschaltetem Schalter leere Listen', () => {
    mitWelt(welt(), () => {
      an();
      const vorlageId = vorlage('Kraft');
      const freitag = plan('Unterkörper', [kraft('Kniebeuge', { zielSaetze: 1 })], vorlageId, null, [5]);
      const beide = plan('Ganzkörper', [kraft('Klimmzug', { zielSaetze: 1 })], vorlageId, null, [5, 6]);
      plan('Montag', [kraft('Rudern', { zielSaetze: 1 })], vorlageId, null, [1]);
      const freitagZeit = new Date('2026-10-23T15:00:00.000Z');
      expect(ladeTrainingHeute(freitagZeit).map((zeile) => zeile.name).sort()).toEqual(['Ganzkörper', 'Unterkörper']);
      const laufend = starteEinheit(beide.id, new Date('2026-10-23T23:30:00.000Z'));
      const amFreitag = ladeTrainingHeute(freitagZeit);
      expect(amFreitag.find((zeile) => zeile.planId === beide.id)).toMatchObject({ aktion: 'oeffnen', einheitId: laufend.id });
      expect(amFreitag.find((zeile) => zeile.planId === freitag.id)?.aktion).toBe('starten');
      const samstag = new Date('2026-10-24T00:30:00.000Z');
      expect(ladeTrainingHeute(samstag).map((zeile) => zeile.planId)).toEqual([beide.id]);
      expect(ladeTrainingHeute(samstag)[0]?.aktion).toBe('oeffnen');
      schliesseEinheitAb(laufend.id, new Date('2026-10-24T01:00:00.000Z'));
      const fertig = starteEinheit(freitag.id, freitagZeit);
      hakeSatzAb(saetze(fertig)[0]?.id ?? 0, true, freitagZeit);
      schliesseEinheitAb(fertig.id, freitagZeit);
      expect(ladeTrainingHeute(freitagZeit).map((zeile) => zeile.planId)).not.toContain(freitag.id);
      aendereEinstellungen({ funktionen: { training: false } });
      expect(ladeEinheiten()).toEqual([]);
      expect(ladeTrainingHeute()).toEqual([]);
      expect(ladeBestwerte(freitag.uebungen[0]?.uebungId ?? 0)).toEqual([]);
      expect(() => starteEinheit(beide.id)).toThrow('Training ist ausgeschaltet.');
      expect(() => hakeSatzAb(1, true)).toThrow('Training ist ausgeschaltet.');
      expect(() => schliesseEinheitAb(1)).toThrow('Training ist ausgeschaltet.');
      expect(() => verwirfEinheit(1)).toThrow('Training ist ausgeschaltet.');
    });
  });
});
