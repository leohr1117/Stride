import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ABGLEICH_MINUTEN } from '../../../shared/api/index.ts';
import { datumInZone, tagPlus } from '../../../shared/spiel/datum.ts';
import { aktiverPfad, ausfuehren, eine, mitWelt, schliesseWelt } from '../../db.ts';
import * as webPush from '../../integrationen/webPush.ts';
import { schreibeHinweisRuhe, schreibeHinweisSchalter } from '../einstellungen/hinweisSchluessel.ts';
import { sammleHinweise } from '../hinweise/sammler.ts';
import { leseWert, setzeWert } from './gemeinsam.ts';
import { starteRegelmaessigenAbgleich } from './abgleich.ts';

const VAPID = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const;
const ENDPUNKT = 'https://push.example/takt-geraet';
const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-abgleich-'));
const offen: string[] = [];
let nummer = 0;

function welt(): string {
  nummer += 1;
  const datei = path.join(ordner, `${nummer}.db`);
  offen.push(datei);
  return datei;
}

function kanonisch(datei: string): string {
  return path.resolve(datei);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const datei of offen) {
    schliesseWelt(datei);
  }
  offen.length = 0;
});

function xp(): number {
  return eine<{ anzahl: number }>('SELECT COUNT(*) AS anzahl FROM xp_ereignisse')?.anzahl ?? 0;
}

function protokolle(): number {
  return eine<{ anzahl: number }>('SELECT COUNT(*) AS anzahl FROM protokoll')?.anzahl ?? 0;
}

describe('Hinweis-Takt', () => {
  it('startet nur den vorhandenen Takt', () => {
    const timeouts = vi.spyOn(globalThis, 'setTimeout');
    const intervals = vi.spyOn(globalThis, 'setInterval');
    const stop = starteRegelmaessigenAbgleich(() => [], () => undefined);
    expect(timeouts).toHaveBeenCalledTimes(1);
    expect(intervals).toHaveBeenCalledTimes(1);
    expect(timeouts.mock.calls[0]?.[1]).toBe(30_000);
    expect(intervals.mock.calls[0]?.[1]).toBe(ABGLEICH_MINUTEN * 60 * 1000);
    stop();
  });

  it('prüft die Hinweise nach dem Abgleich in derselben Weltrunde', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    const leer = welt();
    const berlin = welt();
    const ungueltig = welt();
    const serverZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    mitWelt(berlin, () => {
      setzeWert('zeitzone', 'Europe/Berlin');
    });
    mitWelt(ungueltig, () => {
      ausfuehren(
        `INSERT INTO einstellungen (schluessel, wert) VALUES ('zeitzone', ?)`,
        JSON.stringify('Kein/Zone'),
      );
    });
    const gesehen: string[] = [];
    vi.spyOn(webPush, 'pruefeHinweise').mockImplementation(async () => {
      const pfad = aktiverPfad();
      gesehen.push(pfad);
      const zone = leseWert('zeitzone');
      if (pfad === kanonisch(berlin)) {
        expect(zone).toBe('Europe/Berlin');
      } else if (pfad === kanonisch(ungueltig)) {
        expect(zone).toBe('Kein/Zone');
      } else {
        expect(zone).toBe(serverZone);
      }
      expect(xp()).toBe(0);
      return 0;
    });
    const fehler: unknown[] = [];
    const stop = starteRegelmaessigenAbgleich(
      () => [leer, berlin, ungueltig],
      (grund) => {
        fehler.push(grund);
      },
    );
    try {
      expect(gesehen).toEqual([]);
      await vi.advanceTimersByTimeAsync(29_000);
      expect(gesehen).toEqual([]);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(gesehen).toEqual([kanonisch(leer), kanonisch(berlin), kanonisch(ungueltig)]);
      await vi.advanceTimersByTimeAsync(ABGLEICH_MINUTEN * 60 * 1000);
      expect(gesehen).toHaveLength(6);
      await vi.advanceTimersByTimeAsync(ABGLEICH_MINUTEN * 60 * 1000);
      expect(gesehen).toHaveLength(9);
      expect(fehler).toEqual([]);
    } finally {
      stop();
    }
    mitWelt(leer, () => {
      expect(leseWert('zeitzone')).toBe(serverZone);
      expect(xp()).toBe(0);
    });
    mitWelt(berlin, () => {
      expect(leseWert('zeitzone')).toBe('Europe/Berlin');
    });
    mitWelt(ungueltig, () => {
      expect(leseWert('zeitzone')).toBe('Kein/Zone');
    });
  });

  it('bricht den restlichen Takt ab, wenn die Prüfung fehlschlägt', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    const erste = welt();
    const zweite = welt();
    const gesehen: string[] = [];
    vi.spyOn(webPush, 'pruefeHinweise').mockImplementation(async () => {
      const pfad = aktiverPfad();
      gesehen.push(pfad);
      if (pfad === kanonisch(erste)) {
        throw new Error('hinweis-kaputt');
      }
      return 0;
    });
    const fehler: unknown[] = [];
    const stop = starteRegelmaessigenAbgleich(
      () => [erste, zweite],
      (grund) => {
        fehler.push(grund);
      },
    );
    try {
      await vi.advanceTimersByTimeAsync(30_000);
    } finally {
      stop();
    }
    expect(gesehen).toEqual([kanonisch(erste)]);
    expect(fehler).toHaveLength(1);
  });

  it('vergibt für einen fälligen Hinweis keine XP', async () => {
    const vorher = new Map(VAPID.map((name) => [name, process.env[name]]));
    for (const name of VAPID) {
      delete process.env[name];
    }
    const warnungen: string[] = [];
    const warn = vi.spyOn(console, 'warn').mockImplementation((...teile: unknown[]) => {
      warnungen.push(teile.map(String).join(' '));
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    const datei = welt();
    try {
      mitWelt(datei, () => {
        setzeWert('zeitzone', 'UTC');
        schreibeHinweisRuhe('08:00', '08:00');
        schreibeHinweisSchalter({ streak: true });
        const heute = datumInZone(new Date(), 'UTC');
        const vorlage = ausfuehren(`INSERT INTO vorlagen (name, icon) VALUES ('Tun', 'star')`).id;
        for (const tag of [tagPlus(heute, -3), tagPlus(heute, -2)]) {
          ausfuehren(
            `INSERT INTO eintraege (vorlage_id, stunden, notiz, erstellt_am) VALUES (?, 1, '', ?)`,
            vorlage,
            `${tag}T12:00:00.000Z`,
          );
        }
        ausfuehren(`INSERT INTO push_abos (endpoint, p256dh, auth) VALUES (?, 'p256-takt', 'auth-takt')`, ENDPUNKT);
        expect(sammleHinweise(new Date()).gewinner?.art).toBe('streak');
        expect(xp()).toBe(0);
      });
      const stop = starteRegelmaessigenAbgleich(
        () => [datei],
        (grund) => {
          throw grund;
        },
      );
      try {
        await vi.advanceTimersByTimeAsync(30_000);
      } finally {
        stop();
      }
      mitWelt(datei, () => {
        expect(xp()).toBe(0);
        expect(protokolle()).toBe(0);
      });
      const text = warnungen.join('\n');
      expect(text).not.toContain(ENDPUNKT);
      expect(text).not.toContain('p256-takt');
      expect(text).not.toContain('auth-takt');
      expect(text.toLowerCase()).not.toContain('privat');
      expect(text).not.toContain('VAPID');
    } finally {
      warn.mockRestore();
      for (const name of VAPID) {
        const wert = vorher.get(name);
        if (wert === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = wert;
        }
      }
    }
  });
});
