import { createServer, type Server } from 'node:http';
import { mkdirSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { alle, eine, mitWeltAsync, schliesseWelt } from '../../db.ts';
import { erstelleProjekt, erstelleVision } from '../../services/struktur.ts';
import { erstelleVorlage } from '../taetigkeiten/vorlagen.ts';
import { erstelleKalender, gleicheKalenderAb, loescheKalender, pruefeKalender } from './kalender.ts';

const basis = path.join('tmp-bau', 'kalender-vitest');
mkdirSync(basis, { recursive: true });
const ordner = mkdtempSync(path.join(basis, 'lauf-'));
const offen: string[] = [];
const server: Server[] = [];
let nummer = 0;

const VERBINDET = new Date('2026-10-27T15:00:00.000Z');
const SPAETER = new Date('2026-10-27T18:00:00.000Z');

function welt(): string {
  nummer += 1;
  const datei = path.join(ordner, `${nummer}.db`);
  offen.push(datei);
  return datei;
}

function kalenderText(): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'X-WR-CALNAME:Arbeit',
    'BEGIN:VEVENT',
    'UID:frueher',
    'SUMMARY:Frueher',
    'DTSTART:20261027T100000Z',
    'DTEND:20261027T110000Z',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:ueberlappt',
    'SUMMARY:Ueberlappt',
    'DTSTART:20261027T140000Z',
    'DTEND:20261027T160000Z',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:danach',
    'SUMMARY:Danach',
    'DTSTART:20261027T160000Z',
    'DTEND:20261027T170000Z',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:fokus',
    'SUMMARY:Fokus Meeting',
    'DTSTART:20261027T151000Z',
    'DTEND:20261027T161000Z',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:offen',
    'SUMMARY:Offen',
    'DTSTART:20261027T180000Z',
    'DTEND:20261027T190000Z',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:ganz',
    'SUMMARY:Ganz',
    'DTSTART;VALUE=DATE:20261027',
    'DTEND;VALUE=DATE:20261028',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:kurz',
    'SUMMARY:Kurz',
    'DTSTART:20261027T150500Z',
    'DTEND:20261027T151000Z',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function icsServer(text: string): Promise<string> {
  return new Promise((resolve) => {
    const http = createServer((_anfrage, antwort) => {
      antwort.writeHead(200, { 'content-type': 'text/calendar; charset=utf-8' });
      antwort.end(text);
    });
    server.push(http);
    http.listen(0, '127.0.0.1', () => {
      const adresse = http.address();
      const port = typeof adresse === 'object' && adresse ? adresse.port : 0;
      resolve(`http://127.0.0.1:${port}/kalender.ics`);
    });
  });
}

function schaltServer(text: string): Promise<{ url: string; lage: { status: number } }> {
  const lage = { status: 200 };
  return new Promise((resolve) => {
    const http = createServer((_anfrage, antwort) => {
      antwort.writeHead(lage.status, { 'content-type': 'text/calendar; charset=utf-8' });
      antwort.end(lage.status === 200 ? text : '');
    });
    server.push(http);
    http.listen(0, '127.0.0.1', () => {
      const adresse = http.address();
      const port = typeof adresse === 'object' && adresse ? adresse.port : 0;
      resolve({ url: `http://127.0.0.1:${port}/kalender.ics`, lage });
    });
  });
}

afterEach(async () => {
  await Promise.all(server.splice(0).map((http) => new Promise<void>((resolve) => http.close(() => resolve()))));
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

function ziel(): { projektId: number; vorlageId: number } {
  const vorlageId = erstelleVorlage({
    name: 'Arbeit',
    icon: 'star',
    gewichte: [{ attributId: koerperId(), gewicht: 1 }],
  }).id;
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
    name: 'Beruf',
    beschreibung: '',
    visionId: vision.id,
    organisationId: null,
    standardVorlageId: vorlageId,
  });
  return { projektId: projekt.id, vorlageId };
}

function notizen(): string[] {
  return alle<{ notiz: string }>('SELECT notiz FROM eintraege ORDER BY notiz').map((zeile) => zeile.notiz);
}

describe('Kalenderprüfung und Abgleich', () => {
  it('prüft die Adresse und speichert dabei nichts', async () => {
    const adresse = await icsServer(kalenderText());
    await mitWeltAsync(welt(), async () => {
      const pruefung = await pruefeKalender(adresse);
      expect(pruefung).toEqual({ name: 'Arbeit' });
      expect(eine<{ wert: number }>('SELECT COUNT(*) AS wert FROM kalender')?.wert).toBe(0);
      expect(eine<{ wert: number }>('SELECT COUNT(*) AS wert FROM eintraege')?.wert).toBe(0);
    });
  });

  it('übernimmt nur Termine, die nach dem Verbinden enden, und ignoriert den Rest', async () => {
    const adresse = await icsServer(kalenderText());
    await mitWeltAsync(welt(), async () => {
      const { projektId, vorlageId } = ziel();
      const kalender = await erstelleKalender(
        { name: 'Arbeit', adresse, projektId, vorlageId, filter: '' },
        VERBINDET,
      );
      expect(kalender.seit).toBe(VERBINDET.toISOString());
      const ergebnis = await gleicheKalenderAb(SPAETER);
      expect(ergebnis.neu).toBe(3);
      expect(ergebnis.fehler).toEqual([]);
      expect(notizen()).toEqual(['Danach', 'Fokus Meeting', 'Ueberlappt']);
      expect(eine<{ stunden: number }>('SELECT stunden FROM eintraege WHERE notiz = ?', 'Ueberlappt')?.stunden).toBe(2);
    });
  });

  it('ignoriert Termine ohne passendes Stichwort', async () => {
    const adresse = await icsServer(kalenderText());
    await mitWeltAsync(welt(), async () => {
      const { projektId, vorlageId } = ziel();
      await erstelleKalender({ name: 'Arbeit', adresse, projektId, vorlageId, filter: 'Fokus' }, VERBINDET);
      const ergebnis = await gleicheKalenderAb(SPAETER);
      expect(ergebnis.neu).toBe(1);
      expect(notizen()).toEqual(['Fokus Meeting']);
    });
  });

  it('übernimmt denselben Termin kein zweites Mal, auch nicht nach dem Entfernen', async () => {
    const adresse = await icsServer(kalenderText());
    await mitWeltAsync(welt(), async () => {
      const { projektId, vorlageId } = ziel();
      const daten = { name: 'Arbeit', adresse, projektId, vorlageId, filter: '' };
      const kalender = await erstelleKalender(daten, VERBINDET);
      expect((await gleicheKalenderAb(SPAETER)).neu).toBe(3);
      expect((await gleicheKalenderAb(SPAETER)).neu).toBe(0);

      const zweiter = await erstelleKalender({ ...daten, name: 'Zweite' }, VERBINDET);
      expect((await gleicheKalenderAb(SPAETER)).neu).toBe(0);
      expect(notizen()).toEqual(['Danach', 'Fokus Meeting', 'Ueberlappt']);

      loescheKalender(kalender.id);
      loescheKalender(zweiter.id);
      expect(eine<{ wert: number }>('SELECT COUNT(*) AS wert FROM kalender')?.wert).toBe(0);
      expect(eine<{ wert: number }>('SELECT COUNT(*) AS wert FROM kalender_termine')?.wert).toBe(0);
      expect(eine<{ wert: number }>('SELECT COUNT(*) AS wert FROM kalender_importe')?.wert).toBe(3);
      expect(eine<{ wert: number }>('SELECT COUNT(*) AS wert FROM eintraege')?.wert).toBe(3);

      const wieder = await erstelleKalender(daten, VERBINDET);
      expect((await gleicheKalenderAb(SPAETER)).neu).toBe(0);
      expect(notizen()).toEqual(['Danach', 'Fokus Meeting', 'Ueberlappt']);
      expect(
        eine<{ wert: number }>('SELECT COUNT(*) AS wert FROM kalender_termine WHERE kalender_id = ? AND eintrag_id IS NOT NULL', wieder.id)?.wert,
      ).toBe(3);
    });
  });

  it.each([
    [500, 'Der Kalender hat die Anfrage abgelehnt.'],
    [404, 'Unter dieser Adresse liegt kein Kalender.'],
  ])('speichert bei HTTP %s einen Klartext ohne Statuszahl', async (status, satz) => {
    const schalter = await schaltServer(kalenderText());
    await mitWeltAsync(welt(), async () => {
      const { projektId, vorlageId } = ziel();
      await erstelleKalender({ name: 'Arbeit', adresse: schalter.url, projektId, vorlageId, filter: '' }, VERBINDET);
      schalter.lage.status = status;
      const ergebnis = await gleicheKalenderAb(SPAETER);
      const gespeichert = eine<{ fehler: string | null }>('SELECT fehler FROM kalender')?.fehler;
      expect(ergebnis).toEqual({ neu: 0, fehler: [satz] });
      expect(gespeichert).toBe(satz);
      expect(gespeichert).not.toContain('Arbeit');
      expect(gespeichert).not.toMatch(/\d/);
    });
  });
});
