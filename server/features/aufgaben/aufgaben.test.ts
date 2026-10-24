import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { AufgabeDaten } from '../../../shared/api/aufgaben.ts';
import {
  BOSS_BRAUCHT_MEILENSTEIN,
  DEADLINE_NUR_GEGNER_ODER_BOSS,
  DEADLINE_VERGANGEN,
  GEGNER_ODER_BOSS_EINMALIG,
  GEGNER_SCHLIESST_AUS,
  naechstesDatum,
  UHRZEIT_BRAUCHT_DATUM,
  UHRZEIT_FORMAT,
  WIEDERHOLUNG_BRAUCHT_DATUM,
  WIEDERHOLUNG_UNBEKANNT,
  WOCHENTAG_FORMAT,
  WOCHENTAG_PFLICHT,
  type Wiederholung,
} from '../../../shared/spiel/aufgabe.ts';
import { GEGNER, meilensteinBonus } from '../../../shared/spiel/xp.ts';
import { ausfuehren, eine, mitWelt, schliesseWelt } from '../../db.ts';
import { aendereAttribut } from '../attribute/attribute.ts';
import { aendereEinstellungen } from '../einstellungen/einstellungen.ts';
import { erstelleEintrag, loescheEintrag } from '../eintraege/eintraege.ts';
import { aendereVorlage, erstelleVorlage } from '../taetigkeiten/vorlagen.ts';
import {
  aendereOrganisation,
  aendereProjekt,
  aendereVision,
  erstelleOrganisation,
  erstelleProjekt,
  erstelleVision,
} from '../../services/struktur.ts';
import { loescheProjekt, loescheVorlage } from '../../services/loeschen.ts';
import { aendereAufgabe, erledigeAufgabe, erstelleAufgabe, ladeAufgaben, loescheAufgabe } from './aufgaben.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-aufgaben-'));
const offen: string[] = [];
let nummer = 0;
const JETZT = new Date(2026, 9, 23, 15, 0, 0);
const HEUTE = '2026-10-23';

const LEER: AufgabeDaten = {
  name: 'Arzt',
  icon: 'clipboard-list',
  projektId: null,
  organisationId: null,
  visionId: null,
  vorlageId: null,
  stunden: null,
  faelligAm: null,
  faelligUm: null,
  wiederholung: 'keine',
  wochentage: [],
  prioritaet: null,
  nurHeute: false,
  meilenstein: false,
  gegner: false,
  boss: false,
  deadline: null,
};

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

function eintragsXp(eintragId: number): number {
  return (
    eine<{ xp: number }>(
      `SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse WHERE eintrag_id = ? AND quelle = 'eintrag'`,
      eintragId,
    )?.xp ?? 0
  );
}

function bonusEreignis(eintragId: number): { aufgabeId: number | null; vorhabenId: number | null; quelle: string } {
  const zeile = eine<{ aufgabeId: number | null; vorhabenId: number | null; quelle: string }>(
    `SELECT aufgabe_id AS aufgabeId, vorhaben_id AS vorhabenId, quelle
     FROM xp_ereignisse WHERE eintrag_id = ? AND quelle = 'meilenstein'`,
    eintragId,
  );
  if (!zeile) {
    throw new Error('Meilenstein-Buchung fehlt.');
  }
  return zeile;
}

function attributId(kennung: string): number {
  const id = eine<{ id: number }>('SELECT id FROM attribute WHERE kennung = ?', kennung)?.id;
  if (id === undefined) {
    throw new Error(`${kennung} fehlt.`);
  }
  return id;
}

function grund(name = 'Anruf'): number {
  return erstelleVorlage({
    name,
    icon: 'star',
    gewichte: [{ attributId: attributId('koerper'), gewicht: 1 }],
  }).id;
}

function lege(extra: Partial<AufgabeDaten> = {}) {
  return erstelleAufgabe({ ...LEER, ...extra }, JETZT);
}

describe('Aufgaben', () => {
  it('erledigt einmal, schreibt den Eintrag und nimmt die Rücknahme zurück', () => {
    mitWelt(welt(), () => {
      const vorlageId = grund();
      const aufgabe = lege({ name: 'Anruf', vorlageId, stunden: 1.5, faelligAm: '2026-10-20' });
      expect(aufgabe.icon).toBe('clipboard-list');
      expect(aufgabe.loeschbar).toBe(true);
      expect(eine<{ icon: string }>('SELECT icon FROM aufgaben WHERE id = ?', aufgabe.id)?.icon).toBe('clipboard-list');

      const ergebnis = erledigeAufgabe(aufgabe.id, JETZT);
      expect(ergebnis.eintrag.notiz).toBe('Anruf');
      expect(ergebnis.eintrag.stunden).toBe(1.5);
      expect(ergebnis.eintrag.meilenstein).toBe(false);
      expect(ergebnis.eintrag.vorhaben).toBeNull();
      expect(anzahl('eintraege')).toBe(1);
      expect(anzahl('aufgaben_erledigt')).toBe(1);
      expect(anzahl('vorhaben')).toBe(0);
      const zeile = eine<{ krit: number; basis: number | null; vorhaben: number | null; faellig: string }>(
        `SELECT e.krit, e.basis_aufgabe_id AS basis, e.vorhaben_id AS vorhaben, a.faellig_am AS faellig
         FROM eintraege e JOIN aufgaben a ON a.id = ?
         WHERE e.id = ?`,
        aufgabe.id,
        ergebnis.eintrag.id,
      );
      expect(zeile).toEqual({ krit: 0, basis: null, vorhaben: null, faellig: '2026-10-20' });
      const offen = ladeAufgaben(false, JETZT).find((eintrag) => eintrag.id === aufgabe.id);
      expect(offen?.heuteEintragId).toBe(ergebnis.eintrag.id);
      expect(offen?.loeschbar).toBe(false);
      expect(offen?.nurHeuteAm).toBeNull();
      expect(() => erledigeAufgabe(aufgabe.id, JETZT)).toThrow('Diese Aufgabe ist für den Tag schon erledigt.');
      expect(anzahl('eintraege')).toBe(1);
      expect(() => loescheAufgabe(aufgabe.id)).toThrow(/nur archiviert/);

      loescheEintrag(ergebnis.eintrag.id);
      const zurueck = ladeAufgaben(false, JETZT).find((eintrag) => eintrag.id === aufgabe.id);
      expect(zurueck?.faelligAm).toBe('2026-10-20');
      expect(zurueck?.heuteEintragId).toBeNull();
      expect(zurueck?.loeschbar).toBe(true);
      expect(anzahl('aufgaben_erledigt')).toBe(0);
      expect(anzahl('xp_ereignisse')).toBe(0);
      expect(anzahl('vorhaben')).toBe(0);
      loescheAufgabe(aufgabe.id);
      expect(anzahl('aufgaben')).toBe(0);
    });
  });

  it('legt den Eintrag neben einer Todoist-Erledigung an', () => {
    mitWelt(welt(), () => {
      const vorlageId = grund();
      const erster = erstelleEintrag(
        {
          projektId: null,
          vorlageId,
          vorhaben: null,
          abschluss: null,
          erkenntnis: '',
          stunden: 1,
          notiz: 'Todoist',
          meilenstein: false,
          faehigkeitId: null,
          datum: null,
        },
        JETZT,
      );
      ausfuehren(
        'INSERT INTO todoist_erledigt (ereignis_id, eintrag_id, erledigt_am) VALUES (?, ?, ?)',
        'e1',
        erster.eintrag.id,
        JETZT.toISOString(),
      );
      erledigeAufgabe(lege({ vorlageId, name: 'Daneben' }).id, JETZT);
      expect(anzahl('eintraege')).toBe(2);
    });
  });

  it('springt bei Wiederholung einen Termin weiter und füllt versäumte Tage nicht nach', () => {
    mitWelt(welt(), () => {
      const vorlageId = grund();
      const aufgabe = lege({
        vorlageId,
        wiederholung: 'taeglich',
        faelligAm: '2026-10-20',
        faelligUm: '09:00',
      });
      erledigeAufgabe(aufgabe.id, JETZT);
      const danach = ladeAufgaben(false, JETZT)[0];
      expect(danach?.faelligAm).toBe(naechstesDatum('taeglich', '2026-10-20', HEUTE));
      expect(danach?.faelligUm).toBe('09:00');
      expect(danach?.heuteEintragId).toBeNull();
      expect(danach?.nurHeuteAm).toBeNull();
      expect(anzahl('eintraege')).toBe(1);
      expect(anzahl('aufgaben_erledigt')).toBe(1);
      expect(eine<{ vorkommen: string }>('SELECT vorkommen FROM aufgaben_erledigt')?.vorkommen).toBe('2026-10-20');
      loescheEintrag(eine<{ id: number }>('SELECT eintrag_id AS id FROM aufgaben_erledigt')?.id ?? 0);
      expect(ladeAufgaben(false, JETZT)[0]?.faelligAm).toBe('2026-10-20');
    });
  });

  it('lässt bei ausgeschaltetem Schalter die Zeile stehen', () => {
    mitWelt(welt(), () => {
      const vorlageId = grund();
      const aufgabe = lege({ vorlageId, name: 'Bleibt' });
      aendereEinstellungen({ funktionen: { aufgaben: false } });
      expect(ladeAufgaben(false, JETZT)).toEqual([]);
      expect(anzahl('aufgaben')).toBe(1);
      expect(() => erledigeAufgabe(aufgabe.id, JETZT)).toThrow('Aufgaben ist ausgeschaltet.');
      expect(() => lege({ vorlageId, name: 'Neu' })).toThrow('Aufgaben ist ausgeschaltet.');
      expect(() => loescheAufgabe(aufgabe.id)).toThrow('Aufgaben ist ausgeschaltet.');
      expect(anzahl('aufgaben')).toBe(1);
      expect(anzahl('eintraege')).toBe(0);
    });
  });

  it('bucht nur wirksame Attribute und bricht ohne Gewicht ab', () => {
    mitWelt(welt(), () => {
      const koerper = attributId('koerper');
      const ressourcen = attributId('ressourcen');
      const gemischt = erstelleVorlage({
        name: 'Mix',
        icon: 'star',
        gewichte: [
          { attributId: koerper, gewicht: 1 },
          { attributId: ressourcen, gewicht: 1 },
        ],
      }).id;
      aendereEinstellungen({ funktionen: { status: false } });
      const anteile = erledigeAufgabe(lege({ vorlageId: gemischt, name: 'Mix', stunden: 1 }).id, JETZT).belohnung.anteile;
      expect(anteile.map((anteil) => anteil.attributId)).toEqual([koerper]);

      const nur = grund('Nur');
      aendereAttribut(koerper, { archiviert: true });
      const aufgabe = lege({ vorlageId: nur, name: 'Nur' });
      expect(() => erledigeAufgabe(aufgabe.id, JETZT)).toThrow(/kein aktives Attribut/);
      expect(anzahl('eintraege')).toBe(1);
      expect(anzahl('aufgaben_erledigt')).toBe(1);
    });
  });

  it('löst die Tätigkeit auf und lehnt eine archivierte ab', () => {
    mitWelt(welt(), () => {
      expect(() => lege({ name: 'Leer' })).toThrow('Wähle eine Tätigkeit.');
      expect(anzahl('aufgaben')).toBe(0);

      const standard = grund('Standard');
      const eigene = grund('Eigene');
      const projekt = erstelleProjekt({
        name: 'Haus',
        beschreibung: '',
        visionId: null,
        organisationId: null,
        standardVorlageId: standard,
      });
      const ueberProjekt = lege({ projektId: projekt.id, name: 'Kehr' });
      expect(ueberProjekt.vorlageId).toBeNull();
      expect(ueberProjekt.vorlageName).toBe('Standard');
      expect(erledigeAufgabe(ueberProjekt.id, JETZT).eintrag.vorlageId).toBe(standard);

      const gewaehlt = lege({ projektId: projekt.id, vorlageId: eigene, name: 'Eigen' });
      expect(erledigeAufgabe(gewaehlt.id, JETZT).eintrag.vorlageId).toBe(eigene);

      const mitProjekt = lege({ projektId: projekt.id, vorlageId: eigene, name: 'Mit' });
      aendereEinstellungen({ ebenen: { projekte: false } });
      expect(erledigeAufgabe(mitProjekt.id, JETZT).eintrag.projektId).toBeNull();

      const alt = grund('Alt');
      const aufgabe = lege({ vorlageId: alt, name: 'Alt' });
      aendereVorlage(alt, { archiviert: true });
      expect(() => erledigeAufgabe(aufgabe.id, JETZT)).toThrow('Die Tätigkeit ist archiviert.');
      expect(anzahl('aufgaben_erledigt')).toBe(3);
    });
  });

  it('antwortet auf die Checks aus Abschnitt 6 mit 400', () => {
    mitWelt(welt(), () => {
      const vorlageId = grund();
      const basis = { vorlageId, faelligAm: '2026-10-20' };
      expect(() => lege({ ...basis, boss: true })).toThrow(BOSS_BRAUCHT_MEILENSTEIN);
      expect(() => lege({ ...basis, gegner: true, meilenstein: true })).toThrow(GEGNER_SCHLIESST_AUS);
      expect(() => lege({ ...basis, gegner: true, wiederholung: 'woechentlich', wochentage: [1] })).toThrow(
        GEGNER_ODER_BOSS_EINMALIG,
      );
      expect(() => lege({ vorlageId, faelligUm: '09:00' })).toThrow(UHRZEIT_BRAUCHT_DATUM);
      expect(() => lege({ ...basis, faelligUm: '25:00' })).toThrow(UHRZEIT_FORMAT);
      expect(() => lege({ vorlageId, wiederholung: 'woechentlich', faelligAm: '2026-10-20' })).toThrow(WOCHENTAG_PFLICHT);
      expect(() => lege({ vorlageId, wiederholung: 'woechentlich', faelligAm: '2026-10-20', wochentage: [8] })).toThrow(
        WOCHENTAG_FORMAT,
      );
      expect(() => lege({ vorlageId, wiederholung: 'taeglich' })).toThrow(WIEDERHOLUNG_BRAUCHT_DATUM);
      expect(() => lege({ vorlageId, wiederholung: 'jaehrlich' as Wiederholung, faelligAm: '2026-10-20' })).toThrow(
        WIEDERHOLUNG_UNBEKANNT,
      );
      expect(() => lege({ ...basis, deadline: '2026-10-30' })).toThrow(DEADLINE_NUR_GEGNER_ODER_BOSS);
      expect(() => lege({ ...basis, gegner: true, deadline: '2026-10-01' })).toThrow(DEADLINE_VERGANGEN);
      expect(anzahl('aufgaben')).toBe(0);

      const monat = lege({ vorlageId, wiederholung: 'monatlich', faelligAm: '2026-10-31' });
      expect(monat.monatstag).toBe(31);
      expect(lege({ vorlageId, wiederholung: 'woechentlich', faelligAm: '2026-10-20', wochentage: [3, 1] }).wochentage).toEqual([
        1, 3,
      ]);
      expect(
        lege({ vorlageId, meilenstein: true, wiederholung: 'woechentlich', faelligAm: '2026-10-20', wochentage: [1] })
          .wiederholung,
      ).toBe('woechentlich');

      const gegner = lege({ vorlageId, gegner: true, deadline: HEUTE, faelligAm: HEUTE });
      ausfuehren('UPDATE aufgaben SET deadline = ? WHERE id = ?', '2026-10-01', gegner.id);
      expect(aendereAufgabe(gegner.id, { name: 'Bleibt' }, JETZT).deadline).toBe('2026-10-01');
      expect(() => aendereAufgabe(gegner.id, { deadline: '2026-10-22' }, JETZT)).toThrow(DEADLINE_VERGANGEN);
    });
  });

  it('setzt Meilenstein, Boss und Gegner nur über das vorhandene Flag', () => {
    mitWelt(welt(), () => {
      const vorlageId = grund();
      const meilenstein = erledigeAufgabe(lege({ vorlageId, meilenstein: true, faelligAm: HEUTE }).id, JETZT);
      expect(meilenstein.eintrag.meilenstein).toBe(true);
      expect(meilenstein.belohnung.boni.some((bonus) => bonus.label === 'Meilenstein erreicht')).toBe(true);

      const boss = erledigeAufgabe(lege({ vorlageId, meilenstein: true, boss: true, faelligAm: HEUTE }).id, JETZT);
      expect(boss.eintrag.meilenstein).toBe(true);
      expect(boss.belohnung.boss).toBeNull();

      const gegner = erledigeAufgabe(lege({ vorlageId, gegner: true, faelligAm: HEUTE }).id, JETZT);
      expect(gegner.eintrag.meilenstein).toBe(false);
    });
  });

  it('zahlt dem Boss das Doppelte und dem Gegner die Hälfte, ohne Beute', () => {
    mitWelt(welt(), () => {
      const vorlageId = grund();
      const meilenstein = erledigeAufgabe(lege({ vorlageId, meilenstein: true, faelligAm: HEUTE, stunden: 1 }).id, JETZT);
      const boss = erledigeAufgabe(
        lege({ vorlageId, meilenstein: true, boss: true, faelligAm: HEUTE, stunden: 1 }).id,
        JETZT,
      );
      const gegner = erledigeAufgabe(lege({ vorlageId, gegner: true, faelligAm: HEUTE, stunden: 1 }).id, JETZT);
      const xp = eintragsXp(meilenstein.eintrag.id);
      expect(eintragsXp(boss.eintrag.id)).toBe(xp);
      expect(eintragsXp(gegner.eintrag.id)).toBe(xp);

      const meilensteinZeile = meilenstein.belohnung.boni.find((bonus) => bonus.label === 'Meilenstein erreicht');
      const bossZeile = boss.belohnung.boni.find((bonus) => bonus.label === 'Boss besiegt');
      const gegnerZeile = gegner.belohnung.boni.find((bonus) => bonus.label === 'Gegner besiegt');
      expect(meilensteinZeile).toEqual({ quelle: 'meilenstein', label: 'Meilenstein erreicht', xp: meilensteinBonus(xp, false) });
      expect(bossZeile).toEqual({ quelle: 'meilenstein', label: 'Boss besiegt', xp: meilensteinBonus(xp, false, true) });
      expect(gegnerZeile).toEqual({
        quelle: 'meilenstein',
        label: 'Gegner besiegt',
        xp: Math.round(meilensteinBonus(xp, false) / GEGNER.belohnungTeiler),
      });
      expect(boss.belohnung.boss).toBeNull();
      expect(boss.eintrag.bossSieg).toBeNull();
      expect(boss.belohnung.boni.some((bonus) => bonus.quelle === 'beute')).toBe(false);
      expect(gegner.eintrag.meilenstein).toBe(false);
      expect(bonusEreignis(boss.eintrag.id)).toEqual({ aufgabeId: null, vorhabenId: null, quelle: 'meilenstein' });
      expect(bonusEreignis(gegner.eintrag.id)).toEqual({ aufgabeId: null, vorhabenId: null, quelle: 'meilenstein' });

      loescheEintrag(gegner.eintrag.id);
      expect(
        eine<{ n: number }>('SELECT COUNT(*) AS n FROM xp_ereignisse WHERE eintrag_id = ?', gegner.eintrag.id)?.n,
      ).toBe(0);
    });
  });

  it('leert bei Nur heute den Termin und stellt die Nadel nicht wieder her', () => {
    mitWelt(welt(), () => {
      const vorlageId = grund();
      const aufgabe = lege({
        vorlageId,
        nurHeute: true,
        faelligAm: '2026-10-30',
        faelligUm: '09:00',
        wiederholung: 'taeglich',
      });
      expect(aufgabe.faelligAm).toBeNull();
      expect(aufgabe.faelligUm).toBeNull();
      expect(aufgabe.wiederholung).toBe('keine');
      expect(aufgabe.wochentage).toEqual([]);
      expect(aufgabe.nurHeuteAm).toBe(HEUTE);
      expect(aufgabe.monatstag).toBeNull();

      const ergebnis = erledigeAufgabe(aufgabe.id, JETZT);
      expect(ladeAufgaben(false, JETZT)[0]?.nurHeuteAm).toBeNull();
      loescheEintrag(ergebnis.eintrag.id);
      expect(ladeAufgaben(false, JETZT)[0]?.nurHeuteAm).toBeNull();

      const nadel = lege({ vorlageId, nurHeute: true, name: 'Nadel' });
      expect(aendereAufgabe(nadel.id, { name: 'Bleibt' }, JETZT).nurHeuteAm).toBe(HEUTE);
      expect(aendereAufgabe(nadel.id, { faelligAm: '2026-10-30' }, JETZT).nurHeuteAm).toBeNull();
      const erneut = lege({ vorlageId, nurHeute: true, name: 'Weg' });
      ausfuehren('UPDATE aufgaben SET nur_heute_am = ? WHERE id = ?', '2026-10-01', erneut.id);
      expect(aendereAufgabe(erneut.id, { name: 'Leer' }, JETZT).nurHeuteAm).toBeNull();
      expect(aendereAufgabe(erneut.id, { nurHeute: true, faelligAm: '2026-10-30' }, JETZT).faelligAm).toBeNull();
    });
  });

  it('sortiert und trennt das Archiv', () => {
    mitWelt(welt(), () => {
      const vorlageId = grund();
      const werte: Array<Partial<AufgabeDaten> & { name: string }> = [
        { name: 'Zeta' },
        { name: 'Spaet', faelligAm: '2026-10-24', faelligUm: '18:00' },
        { name: 'P2spaet', faelligAm: '2026-10-02', prioritaet: 2 },
        { name: 'Alpha' },
        { name: 'GesternZeit', faelligAm: '2026-10-23', faelligUm: '23:00' },
        { name: 'OhnePrio', faelligAm: '2026-10-01' },
        { name: 'P1', faelligAm: '2026-10-30', prioritaet: 1 },
        { name: 'Frueh', faelligAm: '2026-10-24', faelligUm: '09:00' },
        { name: 'P2frueh', faelligAm: '2026-10-01', prioritaet: 2 },
      ];
      for (const wert of werte) {
        lege({ vorlageId, ...wert });
      }
      const weg = lege({ vorlageId, name: 'Archiv' });
      aendereAufgabe(weg.id, { archiviert: true }, JETZT);
      expect(ladeAufgaben(false, JETZT).map((aufgabe) => aufgabe.name)).toEqual([
        'GesternZeit',
        'Frueh',
        'Spaet',
        'P1',
        'P2frueh',
        'P2spaet',
        'OhnePrio',
        'Alpha',
        'Zeta',
      ]);
      expect(ladeAufgaben(true, JETZT).map((aufgabe) => aufgabe.name)).toEqual(['Archiv']);
      expect(() => erledigeAufgabe(weg.id, JETZT)).toThrow('Die Aufgabe ist archiviert.');
    });
  });

  it('nimmt den Tag aus der Zeitzone', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ zeitzone: 'Pacific/Auckland' });
      const jetzt = new Date('2026-10-23T12:00:00.000Z');
      const aufgabe = erstelleAufgabe({ ...LEER, vorlageId: grund(), name: 'Zone' }, jetzt);
      erledigeAufgabe(aufgabe.id, jetzt);
      expect(eine<{ vorkommen: string }>('SELECT vorkommen FROM aufgaben_erledigt')?.vorkommen).toBe('2026-10-24');
    });
  });

  it('hängt Namen und Farbe an und sperrt benutzte Bezüge', () => {
    mitWelt(welt(), () => {
      const vorlageId = grund();
      const vision = erstelleVision({
        titel: 'Weit',
        beschreibung: '',
        farbe: '#112233',
        woopErgebnis: '',
        woopHindernis: '',
        woopPlan: '',
        level: null,
      });
      const organisation = erstelleOrganisation({ name: 'Nah', beschreibung: '', farbe: '#334455', visionId: null });
      const aufgabe = lege({ vorlageId, visionId: vision.id, organisationId: organisation.id, name: 'Beide' });
      expect(aufgabe.visionTitel).toBe('Weit');
      expect(aufgabe.organisationName).toBe('Nah');
      expect(aufgabe.farbe).toBe('#334455');
      expect(aufgabe.projektName).toBeNull();

      aendereVision(vision.id, { archiviert: true });
      expect(() => lege({ vorlageId, visionId: vision.id, name: 'Alt' })).toThrow('Die gewählte Vision ist archiviert.');
      aendereOrganisation(organisation.id, { archiviert: true });
      expect(() => lege({ vorlageId, organisationId: organisation.id, name: 'Alt' })).toThrow(
        'Die gewählte Organisation ist archiviert.',
      );
      expect(() => lege({ vorlageId, visionId: 99999, name: 'Fehlt' })).toThrow('Die Vision wurde nicht gefunden.');

      const standard = grund('Standard');
      const projekt = erstelleProjekt({
        name: 'Haus',
        beschreibung: '',
        visionId: null,
        organisationId: null,
        standardVorlageId: standard,
      });
      const gebunden = lege({ projektId: projekt.id, name: 'Dran' });
      expect(() => loescheProjekt(projekt.id)).toThrow(/genutzt/);
      aendereProjekt(projekt.id, { archiviert: true });
      expect(ladeAufgaben(false, JETZT).some((eintrag) => eintrag.id === gebunden.id)).toBe(true);
      expect(aendereAufgabe(gebunden.id, { archiviert: true }, JETZT).archiviert).toBe(true);
      expect(() => loescheVorlage(vorlageId)).toThrow(/genutzt/);
      aendereEinstellungen({ ebenen: { projekte: false } });
      expect(() => lege({ vorlageId, projektId: projekt.id, name: 'Sperre' })).toThrow('Projekte sind ausgeschaltet.');
    });
  });
});
