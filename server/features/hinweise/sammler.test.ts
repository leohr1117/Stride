import { readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { tagPlus } from '../../../shared/spiel/datum.ts';
import { HINWEIS_SCHLUESSEL } from '../../../shared/spiel/hinweis.ts';
import { alle, ausfuehren, eine, mitWelt, schliesseWelt } from '../../db.ts';
import { aendereEinstellungen } from '../einstellungen/einstellungen.ts';
import { leseHinweisNichtVor, schreibeHinweisRuhe, schreibeHinweisSchalter } from '../einstellungen/hinweisSchluessel.ts';
import { setzeHinweisNichtVorWennFehlt } from '../einstellungen/hinweisSchluessel.ts';
import { sammleHinweise, type HinweisSammlung } from './sammler.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-sammler-'));
const offen: string[] = [];
let nummer = 0;

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

function anzahl(sql: string): number {
  return eine<{ anzahl: number }>(sql)?.anzahl ?? 0;
}

function hinweisZeilen(): string[] {
  return alle<{ schluessel: string }>(
    `SELECT schluessel FROM einstellungen WHERE schluessel LIKE 'hinweis_%' ORDER BY schluessel`,
  ).map((zeile) => zeile.schluessel);
}

function zeit(tag: string, uhrzeit: string): Date {
  return new Date(`${tag}T${uhrzeit}:00.000Z`);
}

function vorlage(): number {
  return ausfuehren(`INSERT INTO vorlagen (name, icon) VALUES ('Tun', 'star')`).id;
}

function eintragAm(vorlageId: number, tag: string, uhrzeit = '12:00'): void {
  ausfuehren(
    `INSERT INTO eintraege (vorlage_id, stunden, notiz, erstellt_am) VALUES (?, 1, '', ?)`,
    vorlageId,
    zeit(tag, uhrzeit).toISOString(),
  );
}

function kette(vorlageId: number, tage: string[]): void {
  for (const tag of tage) {
    eintragAm(vorlageId, tag);
  }
}

function schalter(teil: { streak?: boolean; rueckkehr?: boolean; boss?: boolean }): void {
  schreibeHinweisSchalter(teil);
}

function zone(name: string): void {
  aendereEinstellungen({ zeitzone: name });
}

function bossZeile(titel: string, deadline: string, status = 'offen', boss = 1): number {
  return ausfuehren(
    `INSERT INTO vorhaben (titel, status, boss, deadline) VALUES (?, ?, ?, ?)`,
    titel,
    status,
    boss,
    deadline,
  ).id;
}

function rueckkehrOffen(geoeffnetAm: string, fristAm: string, status = 'offen'): number {
  return ausfuehren(
    `INSERT INTO rueckkehr (status, geoeffnet_am, frist_am) VALUES (?, ?, ?)`,
    status,
    geoeffnetAm,
    fristAm,
  ).id;
}

function push(art: string, tag: string, bezugTyp: string | null = null, bezugId: number | null = null): void {
  ausfuehren(
    `INSERT INTO protokoll (art, bezug_typ, bezug_id, tag) VALUES (?, ?, ?, ?)`,
    art,
    bezugTyp,
    bezugId,
    tag,
  );
}

function unberuehrt(arbeit: () => HinweisSammlung): HinweisSammlung {
  const protokolle = anzahl('SELECT COUNT(*) AS anzahl FROM protokoll');
  const xp = anzahl('SELECT COUNT(*) AS anzahl FROM xp_ereignisse');
  const ergebnis = arbeit();
  expect(anzahl('SELECT COUNT(*) AS anzahl FROM protokoll')).toBe(protokolle);
  expect(anzahl('SELECT COUNT(*) AS anzahl FROM xp_ereignisse')).toBe(xp);
  return ergebnis;
}

describe('Sammler', () => {
  it('fragt Aufgaben, Training und den Sender nicht ab und schreibt nicht', () => {
    const quelle = readFileSync(fileURLToPath(new URL('./sammler.ts', import.meta.url)), 'utf8');
    for (const verboten of [
      'aufgaben',
      'trainingsplaene',
      'trainingseinheiten',
      'hinweis_faellig',
      'hinweis_training',
      'web-push',
      'ausfuehren',
      'INSERT',
    ]) {
      expect(quelle.includes(verboten)).toBe(false);
    }
  });

  it('meldet einen angeschlagenen Streak ab Länge 2 und lässt kürzere aus', () => {
    mitWelt(welt(), () => {
      zone('UTC');
      schalter({ streak: true });
      const id = vorlage();
      kette(id, ['2026-07-12', '2026-07-13']);
      const getroffen = unberuehrt(() => sammleHinweise(zeit('2026-07-15', '10:00')));
      expect(getroffen.gewinner).toEqual({ art: 'streak', name: '2', ziel: '/', bezugId: null });
      expect(getroffen.daneben).toEqual([]);
      expect(sammleHinweise(zeit('2026-07-15', '10:00')).gewinner?.art).toBe('streak');
    });
    mitWelt(welt(), () => {
      zone('UTC');
      schalter({ streak: true, rueckkehr: true, boss: true });
      eintragAm(vorlage(), '2026-07-13');
      expect(sammleHinweise(zeit('2026-07-15', '10:00')).gewinner).toBeNull();
    });
  });

  it('schickt nichts, solange die Kette hält, heute schon läuft oder gerissen ist', () => {
    mitWelt(welt(), () => {
      zone('UTC');
      schalter({ streak: true });
      const id = vorlage();
      kette(id, ['2026-07-12', '2026-07-13', '2026-07-14']);
      expect(sammleHinweise(zeit('2026-07-15', '10:00')).gewinner).toBeNull();
      eintragAm(id, '2026-07-15');
      expect(sammleHinweise(zeit('2026-07-15', '10:00')).gewinner).toBeNull();
    });
    mitWelt(welt(), () => {
      zone('UTC');
      schalter({ streak: true });
      kette(vorlage(), ['2026-07-10', '2026-07-11']);
      expect(sammleHinweise(zeit('2026-07-15', '10:00')).gewinner).toBeNull();
    });
  });

  it('schickt am Brückentag nichts und am angeschlagenen Tag trotzdem', () => {
    mitWelt(welt(), () => {
      zone('UTC');
      schalter({ streak: true });
      const id = vorlage();
      kette(id, ['2026-07-12', '2026-07-13']);
      ausfuehren(`INSERT INTO streak_bruecken (tag) VALUES ('2026-07-15')`);
      expect(sammleHinweise(zeit('2026-07-15', '10:00')).gewinner?.art).toBe('streak');
      expect(sammleHinweise(zeit('2026-07-16', '10:00')).gewinner).toBeNull();
    });
  });

  it('nimmt die offene Rückkehr einmal, mit dem Fristtag als Namen', () => {
    mitWelt(welt(), () => {
      zone('UTC');
      schalter({ rueckkehr: true });
      rueckkehrOffen('2026-07-01', '2026-07-08', 'zu');
      const alt = rueckkehrOffen('2026-07-08', '2026-07-15');
      push('push_gesendet', '2026-07-09', 'rueckkehr', alt);
      const neu = rueckkehrOffen('2026-07-10', '2026-07-17');
      const ergebnis = unberuehrt(() => sammleHinweise(zeit('2026-07-15', '10:00')));
      expect(ergebnis.gewinner).toEqual({ art: 'rueckkehr', name: '2026-07-17', ziel: '/', bezugId: neu });
    });
    mitWelt(welt(), () => {
      zone('UTC');
      schalter({ rueckkehr: true });
      rueckkehrOffen('2026-07-01', '2026-07-08', 'zu');
      rueckkehrOffen('2026-07-02', '2026-07-09', 'geschafft');
      expect(sammleHinweise(zeit('2026-07-15', '10:00')).gewinner).toBeNull();
    });
  });

  it('lässt eine Rückkehr aus, die schon einen Push hatte, auch an einem späteren Tag', () => {
    mitWelt(welt(), () => {
      zone('UTC');
      schalter({ streak: true, rueckkehr: true });
      const id = rueckkehrOffen('2026-07-08', '2026-07-20');
      push('push_gesendet', '2026-07-09', 'rueckkehr', id);
      kette(vorlage(), ['2026-07-12', '2026-07-13']);
      const ergebnis = sammleHinweise(zeit('2026-07-15', '10:00'));
      expect(ergebnis.gewinner?.art).toBe('streak');
      expect(ergebnis.daneben).toEqual([]);
    });
    mitWelt(welt(), () => {
      zone('UTC');
      schalter({ rueckkehr: true });
      const neu = rueckkehrOffen('2026-07-12', '2026-07-19');
      const alt = rueckkehrOffen('2026-07-08', '2026-07-15');
      push('push_gesendet', '2026-07-10', 'rueckkehr', alt);
      expect(sammleHinweise(zeit('2026-07-15', '10:00')).gewinner).toBeNull();
      expect(neu).toBeLessThan(alt);
    });
  });

  it('nimmt nur den offenen Vorhaben-Boss von morgen, Frist dann Name dann Id', () => {
    mitWelt(welt(), () => {
      zone('UTC');
      schalter({ boss: true });
      aendereEinstellungen({ funktionen: { bossAngriffe: true } });
      const heute = '2026-07-15';
      const morgen = tagPlus(heute, 1);
      bossZeile('Aaa', morgen, 'geschafft');
      bossZeile('Aaa', morgen, 'offen', 0);
      bossZeile('Aaa', tagPlus(morgen, 1));
      bossZeile('Aaa', heute);
      const frueher = bossZeile('Gleich', morgen);
      const spaeter = bossZeile('Gleich', morgen);
      bossZeile('Zeta', morgen);
      const ergebnis = unberuehrt(() => sammleHinweise(zeit(heute, '10:00')));
      expect(ergebnis.gewinner).toEqual({ art: 'boss', name: 'Gleich', ziel: '/', bezugId: frueher });
      expect(frueher).toBeLessThan(spaeter);
    });
  });

  it('lässt den Boss aus, wenn Angriffe oder Vorhaben aus sind', () => {
    mitWelt(welt(), () => {
      zone('UTC');
      schalter({ boss: true });
      bossZeile('Lauf', '2026-07-16');
      expect(sammleHinweise(zeit('2026-07-15', '10:00')).gewinner).toBeNull();
      aendereEinstellungen({ funktionen: { bossAngriffe: true }, ebenen: { vorhaben: false } });
      expect(sammleHinweise(zeit('2026-07-15', '10:00')).gewinner).toBeNull();
      aendereEinstellungen({ ebenen: { vorhaben: true } });
      expect(sammleHinweise(zeit('2026-07-15', '10:00')).gewinner?.name).toBe('Lauf');
    });
  });

  it('stellt Streak vor Rückkehr und Boss und merkt die übrigen', () => {
    mitWelt(welt(), () => {
      zone('UTC');
      schalter({ streak: true, rueckkehr: true, boss: true });
      aendereEinstellungen({ funktionen: { bossAngriffe: true } });
      kette(vorlage(), ['2026-07-12', '2026-07-13']);
      const rueckkehr = rueckkehrOffen('2026-07-08', '2026-07-20');
      const boss = bossZeile('Lauf beginnen', '2026-07-16');
      const ergebnis = sammleHinweise(zeit('2026-07-15', '10:00'));
      expect(ergebnis.gewinner?.art).toBe('streak');
      expect(ergebnis.daneben.map((anlass) => anlass.art)).toEqual(['rueckkehr', 'boss']);
      expect(ergebnis.daneben.map((anlass) => anlass.bezugId)).toEqual([rueckkehr, boss]);
    });
    mitWelt(welt(), () => {
      zone('UTC');
      schalter({ streak: false, rueckkehr: true, boss: true });
      aendereEinstellungen({ funktionen: { bossAngriffe: true } });
      kette(vorlage(), ['2026-07-12', '2026-07-13']);
      rueckkehrOffen('2026-07-08', '2026-07-20');
      bossZeile('Lauf', '2026-07-16');
      const ergebnis = sammleHinweise(zeit('2026-07-15', '10:00'));
      expect(ergebnis.gewinner?.art).toBe('rueckkehr');
      expect(ergebnis.daneben.map((anlass) => anlass.art)).toEqual(['boss']);
    });
  });

  it('lässt ausgeschaltete Schalter leer und legt beim Lesen keine Schlüssel an', () => {
    mitWelt(welt(), () => {
      zone('UTC');
      kette(vorlage(), ['2026-07-12', '2026-07-13']);
      rueckkehrOffen('2026-07-08', '2026-07-20');
      bossZeile('Lauf', '2026-07-16');
      aendereEinstellungen({ funktionen: { bossAngriffe: true } });
      expect(unberuehrt(() => sammleHinweise(zeit('2026-07-15', '10:00'))).gewinner).toBeNull();
      expect(hinweisZeilen()).toEqual([]);
      expect(JSON.stringify(aendereEinstellungen({ sound: false }).funktionen)).not.toContain('hinweis_');
    });
  });

  it('blockt den Tag nach einem Push und lässt Ausgelassen und den Vortag zu', () => {
    mitWelt(welt(), () => {
      zone('UTC');
      schalter({ streak: true });
      kette(vorlage(), ['2026-07-12', '2026-07-13']);
      push('push_ausgelassen', '2026-07-15', 'boss', null);
      push('push_gesendet', '2026-07-14', 'streak', null);
      expect(sammleHinweise(zeit('2026-07-15', '10:00')).gewinner?.art).toBe('streak');
      push('push_gesendet', '2026-07-15', 'streak', null);
      const ergebnis = unberuehrt(() => sammleHinweise(zeit('2026-07-15', '10:00')));
      expect(ergebnis).toEqual({ gewinner: null, daneben: [] });
    });
  });

  it('schreibt in der Ruhezeit nichts und sendet am Ende', () => {
    mitWelt(welt(), () => {
      zone('UTC');
      schalter({ streak: true });
      kette(vorlage(), ['2026-07-12', '2026-07-13']);
      expect(unberuehrt(() => sammleHinweise(zeit('2026-07-15', '07:59'))).gewinner).toBeNull();
      expect(sammleHinweise(zeit('2026-07-15', '22:00')).gewinner).toBeNull();
      expect(sammleHinweise(zeit('2026-07-15', '21:59')).gewinner?.art).toBe('streak');
      expect(sammleHinweise(zeit('2026-07-15', '08:00')).gewinner?.art).toBe('streak');
      schreibeHinweisRuhe('08:00', '08:00');
      expect(sammleHinweise(zeit('2026-07-15', '03:00')).gewinner?.art).toBe('streak');
      expect(sammleHinweise(zeit('2026-07-15', '08:00')).gewinner?.art).toBe('streak');
    });
  });

  it('wartet auf hinweis_nicht_vor und lässt die Zeile stehen', () => {
    mitWelt(welt(), () => {
      zone('UTC');
      schalter({ streak: true });
      kette(vorlage(), ['2026-07-12', '2026-07-13']);
      setzeHinweisNichtVorWennFehlt(zeit('2026-07-15', '09:59'));
      const grenze = leseHinweisNichtVor();
      expect(grenze).toBe('2026-07-15T10:00:00.000Z');
      expect(unberuehrt(() => sammleHinweise(zeit('2026-07-15', '09:59'))).gewinner).toBeNull();
      expect(sammleHinweise(zeit('2026-07-15', '10:00')).gewinner?.art).toBe('streak');
      expect(leseHinweisNichtVor()).toBe(grenze);
      expect(hinweisZeilen()).not.toContain(HINWEIS_SCHLUESSEL.ruheVon);
    });
  });

  it('lässt die Art leer, wenn ihre Tabelle fehlt, und sendet ohne Protokoll nicht', () => {
    mitWelt(welt(), () => {
      zone('UTC');
      schalter({ streak: true, rueckkehr: true, boss: true });
      aendereEinstellungen({ funktionen: { bossAngriffe: true } });
      kette(vorlage(), ['2026-07-12', '2026-07-13']);
      rueckkehrOffen('2026-07-08', '2026-07-20');
      bossZeile('Lauf', '2026-07-16');
      ausfuehren('DROP TABLE streak_bruecken');
      const ohneBruecke = sammleHinweise(zeit('2026-07-15', '10:00'));
      expect(ohneBruecke.gewinner?.art).toBe('streak');
      expect(ohneBruecke.daneben.map((anlass) => anlass.art)).toEqual(['rueckkehr', 'boss']);
    });
    mitWelt(welt(), () => {
      zone('UTC');
      schalter({ streak: true, rueckkehr: true, boss: true });
      aendereEinstellungen({ funktionen: { bossAngriffe: true } });
      kette(vorlage(), ['2026-07-12', '2026-07-13']);
      rueckkehrOffen('2026-07-08', '2026-07-20');
      bossZeile('Lauf', '2026-07-16');
      ausfuehren('DROP TABLE rueckkehr');
      const ohneRueckkehr = sammleHinweise(zeit('2026-07-15', '10:00'));
      expect(ohneRueckkehr.gewinner?.art).toBe('streak');
      expect(ohneRueckkehr.daneben.map((anlass) => anlass.art)).toEqual(['boss']);
    });
    mitWelt(welt(), () => {
      zone('UTC');
      schalter({ streak: true });
      kette(vorlage(), ['2026-07-12', '2026-07-13']);
      ausfuehren('DROP TABLE protokoll');
      expect(sammleHinweise(zeit('2026-07-15', '10:00'))).toEqual({ gewinner: null, daneben: [] });
    });
  });

  it('ignoriert fällige Aufgaben, Training und Boss-Aufgaben', () => {
    mitWelt(welt(), () => {
      zone('UTC');
      schalter({ streak: true, rueckkehr: true, boss: true });
      aendereEinstellungen({ funktionen: { bossAngriffe: true } });
      const id = vorlage();
      ausfuehren(
        `INSERT INTO aufgaben (name, icon, vorlage_id, faellig_am, faellig_um) VALUES ('Arzt anrufen', 'star', ?, '2026-07-15', '09:00')`,
        id,
      );
      ausfuehren(
        `INSERT INTO aufgaben (name, icon, vorlage_id, gegner, deadline) VALUES ('Gegner', 'star', ?, 1, '2026-07-16')`,
        id,
      );
      ausfuehren(
        `INSERT INTO aufgaben (name, icon, vorlage_id, meilenstein, boss, deadline, wiederholung)
         VALUES ('Aufgabenboss', 'star', ?, 1, 1, '2026-07-16', 'keine')`,
        id,
      );
      ausfuehren(
        `INSERT INTO trainingsplaene (name, wochentage, vorlage_id) VALUES ('Unterkörper', '3', ?)`,
        id,
      );
      expect(unberuehrt(() => sammleHinweise(zeit('2026-07-15', '10:00'))).gewinner).toBeNull();
      const vorhaben = bossZeile('Lauf beginnen', '2026-07-16');
      expect(sammleHinweise(zeit('2026-07-15', '10:00')).gewinner).toEqual({
        art: 'boss',
        name: 'Lauf beginnen',
        ziel: '/',
        bezugId: vorhaben,
      });
    });
  });

  it('rechnet Streak und Boss in der Nutzerzone', () => {
    mitWelt(welt(), () => {
      schreibeHinweisRuhe('12:00', '12:00');
      schalter({ streak: true });
      kette(vorlage(), ['2026-07-12', '2026-07-13']);
      zone('Europe/Berlin');
      expect(sammleHinweise(zeit('2026-07-15', '06:30')).gewinner).toEqual({
        art: 'streak',
        name: '2',
        ziel: '/',
        bezugId: null,
      });
      zone('America/Los_Angeles');
      expect(sammleHinweise(zeit('2026-07-15', '06:30')).gewinner).toBeNull();
    });
    mitWelt(welt(), () => {
      zone('Europe/Berlin');
      schalter({ streak: true });
      kette(vorlage(), ['2026-07-12', '2026-07-13']);
      expect(unberuehrt(() => sammleHinweise(zeit('2026-07-15', '05:59'))).gewinner).toBeNull();
      expect(sammleHinweise(zeit('2026-07-15', '06:00')).gewinner?.art).toBe('streak');
    });
    mitWelt(welt(), () => {
      schreibeHinweisRuhe('12:00', '12:00');
      schalter({ boss: true });
      aendereEinstellungen({ funktionen: { bossAngriffe: true } });
      const id = bossZeile('Lauf beginnen', '2026-07-16');
      zone('Europe/Berlin');
      expect(sammleHinweise(zeit('2026-07-15', '22:30')).gewinner).toBeNull();
      zone('America/Los_Angeles');
      expect(sammleHinweise(zeit('2026-07-15', '22:30')).gewinner).toEqual({
        art: 'boss',
        name: 'Lauf beginnen',
        ziel: '/',
        bezugId: id,
      });
    });
  });
});
