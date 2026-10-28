import { readdirSync, readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { localeFuer } from '../../../shared/sprache/kern.ts';
import { zeige } from '../../../shared/sprache/index.ts';
import { alle, ausfuehren, eine, mitWeltAsync, schliesseWelt } from '../../db.ts';
import { aendereEinstellungen } from '../einstellungen/einstellungen.ts';
import { setzeHinweisNichtVorWennFehlt } from '../einstellungen/hinweisSchluessel.ts';
import { schreibeHinweisRuhe, schreibeHinweisSchalter } from '../einstellungen/hinweisSchluessel.ts';
import { sammleHinweise } from './sammler.ts';
import {
  ergebnisFuerFehler,
  sendeHinweise,
  sendeHinweiseWennBereit,
  type PushErgebnis,
  type PushNutzlast,
  type PushSenden,
  type PushZiel,
} from './sender.ts';

const wurzel = fileURLToPath(new URL('../../..', import.meta.url));
const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-sender-'));
const offen: string[] = [];
const ENDPUNKT = 'https://push.example/geheim-endpunkt-7f3a';
const P256 = 'p256dh-geheim-aa';
const AUTH = 'auth-geheim-bb';
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

function zeit(tag: string, uhrzeit: string): Date {
  return new Date(`${tag}T${uhrzeit}:00.000Z`);
}

function vorlage(): number {
  return ausfuehren(`INSERT INTO vorlagen (name, icon) VALUES ('Tun', 'star')`).id;
}

function eintragAm(vorlageId: number, tag: string): void {
  ausfuehren(
    `INSERT INTO eintraege (vorlage_id, stunden, notiz, erstellt_am) VALUES (?, 1, '', ?)`,
    vorlageId,
    zeit(tag, '12:00').toISOString(),
  );
}

function kette(): void {
  const id = vorlage();
  eintragAm(id, '2026-07-12');
  eintragAm(id, '2026-07-13');
}

function abo(endpoint = ENDPUNKT, p256dh = P256, auth = AUTH): number {
  return ausfuehren(`INSERT INTO push_abos (endpoint, p256dh, auth) VALUES (?, ?, ?)`, endpoint, p256dh, auth).id;
}

function ungueltigAm(id: number): string | null {
  return eine<{ wert: string | null }>('SELECT ungueltig_am AS wert FROM push_abos WHERE id = ?', id)?.wert ?? null;
}

interface ProtokollZeile {
  art: string;
  bezugTyp: string | null;
  bezugId: number | null;
  tag: string | null;
}

function protokolle(): ProtokollZeile[] {
  return alle<ProtokollZeile>(
    `SELECT art, bezug_typ AS bezugTyp, bezug_id AS bezugId, tag FROM protokoll ORDER BY id`,
  );
}

function fest(status: PushErgebnis['status'], httpStatus: number | null = null): PushSenden {
  return async () => ({ status, httpStatus });
}

function sammleAufrufe(senden: PushSenden): { senden: PushSenden; aufrufe: { abo: PushZiel; nutzlast: PushNutzlast }[] } {
  const aufrufe: { abo: PushZiel; nutzlast: PushNutzlast }[] = [];
  return {
    aufrufe,
    senden: async (ziel, nutzlast) => {
      aufrufe.push({ abo: ziel, nutzlast });
      return senden(ziel, nutzlast);
    },
  };
}

function tsDateien(start: string): string[] {
  const fund: string[] = [];
  for (const eintrag of readdirSync(start, { withFileTypes: true })) {
    const pfad = path.join(start, eintrag.name);
    if (eintrag.isDirectory()) {
      fund.push(...tsDateien(pfad));
    } else if (eintrag.name.endsWith('.ts')) {
      fund.push(pfad);
    }
  }
  return fund;
}

function relativ(pfad: string): string {
  return path.relative(wurzel, pfad).replaceAll('\\', '/');
}

function importiertPaket(quelle: string): boolean {
  return /(?:from\s+|require\(\s*)['"]web-push['"]/.test(quelle);
}

describe('Sender', () => {
  it('schreibt den Gewinner und die übrigen erst nach dem Versand', async () => {
    await mitWeltAsync(welt(), async () => {
      aendereEinstellungen({ zeitzone: 'UTC', funktionen: { bossAngriffe: true } });
      schreibeHinweisSchalter({ streak: true, rueckkehr: true, boss: true });
      kette();
      const rueckkehr = ausfuehren(
        `INSERT INTO rueckkehr (status, geoeffnet_am, frist_am) VALUES ('offen', '2026-07-08', '2026-07-20')`,
      ).id;
      const boss = ausfuehren(
        `INSERT INTO vorhaben (titel, status, boss, deadline) VALUES ('Lauf beginnen', 'offen', 1, '2026-07-16')`,
      ).id;
      abo();
      const xp = anzahl('SELECT COUNT(*) AS anzahl FROM xp_ereignisse');
      const attrappe = sammleAufrufe(fest('ok', 201));
      const jetzt = zeit('2026-07-15', '10:00');
      expect(await sendeHinweise(attrappe.senden, jetzt, () => {})).toBe(1);
      expect(attrappe.aufrufe).toHaveLength(1);
      expect(Object.keys(attrappe.aufrufe[0]?.nutzlast ?? {}).sort()).toEqual(['body', 'data', 'title']);
      expect(attrappe.aufrufe[0]?.nutzlast.title).toBe(
        (JSON.parse(readFileSync(path.join(wurzel, 'client', 'public', 'manifest.webmanifest'), 'utf8')) as { name: string }).name,
      );
      expect(attrappe.aufrufe[0]?.nutzlast.body).toBe('2 Tage sind angeschlagen. Ein Eintrag heute hält sie.');
      expect(attrappe.aufrufe[0]?.nutzlast.body.includes('!')).toBe(false);
      expect(attrappe.aufrufe[0]?.nutzlast.data).toEqual({ ziel: '/' });
      expect(protokolle()).toEqual([
        { art: 'push_gesendet', bezugTyp: 'streak', bezugId: null, tag: '2026-07-15' },
        { art: 'push_ausgelassen', bezugTyp: 'rueckkehr', bezugId: rueckkehr, tag: '2026-07-15' },
        { art: 'push_ausgelassen', bezugTyp: 'boss', bezugId: boss, tag: '2026-07-15' },
      ]);
      expect(JSON.stringify(alle('SELECT * FROM protokoll'))).not.toContain(ENDPUNKT);
      expect(anzahl('SELECT COUNT(*) AS anzahl FROM xp_ereignisse')).toBe(xp);
      expect(sammleHinweise(jetzt).gewinner).toBeNull();
      expect(await sendeHinweise(attrappe.senden, jetzt, () => {})).toBe(0);
      expect(attrappe.aufrufe).toHaveLength(1);
    });
  });

  it('lässt den Hinweis Kandidat, wenn kein Gerät annimmt', async () => {
    await mitWeltAsync(welt(), async () => {
      aendereEinstellungen({ zeitzone: 'UTC' });
      schreibeHinweisSchalter({ streak: true });
      kette();
      const id = abo();
      const jetzt = zeit('2026-07-15', '10:00');
      const zeilen: string[] = [];
      expect(await sendeHinweise(fest('fehler', 500), jetzt, (zeile) => zeilen.push(zeile))).toBe(0);
      expect(protokolle()).toEqual([]);
      expect(ungueltigAm(id)).toBeNull();
      expect(zeilen).toEqual([`Push fehlgeschlagen. Status 500. Abo ${id}.`]);
      expect(sammleHinweise(jetzt).gewinner?.art).toBe('streak');
      expect(await sendeHinweise(fest('ok', 201), jetzt, () => {})).toBe(1);
      expect(protokolle().map((zeile) => zeile.art)).toEqual(['push_gesendet']);
    });
  });

  it('setzt 410 und 404 nur an dieser Zeile und schickt das zweite Gerät', async () => {
    for (const status of [410, 404] as const) {
      await mitWeltAsync(welt(), async () => {
        aendereEinstellungen({ zeitzone: 'UTC' });
        schreibeHinweisSchalter({ streak: true });
        kette();
        const tot = abo(ENDPUNKT);
        const lebendig = abo('https://push.example/anderes-geraet', 'p256-anders', 'auth-anders');
        const alt = abo('https://push.example/schon-tot', 'p256-alt', 'auth-alt');
        ausfuehren(`UPDATE push_abos SET ungueltig_am = ? WHERE id = ?`, '2026-01-01T00:00:00.000Z', alt);
        const zeilen: string[] = [];
        const attrappe = sammleAufrufe(async (ziel) => {
          if (ziel.id === tot) {
            return { status: 'ungueltig', httpStatus: status };
          }
          return { status: 'ok', httpStatus: 201 };
        });
        const jetzt = zeit('2026-07-15', '10:00');
        expect(await sendeHinweise(attrappe.senden, jetzt, (zeile) => zeilen.push(zeile))).toBe(1);
        expect(attrappe.aufrufe.map((aufruf) => aufruf.abo.id)).toEqual([tot, lebendig]);
        expect(ungueltigAm(tot)).toBe(jetzt.toISOString());
        expect(ungueltigAm(lebendig)).toBeNull();
        expect(ungueltigAm(alt)).toBe('2026-01-01T00:00:00.000Z');
        expect(zeilen).toEqual([`Push fehlgeschlagen. Status ${status}. Abo ${tot}.`]);
        expect(zeilen.join('\n')).not.toContain(ENDPUNKT);
        expect(zeilen.join('\n')).not.toContain(P256);
        expect(zeilen.join('\n')).not.toContain(AUTH);
        expect(protokolle()).toHaveLength(1);
      });
    }
  });

  it('lässt andere Status stehen und loggt weder Endpunkt noch Schlüssel', async () => {
    await mitWeltAsync(welt(), async () => {
      aendereEinstellungen({ zeitzone: 'UTC' });
      schreibeHinweisSchalter({ streak: true });
      kette();
      const id = abo();
      const zeilen: string[] = [];
      const werfe: PushSenden = async () => {
        throw new Error(`${ENDPUNKT} ${P256} ${AUTH} privater-schluessel`);
      };
      expect(await sendeHinweise(werfe, zeit('2026-07-15', '10:00'), (zeile) => zeilen.push(zeile))).toBe(0);
      expect(ungueltigAm(id)).toBeNull();
      expect(zeilen).toEqual([`Push fehlgeschlagen. Status ohne. Abo ${id}.`]);
      expect(zeilen.join('\n')).not.toContain(ENDPUNKT);
      expect(zeilen.join('\n')).not.toContain('privater-schluessel');
      expect(protokolle()).toEqual([]);
    });
  });

  it('schreibt in der Ruhezeit nichts und sendet am Ende genau einmal', async () => {
    await mitWeltAsync(welt(), async () => {
      aendereEinstellungen({ zeitzone: 'UTC' });
      schreibeHinweisSchalter({ streak: true });
      kette();
      abo();
      const attrappe = sammleAufrufe(fest('ok', 201));
      expect(await sendeHinweise(attrappe.senden, zeit('2026-07-15', '07:59'), () => {})).toBe(0);
      expect(attrappe.aufrufe).toHaveLength(0);
      expect(protokolle()).toEqual([]);
      expect(await sendeHinweise(attrappe.senden, zeit('2026-07-15', '08:00'), () => {})).toBe(1);
      expect(attrappe.aufrufe).toHaveLength(1);
    });
  });

  it('wartet ohne Zeile, bis ein Gerät da ist und nicht_vor vorbei ist', async () => {
    await mitWeltAsync(welt(), async () => {
      aendereEinstellungen({ zeitzone: 'UTC' });
      schreibeHinweisSchalter({ streak: true });
      kette();
      const jetzt = zeit('2026-07-15', '10:00');
      const attrappe = sammleAufrufe(fest('ok', 201));
      expect(await sendeHinweise(attrappe.senden, jetzt, () => {})).toBe(0);
      expect(protokolle()).toEqual([]);
      abo();
      setzeHinweisNichtVorWennFehlt(zeit('2026-07-15', '10:00'));
      expect(await sendeHinweise(attrappe.senden, jetzt, () => {})).toBe(0);
      expect(attrappe.aufrufe).toHaveLength(0);
      expect(await sendeHinweise(attrappe.senden, zeit('2026-07-15', '10:01'), () => {})).toBe(1);
    });
  });

  it('sendet ohne Protokoll oder ohne Abos nicht', async () => {
    await mitWeltAsync(welt(), async () => {
      aendereEinstellungen({ zeitzone: 'UTC' });
      schreibeHinweisSchalter({ streak: true });
      kette();
      abo();
      ausfuehren('DROP TABLE protokoll');
      const attrappe = sammleAufrufe(fest('ok', 201));
      expect(await sendeHinweise(attrappe.senden, zeit('2026-07-15', '10:00'), () => {})).toBe(0);
      expect(attrappe.aufrufe).toHaveLength(0);
    });
    await mitWeltAsync(welt(), async () => {
      aendereEinstellungen({ zeitzone: 'UTC' });
      schreibeHinweisSchalter({ streak: true });
      kette();
      ausfuehren('DROP TABLE push_abos');
      expect(await sendeHinweise(fest('ok', 201), zeit('2026-07-15', '10:00'), () => {})).toBe(0);
      expect(protokolle()).toEqual([]);
    });
  });

  it('speichert den Tag der Nutzerzone und übersetzt den Text', async () => {
    await mitWeltAsync(welt(), async () => {
      aendereEinstellungen({ zeitzone: 'Europe/Berlin', sprache: 'en' });
      schreibeHinweisRuhe('12:00', '12:00');
      schreibeHinweisSchalter({ streak: true });
      const id = vorlage();
      eintragAm(id, '2026-07-13');
      eintragAm(id, '2026-07-14');
      abo();
      const attrappe = sammleAufrufe(fest('ok', 201));
      expect(await sendeHinweise(attrappe.senden, zeit('2026-07-15', '23:00'), () => {})).toBe(1);
      expect(protokolle()[0]?.tag).toBe('2026-07-16');
      expect(attrappe.aufrufe[0]?.nutzlast.body).toBe(
        zeige('{laenge} Tage sind angeschlagen. Ein Eintrag heute hält sie.', 'en', { laenge: '2' }),
      );
    });
    await mitWeltAsync(welt(), async () => {
      aendereEinstellungen({ zeitzone: 'UTC', sprache: 'de' });
      schreibeHinweisSchalter({ rueckkehr: true });
      ausfuehren(`INSERT INTO rueckkehr (status, geoeffnet_am, frist_am) VALUES ('offen', '2026-10-23', '2026-10-30')`);
      abo();
      const attrappe = sammleAufrufe(fest('ok', 201));
      expect(await sendeHinweise(attrappe.senden, zeit('2026-10-28', '10:00'), () => {})).toBe(1);
      const datum = new Intl.DateTimeFormat(localeFuer('de'), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
        new Date(Date.UTC(2026, 9, 30)),
      );
      expect(attrappe.aufrufe[0]?.nutzlast.body).toBe(`Die Rückkehr ist offen bis ${datum}.`);
      expect(attrappe.aufrufe[0]?.nutzlast.body.includes('2026-10-30')).toBe(false);
    });
    await mitWeltAsync(welt(), async () => {
      aendereEinstellungen({ zeitzone: 'UTC', sprache: 'en', funktionen: { bossAngriffe: true } });
      schreibeHinweisSchalter({ boss: true });
      ausfuehren(
        `INSERT INTO vorhaben (titel, status, boss, deadline) VALUES ('Lauf beginnen', 'offen', 1, '2026-07-16')`,
      );
      abo();
      const attrappe = sammleAufrufe(fest('ok', 201));
      expect(await sendeHinweise(attrappe.senden, zeit('2026-07-15', '10:00'), () => {})).toBe(1);
      expect(attrappe.aufrufe[0]?.nutzlast.body).toBe('Tomorrow is the date: Lauf beginnen.');
    });
  });

  it('warnt ohne Versand, wenn der Server nicht eingerichtet ist', async () => {
    await mitWeltAsync(welt(), async () => {
      aendereEinstellungen({ zeitzone: 'UTC' });
      schreibeHinweisSchalter({ streak: true });
      kette();
      abo();
      const zeilen: string[] = [];
      const attrappe = sammleAufrufe(fest('ok', 201));
      const log = (zeile: string) => zeilen.push(zeile);
      const jetzt = zeit('2026-07-15', '10:00');
      expect(await sendeHinweiseWennBereit(false, attrappe.senden, jetzt, log)).toBe(0);
      expect(await sendeHinweiseWennBereit(false, attrappe.senden, jetzt, log)).toBe(0);
      expect(attrappe.aufrufe).toHaveLength(0);
      expect(protokolle()).toEqual([]);
      expect(zeilen).toEqual(['Benachrichtigungen sind auf diesem Server nicht eingerichtet.']);
      expect(zeilen.join('\n')).not.toContain('VAPID');
      expect(await sendeHinweiseWennBereit(true, attrappe.senden, jetzt, log)).toBe(1);
    });
  });

  it('macht aus 410 und 404 nur die Klasse, ohne Endpunkt und Text', () => {
    const geheim = 'https://push.example/fehler-endpunkt';
    const fehler = { statusCode: 410, endpoint: geheim, message: geheim, body: 'privater-schluessel' };
    expect(ergebnisFuerFehler(fehler)).toEqual({ status: 'ungueltig', httpStatus: 410 });
    expect(ergebnisFuerFehler({ statusCode: 404, endpoint: geheim })).toEqual({ status: 'ungueltig', httpStatus: 404 });
    expect(ergebnisFuerFehler({ statusCode: 500, endpoint: geheim })).toEqual({ status: 'fehler', httpStatus: 500 });
    expect(ergebnisFuerFehler({ statusCode: 401, endpoint: geheim })).toEqual({ status: 'fehler', httpStatus: 401 });
    expect(ergebnisFuerFehler(new Error(geheim))).toEqual({ status: 'fehler', httpStatus: null });
    expect(JSON.stringify(ergebnisFuerFehler(fehler))).not.toContain('geheim');
    expect(JSON.stringify(ergebnisFuerFehler(new Error(geheim)))).not.toContain(geheim);
  });

  it('importiert web-push nur im Produktions-Sender', () => {
    const dateien = [
      ...tsDateien(path.join(wurzel, 'server')),
      ...tsDateien(path.join(wurzel, 'client', 'src')),
      ...tsDateien(path.join(wurzel, 'shared')),
    ];
    const importe = dateien.filter((datei) => importiertPaket(readFileSync(datei, 'utf8'))).map(relativ);
    expect(importe).toEqual(['server/integrationen/webPush.ts']);
    const produktion = dateien.filter((datei) => !datei.endsWith('.test.ts'));
    for (const datei of produktion) {
      const quelle = readFileSync(datei, 'utf8');
      expect(quelle.includes('generateVAPIDKeys('), relativ(datei)).toBe(false);
      expect(quelle.includes('setVapidDetails('), relativ(datei)).toBe(false);
    }
    const webPush = readFileSync(path.join(wurzel, 'server', 'integrationen', 'webPush.ts'), 'utf8');
    expect(webPush.includes('console')).toBe(false);
    expect(webPush.includes('ungueltig_am')).toBe(false);
    expect(webPush.includes('push_gesendet')).toBe(false);
    expect(webPush.includes('fehler.endpoint')).toBe(false);
    expect(webPush.includes('fehler.message')).toBe(false);
    expect(webPush.includes('fehler.body')).toBe(false);
    expect(webPush.includes('ergebnisFuerFehler')).toBe(true);
  });
});
