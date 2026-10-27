import { createServer, type Server } from 'node:http';
import { mkdirSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { eintragXp } from '../../../shared/spiel/xp.ts';
import { alle, eine, mitWeltAsync, schliesseWelt } from '../../db.ts';
import { erstelleProjekt, erstelleVision } from '../../services/struktur.ts';
import { erstelleVorlage } from '../taetigkeiten/vorlagen.ts';
import { erstelleKalender, gleicheKalenderAb, pruefeKalender } from './kalender.ts';

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
  it('zeigt die letzten Termine und speichert dabei nichts', async () => {
    const adresse = await icsServer(kalenderText());
    await mitWeltAsync(welt(), async () => {
      const pruefung = await pruefeKalender(adresse, SPAETER);
      expect(pruefung.name).toBe('Arbeit');
      expect(pruefung.termine.map((termin) => termin.titel)).toEqual(['Danach', 'Fokus Meeting', 'Ueberlappt', 'Frueher']);
      expect(pruefung.termine.find((termin) => termin.titel === 'Danach')?.xp).toBe(eintragXp(1));
      expect(pruefung.termine.find((termin) => termin.titel === 'Ueberlappt')?.xp).toBe(eintragXp(2));
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
});
