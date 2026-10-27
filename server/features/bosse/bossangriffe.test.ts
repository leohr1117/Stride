import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { AufgabeDaten } from '../../../shared/api/aufgaben.ts';
import { BOSS } from '../../../shared/spiel/xp.ts';
import { alle, ausfuehren, eine, mitWelt, schliesseWelt } from '../../db.ts';
import { aendereEinstellungen } from '../einstellungen/einstellungen.ts';
import { loescheEintrag } from '../eintraege/eintraege.ts';
import { erstelleVorlage } from '../taetigkeiten/vorlagen.ts';
import { aendereVorhaben, erstelleVorhaben } from '../ziele/vorhaben.ts';
import { erstelleProjekt } from '../../services/struktur.ts';
import { aendereAufgabe, erledigeAufgabe, erstelleAufgabe, loescheAufgabe } from '../aufgaben/aufgaben.ts';
import { rechneBossangriffeAb } from './bossangriffe.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-angriff-'));
const offen: string[] = [];
let nummer = 0;
const JETZT = new Date(2026, 9, 23, 15, 0, 0);
const HEUTE = '2026-10-23';
const GESTERN = '2026-10-22';
const MORGEN = new Date(2026, 9, 24, 15, 0, 0);

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

interface Angriff {
  quelle: string;
  xp: number;
  eintragId: number | null;
  vorhabenId: number | null;
  aufgabeId: number | null;
}

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

function attributId(kennung: string): number {
  const id = eine<{ id: number }>('SELECT id FROM attribute WHERE kennung = ?', kennung)?.id;
  if (id === undefined) {
    throw new Error(`${kennung} fehlt.`);
  }
  return id;
}

function vorlage(): number {
  return erstelleVorlage({
    name: 'Anruf',
    icon: 'star',
    gewichte: [{ attributId: attributId('koerper'), gewicht: 1 }],
  }).id;
}

function bucheDisziplin(xp: number): void {
  ausfuehren(
    `INSERT INTO xp_ereignisse (quelle, attribut_id, xp, erstellt_am) VALUES ('eintrag', ?, ?, ?)`,
    attributId('disziplin'),
    xp,
    '2026-10-01T10:00:00.000Z',
  );
}

function disziplinXp(): number {
  return (
    eine<{ xp: number }>(
      'SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse WHERE attribut_id = ?',
      attributId('disziplin'),
    )?.xp ?? 0
  );
}

function lege(extra: Partial<AufgabeDaten>): { id: number } {
  return erstelleAufgabe({ ...LEER, ...extra }, JETZT);
}

function deadlineGestern(id: number): void {
  ausfuehren('UPDATE aufgaben SET deadline = ? WHERE id = ?', GESTERN, id);
}

function angriffBis(id: number): string | null {
  return eine<{ bis: string | null }>('SELECT angriff_bis AS bis FROM aufgaben WHERE id = ?', id)?.bis ?? null;
}

function vorhabenBis(id: number): string | null {
  return eine<{ bis: string | null }>('SELECT angriff_bis AS bis FROM vorhaben WHERE id = ?', id)?.bis ?? null;
}

function angriffe(): Angriff[] {
  return alle<Angriff>(
    `SELECT quelle, xp, eintrag_id AS eintragId, vorhaben_id AS vorhabenId, aufgabe_id AS aufgabeId
     FROM xp_ereignisse WHERE quelle = 'bossangriff' ORDER BY id`,
  );
}

function vorhabenBoss(vorlageId: number): number {
  const projekt = erstelleProjekt({
    name: 'Arena',
    beschreibung: '',
    visionId: null,
    organisationId: null,
    standardVorlageId: vorlageId,
  });
  const boss = erstelleVorhaben(projekt.id, 'Drache', JETZT);
  aendereVorhaben(boss.id, { boss: { deadline: HEUTE } }, JETZT);
  ausfuehren('UPDATE vorhaben SET deadline = ? WHERE id = ?', GESTERN, boss.id);
  return boss.id;
}

describe('Angriff auf Gegner und Boss-Aufgaben', () => {
  it('zieht 5 und 2 Disziplin und lässt den Vorhaben-Boss unverändert', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { bossAngriffe: true } });
      bucheDisziplin(100);
      const vorlageId = vorlage();
      const vorhabenId = vorhabenBoss(vorlageId);
      const boss = lege({ vorlageId, name: 'Steuer', meilenstein: true, boss: true, deadline: HEUTE, faelligAm: HEUTE });
      const gegner = lege({ vorlageId, name: 'Angebot', gegner: true, deadline: HEUTE, faelligAm: HEUTE });
      deadlineGestern(boss.id);
      deadlineGestern(gegner.id);
      const ruhend = lege({ vorlageId, name: 'Heute', gegner: true, deadline: HEUTE, faelligAm: HEUTE });
      const archiv = lege({ vorlageId, name: 'Archiv', gegner: true, deadline: HEUTE, faelligAm: HEUTE });
      deadlineGestern(archiv.id);
      aendereAufgabe(archiv.id, { archiviert: true }, JETZT);
      const erledigt = lege({ vorlageId, name: 'Fertig', gegner: true, deadline: HEUTE, faelligAm: HEUTE });
      deadlineGestern(erledigt.id);
      erledigeAufgabe(erledigt.id, JETZT);

      rechneBossangriffeAb(JETZT);

      expect(angriffe()).toEqual([
        {
          quelle: 'bossangriff',
          xp: -BOSS.angriffXpProTag,
          eintragId: null,
          vorhabenId,
          aufgabeId: null,
        },
      ]);
      expect(disziplinXp()).toBe(100 - 5);
      expect(vorhabenBis(vorhabenId)).toBe(HEUTE);
      expect(angriffBis(boss.id)).toBeNull();
      expect(angriffBis(gegner.id)).toBeNull();
      expect(angriffBis(ruhend.id)).toBeNull();
      expect(angriffBis(archiv.id)).toBeNull();
      expect(angriffBis(erledigt.id)).toBeNull();

      rechneBossangriffeAb(JETZT);
      expect(disziplinXp()).toBe(100 - 5);
      expect(angriffe()).toHaveLength(1);
    });
  });

  it('lässt überfällige Aufgaben liegen, auch am nächsten Tag', () => {
    mitWelt(welt(), () => {
      bucheDisziplin(40);
      const vorlageId = vorlage();
      const boss = lege({ vorlageId, meilenstein: true, boss: true, deadline: HEUTE, faelligAm: HEUTE });
      const gegner = lege({ vorlageId, gegner: true, deadline: HEUTE, faelligAm: HEUTE });
      deadlineGestern(boss.id);
      deadlineGestern(gegner.id);

      rechneBossangriffeAb(JETZT);
      expect(disziplinXp()).toBe(40);
      expect(angriffe()).toEqual([]);
      expect(angriffBis(boss.id)).toBeNull();
      expect(angriffBis(gegner.id)).toBeNull();

      aendereEinstellungen({ funktionen: { bossAngriffe: true } });
      rechneBossangriffeAb(JETZT);
      expect(disziplinXp()).toBe(40);
      expect(angriffe()).toEqual([]);

      rechneBossangriffeAb(MORGEN);
      expect(disziplinXp()).toBe(40);
      expect(angriffBis(boss.id)).toBeNull();
      expect(angriffBis(gegner.id)).toBeNull();
      expect(angriffe()).toEqual([]);
    });
  });

  it('greift nicht an, wenn der alte Schalter aufgaben gespeichert ist', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { bossAngriffe: true } });
      ausfuehren(
        `INSERT INTO einstellungen (schluessel, wert) VALUES ('funktionen', ?)
         ON CONFLICT (schluessel) DO UPDATE SET wert = excluded.wert`,
        JSON.stringify({ bossAngriffe: true, aufgaben: true, koennen: true, status: true, handbuch: true }),
      );
      bucheDisziplin(3);
      const vorlageId = vorlage();
      const boss = lege({ vorlageId, meilenstein: true, boss: true, deadline: HEUTE, faelligAm: HEUTE });
      deadlineGestern(boss.id);
      const gegner = lege({ vorlageId, gegner: true, deadline: HEUTE, faelligAm: HEUTE });
      deadlineGestern(gegner.id);

      rechneBossangriffeAb(JETZT);
      expect(angriffBis(boss.id)).toBeNull();
      expect(angriffBis(gegner.id)).toBeNull();
      expect(disziplinXp()).toBe(3);
      expect(angriffe()).toEqual([]);
    });
  });

  it('gibt den Schaden beim Löschen zurück und behält ihn beim weggenommenen Haken', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { bossAngriffe: true } });
      bucheDisziplin(40);
      const vorlageId = vorlage();
      const boss = lege({ vorlageId, meilenstein: true, boss: true, deadline: HEUTE, faelligAm: HEUTE });
      const gegner = lege({ vorlageId, gegner: true, deadline: HEUTE, faelligAm: HEUTE });
      deadlineGestern(boss.id);
      deadlineGestern(gegner.id);
      rechneBossangriffeAb(JETZT);
      expect(disziplinXp()).toBe(40);
      expect(angriffe()).toEqual([]);

      loescheAufgabe(boss.id);
      expect(disziplinXp()).toBe(40);

      const ergebnis = erledigeAufgabe(gegner.id, JETZT);
      expect(ergebnis.belohnung.boni.some((bonus) => bonus.label === 'Gegner besiegt')).toBe(true);
      loescheEintrag(ergebnis.eintrag.id);
      expect(disziplinXp()).toBe(40);
      expect(angriffe()).toEqual([]);
      expect(
        eine<{ n: number }>(
          `SELECT COUNT(*) AS n FROM xp_ereignisse WHERE eintrag_id = ? AND quelle = 'meilenstein'`,
          ergebnis.eintrag.id,
        )?.n,
      ).toBe(0);
    });
  });

  it('rechnet Vorhaben weiter ab, wenn Aufgaben aus sind', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { bossAngriffe: true } });
      bucheDisziplin(20);
      const vorhabenId = vorhabenBoss(vorlage());
      rechneBossangriffeAb(JETZT);
      expect(angriffe()).toEqual([
        {
          quelle: 'bossangriff',
          xp: -BOSS.angriffXpProTag,
          eintragId: null,
          vorhabenId,
          aufgabeId: null,
        },
      ]);
      expect(vorhabenBis(vorhabenId)).toBe(HEUTE);
      expect(disziplinXp()).toBe(20 - 5);
    });
  });

  it('schreibt angriff_bis ohne Abzug, wenn Vorhaben aus sind', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { bossAngriffe: true }, ebenen: { vorhaben: false } });
      bucheDisziplin(20);
      const vorlageId = vorlage();
      const gegner = lege({ vorlageId, gegner: true, deadline: HEUTE, faelligAm: HEUTE });
      deadlineGestern(gegner.id);
      rechneBossangriffeAb(JETZT);
      expect(disziplinXp()).toBe(20);
      expect(angriffe()).toEqual([]);
      expect(angriffBis(gegner.id)).toBeNull();
    });
  });
});
