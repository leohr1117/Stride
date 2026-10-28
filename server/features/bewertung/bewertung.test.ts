import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import type { EintragDaten, EintragErgebnis } from '../../../shared/api/index.ts';
import { lokalesDatum, tagPlus } from '../../../shared/spiel/datum.ts';
import { ausfuehren, eine, mitWelt, mitWeltAsync, schliesseWelt } from '../../db.ts';
import { AppFehler } from '../../fehler.ts';
import {
  aendereEinstellungen,
  ladeEinstellungen,
  leseBewertungAm,
  leseBewertungNie,
  leseBewertungTesten,
  leseBewertungWert,
  schreibeBewertungWert,
} from '../einstellungen/einstellungen.ts';
import { erstelleEintrag } from '../eintraege/eintraege.ts';
import { erstelleVorlage } from '../taetigkeiten/vorlagen.ts';
import { schliesseEinheitAb, starteEinheit } from '../training/einheiten.ts';
import { an, DANACH, kraft, plan, raeumeAuf, START, vorlage, welt as trainingWelt } from '../training/einheitenHilfe.ts';
import { ladeUebersicht } from '../uebersicht/uebersicht.ts';
import { bewertungSchema, einstellungenAenderungSchema } from '../../validierung.ts';
import { BEWERTUNG_SCHON, bewertungFaellig, schreibeBewertungNie, speichereBewertung } from './bewertung.ts';
import { bewertungRouten } from './routen.ts';

const MONTAG = '2026-10-19';
const DIENSTAG = '2026-10-20';
const ENDE = '2026-10-23';

const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-bewertung-'));
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
  raeumeAuf();
});

function mittag(tag: string): Date {
  const [jahr, monat, tageszahl] = tag.split('-').map(Number);
  return new Date(jahr, monat - 1, tageszahl, 12, 0, 0);
}

function tunId(): number {
  const koerper = eine<{ id: number }>('SELECT id FROM attribute WHERE kennung = ?', 'koerper')?.id;
  if (koerper === undefined) {
    throw new Error('Körper fehlt.');
  }
  return erstelleVorlage({ name: 'Tun', icon: 'star', gewichte: [{ attributId: koerper, gewicht: 1 }] }).id;
}

function attributId(kennung: string): number {
  const id = eine<{ id: number }>('SELECT id FROM attribute WHERE kennung = ?', kennung)?.id;
  if (id === undefined) {
    throw new Error(`${kennung} fehlt.`);
  }
  return id;
}

function roh(vorlageId: number, tag: string, abschluss: 'gescheitert' | null = null): void {
  ausfuehren(
    `INSERT INTO eintraege (vorlage_id, stunden, notiz, abschluss, erstellt_am) VALUES (?, 1, '', ?, ?)`,
    vorlageId,
    abschluss,
    mittag(tag).toISOString(),
  );
}

function logge(vorlageId: number, tag: string): EintragErgebnis {
  const daten: EintragDaten = {
    projektId: null,
    vorlageId,
    vorhaben: null,
    abschluss: null,
    erkenntnis: '',
    stunden: 1,
    notiz: '',
    meilenstein: false,
    faehigkeitId: null,
    datum: null,
  };
  return erstelleEintrag(daten, mittag(tag));
}

function fuelle(vorlageId: number, anzahl: number, tag: string): void {
  for (let index = 0; index < anzahl; index += 1) {
    roh(vorlageId, tag);
  }
}

function mitUmgebung(wert: string | undefined, arbeit: () => void): void {
  const vorher = process.env.ASCEND_TEST;
  if (wert === undefined) {
    delete process.env.ASCEND_TEST;
  } else {
    process.env.ASCEND_TEST = wert;
  }
  try {
    arbeit();
  } finally {
    if (vorher === undefined) {
      delete process.env.ASCEND_TEST;
    } else {
      process.env.ASCEND_TEST = vorher;
    }
  }
}

async function mitRouten<T>(arbeit: (app: FastifyInstance) => Promise<T>): Promise<T> {
  const app = Fastify({ logger: false });
  app.setErrorHandler((fehler, _anfrage, antwort) => {
    if (fehler instanceof ZodError) {
      return antwort.status(400).send({ fehler: 'ungültig' });
    }
    if (fehler instanceof AppFehler) {
      return antwort.status(fehler.statusCode).send({ fehler: fehler.message });
    }
    return antwort.status(500).send({ fehler: 'Interner Fehler. Details stehen im Server-Log.' });
  });
  await app.register(bewertungRouten, { prefix: '/api' });
  try {
    return await arbeit(app);
  } finally {
    await app.close();
  }
}

describe('Bewertung fällig', () => {
  it('fehlt auf der Übersicht und beim neunten Eintrag, der zehnte setzt sie', () => {
    mitWelt(welt(), () => {
      const id = tunId();
      fuelle(id, 8, MONTAG);
      expect(logge(id, MONTAG).bewertungFaellig).toBeUndefined();
      expect(ladeUebersicht(mittag(MONTAG))).not.toHaveProperty('bewertungFaellig');
      expect(logge(id, DIENSTAG).bewertungFaellig).toBe(true);
      expect(ladeUebersicht(mittag(DIENSTAG))).not.toHaveProperty('bewertungFaellig');
    });
  });

  it('setzt sie bei einer Kette von 7 und nicht bei 6', () => {
    mitWelt(welt(), () => {
      const id = tunId();
      for (let versatz = 5; versatz >= 1; versatz -= 1) {
        roh(id, tagPlus(ENDE, -versatz));
      }
      expect(logge(id, ENDE).bewertungFaellig).toBeUndefined();
    });
    mitWelt(welt(), () => {
      const id = tunId();
      for (let versatz = 6; versatz >= 1; versatz -= 1) {
        roh(id, tagPlus(ENDE, -versatz));
      }
      expect(logge(id, ENDE).bewertungFaellig).toBe(true);
    });
  });

  it('zählt einen besiegten Boss und eine fertige Trainingseinheit, ein normales Vorhaben nicht', () => {
    mitWelt(welt(), () => {
      const id = tunId();
      ausfuehren(`INSERT INTO vorhaben (titel, status, boss) VALUES ('Sache', 'geschafft', 0)`);
      expect(logge(id, MONTAG).bewertungFaellig).toBeUndefined();
    });
    mitWelt(welt(), () => {
      const id = tunId();
      ausfuehren(
        `INSERT INTO vorhaben (titel, status, boss, abgeschlossen_am) VALUES ('Boss', 'geschafft', 1, ?)`,
        mittag(MONTAG).toISOString(),
      );
      expect(logge(id, MONTAG).bewertungFaellig).toBe(true);
    });
    mitWelt(welt(), () => {
      const id = tunId();
      ausfuehren(
        `INSERT INTO trainingseinheiten (plan_id, eintrag_id, status, begonnen_am) VALUES (NULL, NULL, 'fertig', ?)`,
        mittag(MONTAG).toISOString(),
      );
      expect(logge(id, MONTAG).bewertungFaellig).toBe(true);
    });
  });

  it('hängt sie an den Abschluss einer offenen Einheit und nicht an einen zweiten Abschluss', () => {
    mitWelt(trainingWelt(), () => {
      an();
      const einheit = starteEinheit(plan('Kraft', [kraft('Kniebeuge')], vorlage('Kraft')).id, START);
      const erste = schliesseEinheitAb(einheit.id, START);
      expect(erste.bewertungFaellig).toBe(true);
      const zweite = schliesseEinheitAb(einheit.id, DANACH);
      expect(zweite.bewertungFaellig).toBeUndefined();
    });
  });

  it('bleibt aus, wenn nie oder ein Wert schon gespeichert ist', () => {
    mitWelt(welt(), () => {
      const id = tunId();
      schreibeBewertungNie();
      fuelle(id, 9, MONTAG);
      expect(logge(id, MONTAG).bewertungFaellig).toBeUndefined();
    });
    mitWelt(welt(), () => {
      const id = tunId();
      schreibeBewertungWert(4, MONTAG);
      fuelle(id, 9, MONTAG);
      expect(logge(id, MONTAG).bewertungFaellig).toBeUndefined();
    });
  });

  it('bleibt unter ASCEND_TEST aus, bis bewertung_testen gesetzt ist, und die Antwort nennt den Schlüssel nicht', () => {
    mitUmgebung('1', () => {
      mitWelt(welt(), () => {
        const id = tunId();
        fuelle(id, 9, MONTAG);
        expect(logge(id, MONTAG).bewertungFaellig).toBeUndefined();
        const geladen = aendereEinstellungen({ bewertungTesten: true });
        expect(geladen).not.toHaveProperty('bewertungTesten');
        expect(JSON.stringify(geladen)).not.toContain('bewertung');
        expect(leseBewertungTesten()).toBe(true);
        expect(logge(id, DIENSTAG).bewertungFaellig).toBe(true);
      });
    });
    mitUmgebung(undefined, () => {
      mitWelt(welt(), () => {
        const geladen = aendereEinstellungen({ bewertungTesten: true });
        expect(geladen).not.toHaveProperty('bewertungTesten');
        expect(leseBewertungTesten()).toBe(false);
        expect(einstellungenAenderungSchema.parse({ bewertungTesten: true }).bewertungTesten).toBe(true);
      });
    });
  });

  it('sperrt den Tag eines Verlusts, eines Verfalls, eines Bossangriffs und einer offenen Rückkehr', () => {
    mitWelt(welt(), () => {
      const id = tunId();
      fuelle(id, 8, MONTAG);
      roh(id, MONTAG, 'gescheitert');
      expect(logge(id, MONTAG).bewertungFaellig).toBeUndefined();
      expect(logge(id, DIENSTAG).bewertungFaellig).toBe(true);
    });
    mitWelt(welt(), () => {
      const id = tunId();
      fuelle(id, 9, MONTAG);
      ausfuehren(
        `INSERT INTO xp_ereignisse (quelle, attribut_id, xp, erstellt_am) VALUES ('verfall', ?, -1, ?)`,
        attributId('koerper'),
        mittag(MONTAG).toISOString(),
      );
      expect(logge(id, MONTAG).bewertungFaellig).toBeUndefined();
    });
    mitWelt(welt(), () => {
      const id = tunId();
      fuelle(id, 9, MONTAG);
      ausfuehren(
        `INSERT INTO xp_ereignisse (quelle, attribut_id, xp, erstellt_am) VALUES ('bossangriff', ?, -1, ?)`,
        attributId('disziplin'),
        mittag(MONTAG).toISOString(),
      );
      expect(logge(id, MONTAG).bewertungFaellig).toBeUndefined();
    });
    mitWelt(welt(), () => {
      const id = tunId();
      fuelle(id, 9, MONTAG);
      ausfuehren(`INSERT INTO vorhaben (titel, status, boss, angriff_bis) VALUES ('Angriff', 'offen', 1, ?)`, MONTAG);
      expect(logge(id, MONTAG).bewertungFaellig).toBeUndefined();
    });
    mitWelt(welt(), () => {
      const id = tunId();
      fuelle(id, 9, MONTAG);
      ausfuehren(`INSERT INTO protokoll (art, tag) VALUES ('rueckkehr_offen', ?)`, MONTAG);
      expect(logge(id, MONTAG).bewertungFaellig).toBeUndefined();
    });
  });

  it('bleibt aus, wenn das Profil in diesem Aufruf gerade angelegt wurde', () => {
    mitWelt(welt(), () => {
      const id = tunId();
      fuelle(id, 10, MONTAG);
      expect(bewertungFaellig(mittag(MONTAG), true)).toBe(false);
      expect(bewertungFaellig(mittag(MONTAG), false)).toBe(true);
    });
  });
});

describe('POST /api/bewertung', () => {
  it('speichert eine Zahl oder nie genau einmal', async () => {
    await mitWeltAsync(welt(), async () => {
      expect(speichereBewertung({ wert: 3 }, mittag(MONTAG))).toEqual({ wert: 3, am: MONTAG, nie: false });
      expect(leseBewertungWert()).toBe(3);
      expect(leseBewertungAm()).toBe(MONTAG);
      expect(() => speichereBewertung({ wert: 4 }, mittag(DIENSTAG))).toThrow(BEWERTUNG_SCHON);
      await mitRouten(async (app) => {
        const nochmal = await app.inject({ method: 'POST', url: '/api/bewertung', payload: { wert: 1 } });
        expect(nochmal.statusCode).toBe(400);
        expect(nochmal.json()).toEqual({ fehler: BEWERTUNG_SCHON });
        const fehlen = await app.inject({ method: 'GET', url: '/api/bewertung' });
        expect(fehlen.statusCode).toBe(404);
      });
    });
    await mitWeltAsync(welt(), async () => {
      expect(speichereBewertung({ nie: true }, mittag(MONTAG))).toEqual({ wert: null, am: null, nie: true });
      expect(leseBewertungNie()).toBe(true);
      expect(leseBewertungWert()).toBeNull();
      await mitRouten(async (app) => {
        const nochmal = await app.inject({ method: 'POST', url: '/api/bewertung', payload: { nie: true } });
        expect(nochmal.statusCode).toBe(400);
        expect(nochmal.json()).toEqual({ fehler: BEWERTUNG_SCHON });
      });
    });
  });

  it('nimmt nur genau eines von Zahl oder nie', async () => {
    await mitWeltAsync(welt(), async () => {
      expect(bewertungSchema.parse({ wert: 5 })).toEqual({ wert: 5 });
      expect(bewertungSchema.parse({ nie: true })).toEqual({ nie: true });
      for (const eingabe of [{}, { nie: false }, { wert: 0 }, { wert: 6 }, { wert: 1.5 }, { wert: 3, nie: true }]) {
        expect(() => bewertungSchema.parse(eingabe)).toThrow(ZodError);
      }
      await mitRouten(async (app) => {
        const leer = await app.inject({ method: 'POST', url: '/api/bewertung', payload: {} });
        expect(leer.statusCode).toBe(400);
        const beides = await app.inject({ method: 'POST', url: '/api/bewertung', payload: { wert: 3, nie: true } });
        expect(beides.statusCode).toBe(400);
        const heute = lokalesDatum(new Date());
        const zahl = await app.inject({ method: 'POST', url: '/api/bewertung', payload: { wert: 2 } });
        expect(zahl.statusCode).toBe(200);
        expect(zahl.json()).toEqual({ wert: 2, am: heute, nie: false });
        expect(ladeEinstellungen()).not.toHaveProperty('bewertungTesten');
        expect(JSON.stringify(ladeEinstellungen())).not.toContain('bewertung');
      });
    });
  });
});
