import { createServer, type Server } from 'node:http';
import { mkdirSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ausfuehren, eine, mitWeltAsync, schliesseWelt } from '../../db.ts';
import { AppFehler } from '../../fehler.ts';
import { starteTodoistAttrappe, type TodoistAttrappe } from '../../integrationen/todoistAttrappe.ts';
import { verbindungsRouten } from '../../routes/verbindungen.ts';
import { erstelleProjekt, erstelleVision } from '../../services/struktur.ts';
import { erstelleVorlage } from '../taetigkeiten/vorlagen.ts';
import { erstelleKalender, gleicheKalenderAb, ladeKalenderListe } from './kalender.ts';
import { leseWert, setzeWert } from './gemeinsam.ts';
import { gleicheTodoistAb } from './todoistAbgleich.ts';
import { SCHLUESSEL, ladeTodoistStatus, verbindeTodoist } from './todoist.ts';

const TOKEN = 'test-token-1234';
const TEST_SCHLUESSEL = Buffer.from('stride-test-token-schluessel-v3!').toString('base64');
const vorherStride = process.env.STRIDE_TOKEN_SCHLUESSEL;
const vorherAscend = process.env.ASCEND_TOKEN_SCHLUESSEL;
const basis = path.join('tmp-test', 'verbindungs-fehler-art');
mkdirSync(basis, { recursive: true });
const ordner = mkdtempSync(path.join(basis, 'lauf-'));
const offen: string[] = [];
const attrappen: TodoistAttrappe[] = [];
const httpServer: Server[] = [];
let nummer = 0;

const KALENDER_TEXT = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Stride//DE',
  'BEGIN:VEVENT',
  'UID:kurz',
  'SUMMARY:Kurz',
  'DTSTART:20261027T150500Z',
  'DTEND:20261027T151000Z',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

function welt(): string {
  nummer += 1;
  const datei = path.join(ordner, `${nummer}.db`);
  offen.push(datei);
  return datei;
}

function setzeTestschluessel(): void {
  process.env.STRIDE_TOKEN_SCHLUESSEL = TEST_SCHLUESSEL;
  delete process.env.ASCEND_TOKEN_SCHLUESSEL;
}

function stelleSchluesselHer(): void {
  if (vorherStride === undefined) {
    delete process.env.STRIDE_TOKEN_SCHLUESSEL;
  } else {
    process.env.STRIDE_TOKEN_SCHLUESSEL = vorherStride;
  }
  if (vorherAscend === undefined) {
    delete process.env.ASCEND_TOKEN_SCHLUESSEL;
  } else {
    process.env.ASCEND_TOKEN_SCHLUESSEL = vorherAscend;
  }
}

beforeEach(() => {
  setzeTestschluessel();
});

afterEach(async () => {
  stelleSchluesselHer();
  delete process.env.TODOIST_API;
  while (attrappen.length > 0) {
    await attrappen.pop()?.stop();
  }
  await Promise.all(httpServer.splice(0).map((http) => new Promise<void>((resolve) => http.close(() => resolve()))));
  for (const datei of offen.splice(0)) {
    schliesseWelt(datei);
  }
});

function koerperId(): number {
  const id = eine<{ id: number }>(`SELECT id FROM attribute WHERE kennung = 'koerper'`)?.id;
  if (id === undefined) {
    throw new Error('Körper fehlt.');
  }
  return id;
}

function schaltServer(): Promise<{ url: string; lage: { status: number } }> {
  const lage = { status: 200 };
  return new Promise((resolve) => {
    const http = createServer((_anfrage, antwort) => {
      antwort.writeHead(lage.status, { 'content-type': 'text/calendar; charset=utf-8' });
      antwort.end(lage.status === 200 ? KALENDER_TEXT : '');
    });
    httpServer.push(http);
    http.listen(0, '127.0.0.1', () => {
      const adresse = http.address();
      const port = typeof adresse === 'object' && adresse ? adresse.port : 0;
      resolve({ url: `http://127.0.0.1:${port}/kalender.ics`, lage });
    });
  });
}

function ziel(): { projektId: number; vorlageId: number } {
  const vorlage = erstelleVorlage({
    name: 'Allgemein',
    icon: 'star',
    gewichte: [{ attributId: koerperId(), gewicht: 1 }],
  });
  const vision = erstelleVision({
    titel: 'Weg',
    beschreibung: '',
    farbe: '#34d399',
    woopErgebnis: '',
    woopHindernis: '',
    woopPlan: '',
    level: null,
  });
  const projekt = erstelleProjekt({
    name: 'Ziel',
    beschreibung: '',
    visionId: vision.id,
    organisationId: null,
    standardVorlageId: vorlage.id,
  });
  return { projektId: projekt.id, vorlageId: vorlage.id };
}

describe('Todoist merkt sich die Fehlerart', () => {
  it('speichert die Art, lässt den Altsatz gelten und leert beides', async () => {
    const attrappe = await starteTodoistAttrappe({ projekte: [], ereignisse: [] });
    process.env.TODOIST_API = attrappe.basis;
    attrappen.push(attrappe);
    await mitWeltAsync(welt(), async () => {
      await verbindeTodoist(TOKEN);
      setzeWert(SCHLUESSEL.fehler, 'Todoist ist gerade nicht erreichbar.');
      setzeWert(SCHLUESSEL.fehlerArt, null);
      expect(ladeTodoistStatus().fehlerArt).toBe('netz');

      setzeWert(SCHLUESSEL.fehlerArt, 'bremse');
      expect(leseWert(SCHLUESSEL.fehlerArt)).toBe('bremse');
      expect(ladeTodoistStatus().fehlerArt).toBe('bremse');

      await verbindeTodoist(TOKEN);
      expect(ladeTodoistStatus().fehler).toBeNull();
      expect(ladeTodoistStatus().fehlerArt).toBeNull();

      process.env.TODOIST_API = 'http://127.0.0.1:1';
      const gescheitert = await gleicheTodoistAb();
      expect(gescheitert.fehler[0]).toBe('Todoist ist gerade nicht erreichbar.');
      expect(ladeTodoistStatus().fehlerArt).toBe('netz');

      process.env.TODOIST_API = attrappe.basis;
      const wieder = await gleicheTodoistAb();
      expect(wieder.fehler).toEqual([]);
      expect(ladeTodoistStatus().fehler).toBeNull();
      expect(ladeTodoistStatus().fehlerArt).toBeNull();
    });
  });
});

describe('Kalender merkt sich die Fehlerart', () => {
  it('speichert die Art der ersten Zeile und leert sie nach dem Erfolg', async () => {
    const server = await schaltServer();
    await mitWeltAsync(welt(), async () => {
      const { projektId, vorlageId } = ziel();
      await erstelleKalender({ name: 'Arbeit', adresse: server.url, projektId, vorlageId, filter: '' });
      server.lage.status = 500;
      const gescheitert = await gleicheKalenderAb();
      expect(gescheitert.fehler).toEqual(['Der Kalender hat die Anfrage abgelehnt.']);
      expect(ladeKalenderListe()[0]?.fehlerArt).toBe('gegenstelle');

      expect(
        ausfuehren(
          'UPDATE kalender SET fehler = ?, fehler_art = NULL WHERE name = ?',
          'Der Kalender ist gerade nicht erreichbar.',
          'Arbeit',
        ).geaendert,
      ).toBe(1);
      expect(ladeKalenderListe()[0]?.fehlerArt).toBe('netz');
      expect(ausfuehren('UPDATE kalender SET fehler_art = ? WHERE name = ?', 'fehlt', 'Arbeit').geaendert).toBe(1);
      expect(ladeKalenderListe()[0]?.fehlerArt).toBe('fehlt');

      server.lage.status = 200;
      const wieder = await gleicheKalenderAb();
      expect(wieder.fehler).toEqual([]);
      expect(ladeKalenderListe()[0]?.fehler).toBeNull();
      expect(ladeKalenderListe()[0]?.fehlerArt).toBeNull();
    });
  });
});

describe('Todoist-Token vor dem Kontakt', () => {
  it('antwortet auf einen zu kurzen Token mit 400 ohne Feldnamen', async () => {
    const app = Fastify({ logger: false });
    app.setErrorHandler((fehler, _anfrage, antwort) => {
      if (fehler instanceof AppFehler) {
        return antwort.status(fehler.statusCode).send({ fehler: fehler.message });
      }
      return antwort.status(500).send({ fehler: 'Interner Fehler. Details stehen im Server-Log.' });
    });
    await app.register(verbindungsRouten, { prefix: '/api' });
    try {
      const antwort = await app.inject({
        method: 'PUT',
        url: '/api/verbindungen/todoist',
        payload: { token: 'kurz' },
      });
      expect(antwort.statusCode).toBe(400);
      const koerper = antwort.json() as { fehler: string };
      expect(koerper.fehler).toBe('Der Todoist-Token ist zu kurz.');
      expect(koerper.fehler).not.toContain('(token)');
    } finally {
      await app.close();
    }
  });
});
