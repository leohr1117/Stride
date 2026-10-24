import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ausfuehren, eine, mitWeltAsync, schliesseWelt } from '../db.ts';
import { starteTodoistAttrappe, type AttrappenDaten, type AttrappenEreignis, type TodoistAttrappe } from '../integrationen/todoistAttrappe.ts';
import type { TodoistLabelDaten, TodoistZuordnungDaten } from '../../shared/api/index.ts';
import { aendereEinstellungen, ladeEinstellungen } from '../features/einstellungen/einstellungen.ts';
import { erstelleFaehigkeit } from '../features/faehigkeiten/faehigkeiten.ts';
import { erstelleProjekt, erstelleVision } from './struktur.ts';
import { gleicheGeplantAb } from '../features/verbindungen/abgleich.ts';
import { gleicheTodoistAb } from '../features/verbindungen/todoistAbgleich.ts';
import { ordneTodoistLabel, ordneTodoistProjektZu } from '../features/verbindungen/todoistZuordnung.ts';
import { verbindeTodoist } from '../features/verbindungen/todoist.ts';
import { erstelleVorhaben } from '../features/ziele/vorhaben.ts';
import { erstelleVorlage } from '../features/taetigkeiten/vorlagen.ts';

const TOKEN = 'test-token-1234';
const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-todoist-'));
const offen: string[] = [];
const server: TodoistAttrappe[] = [];
let nummer = 0;

function welt(): string {
  nummer += 1;
  const datei = path.join(ordner, `${nummer}.db`);
  offen.push(datei);
  return datei;
}

afterEach(async () => {
  delete process.env.TODOIST_API;
  while (server.length > 0) {
    await server.pop()?.stop();
  }
  for (const datei of offen) {
    schliesseWelt(datei);
  }
  offen.length = 0;
});

async function mitApi(daten: AttrappenDaten): Promise<TodoistAttrappe> {
  const attrappe = await starteTodoistAttrappe(daten);
  process.env.TODOIST_API = attrappe.basis;
  server.push(attrappe);
  return attrappe;
}

function koerperId(): number {
  const id = eine<{ id: number }>(`SELECT id FROM attribute WHERE kennung = 'koerper'`)?.id;
  if (id === undefined) {
    throw new Error('Körper fehlt.');
  }
  return id;
}

function taetigkeit(name: string, projektId: number | null = null): number {
  return erstelleVorlage({
    name,
    icon: 'star',
    gewichte: [{ attributId: koerperId(), gewicht: 1 }],
    ...(projektId === null ? {} : { projektId }),
  }).id;
}

function projekt(name: string, vorlageId: number, visionId: number | null = null) {
  return erstelleProjekt({ name, beschreibung: '', visionId, organisationId: null, standardVorlageId: vorlageId });
}

function vision(titel: string) {
  return erstelleVision({
    titel,
    beschreibung: '',
    farbe: '#34d399',
    woopErgebnis: '',
    woopHindernis: '',
    woopPlan: '',
    level: null,
  });
}

function zuProjekt(todoistId: string, projektId: number, extra: Partial<TodoistZuordnungDaten> = {}) {
  ordneTodoistProjektZu(todoistId, {
    projektId,
    vorlageId: null,
    stunden: null,
    zielArt: 'projekt',
    zielId: projektId,
    ...extra,
  });
}

function labelAn(todoistId: string, extra: Partial<TodoistLabelDaten> = {}) {
  ordneTodoistLabel(todoistId, {
    aktiv: true,
    zielArt: null,
    zielId: null,
    projektId: null,
    vorlageId: null,
    stunden: null,
    faehigkeitId: null,
    abschluss: null,
    erkenntnis: '',
    notiz: '',
    meilenstein: null,
    ...extra,
  });
}

interface Zeile {
  stunden: number | null;
  vorhabenId: number | null;
  abschluss: string | null;
  meilenstein: number;
  faehigkeitId: number | null;
  notiz: string;
  projektId: number | null;
  vorlageId: number;
}

function eintrag(notiz: string): Zeile {
  const zeile = eine<Zeile>(
    `SELECT stunden, vorhaben_id AS vorhabenId, abschluss, meilenstein, faehigkeit_id AS faehigkeitId,
            notiz, projekt_id AS projektId, vorlage_id AS vorlageId
     FROM eintraege WHERE notiz = ?`,
    notiz,
  );
  if (!zeile) {
    throw new Error(`Eintrag fehlt: ${notiz}`);
  }
  return zeile;
}

function ereignis(id: string, inhalt: string, extra: Partial<AttrappenEreignis> = {}): AttrappenEreignis {
  return {
    id,
    aufgabeId: id,
    datum: new Date().toISOString(),
    projektId: 'p1',
    inhalt,
    labels: [],
    dauer: null,
    ...extra,
  };
}

describe('Todoist-Abgleich', () => {
  it('nimmt Aufgabendauer vor Label und Projekt und führt Labels zusammen', async () => {
    const jetzt = new Date();
    const daten: AttrappenDaten = {
      projekte: [{ id: 'p1', name: 'Post' }],
      labels: [
        { id: 'oben', name: 'Oben' },
        { id: 'unten', name: 'Unten' },
        { id: 'leer', name: 'Leer' },
        { id: 'dauer', name: 'Dauer' },
      ],
      ereignisse: [
        ereignis('e-dauer', 'Mit Dauer', { labels: ['Dauer'], dauer: { amount: 30, unit: 'minute' }, datum: jetzt.toISOString() }),
        ereignis('e-label', 'Nur Label', { labels: ['Dauer'], datum: jetzt.toISOString() }),
        ereignis('e-mix', 'Gemischt', { labels: ['Unten', 'Oben'], datum: jetzt.toISOString() }),
        ereignis('e-leer', 'Leer', { labels: ['Leer'], datum: jetzt.toISOString() }),
        ereignis('e-tag', 'Ganzer Tag', { dauer: { amount: 1, unit: 'day' }, datum: jetzt.toISOString() }),
        ereignis('e-kurz', 'Kurz', { dauer: { amount: 10, unit: 'minute' }, datum: jetzt.toISOString() }),
        ereignis('e-notiz', 'Kapitel', { labels: ['Oben'], datum: jetzt.toISOString() }),
      ],
    };
    await mitApi(daten);
    await mitWeltAsync(welt(), async () => {
      aendereEinstellungen({ funktionen: { faehigkeiten: true } });
      const allgemein = taetigkeit('Allgemein');
      const eigene = taetigkeit('Lesen');
      const ziel = projekt('Ziel', allgemein);
      const faehigkeit = erstelleFaehigkeit({ name: 'Fokus', beschreibung: '', farbe: '#34d399', icon: 'star' });
      await verbindeTodoist(TOKEN, jetzt);
      zuProjekt('p1', ziel.id, { stunden: 1, vorlageId: allgemein, faehigkeitId: faehigkeit.id });
      labelAn('dauer', { stunden: 2, vorlageId: eigene });
      labelAn('oben', { vorlageId: eigene, notiz: 'leise' });
      labelAn('unten', { faehigkeitId: faehigkeit.id, vorlageId: allgemein });
      labelAn('leer', { stunden: 0, faehigkeitId: 0 });

      const erster = await gleicheTodoistAb(jetzt);
      expect(erster.fehler).toEqual([]);
      expect(eintrag('Mit Dauer')).toMatchObject({ stunden: 0.5, vorlageId: eigene, projektId: ziel.id });
      expect(eintrag('Nur Label').stunden).toBe(2);
      expect(eintrag('Gemischt\nleise')).toMatchObject({ vorlageId: eigene, faehigkeitId: faehigkeit.id });
      expect(eintrag('Leer')).toMatchObject({ stunden: null, faehigkeitId: null });
      expect(eintrag('Ganzer Tag').stunden).toBe(24);
      expect(eintrag('Kurz').stunden).toBe(0.25);
      expect(eintrag('Kapitel\nleise').vorlageId).toBe(eigene);
      const zweiter = await gleicheTodoistAb(jetzt);
      expect(zweiter.neu).toBe(0);
      expect(eine<{ wert: number }>('SELECT COUNT(*) AS wert FROM eintraege')?.wert).toBe(7);
    });
  });

  it('lässt ein Vorhaben offen, bis der Stand es abschließt', async () => {
    const jetzt = new Date();
    await mitApi({
      projekte: [{ id: 'p1', name: 'Post' }],
      labels: [{ id: 'dran', name: 'Dran' }],
      ereignisse: [
        ereignis('e-offen', 'Offen', { datum: jetzt.toISOString() }),
        ereignis('e-dran', 'Dran', { labels: ['Dran'], datum: new Date(jetzt.getTime() - 60_000).toISOString() }),
      ],
    });
    await mitWeltAsync(welt(), async () => {
      const vorlage = taetigkeit('Allgemein');
      const ziel = projekt('Ziel', vorlage);
      const offenVorhaben = erstelleVorhaben(ziel.id, 'Offen lassen');
      const zweites = erstelleVorhaben(ziel.id, 'Wieder offen');
      await verbindeTodoist(TOKEN, jetzt);
      ordneTodoistProjektZu('p1', {
        projektId: ziel.id,
        vorlageId: null,
        stunden: null,
        zielArt: 'vorhaben',
        zielId: offenVorhaben.id,
        abschluss: 'geschafft',
      });
      labelAn('dran', { abschluss: 'offen' });
      await gleicheTodoistAb(jetzt);
      expect(eintrag('Offen').vorhabenId).toBe(offenVorhaben.id);
      expect(eine<{ status: string }>(`SELECT status FROM vorhaben WHERE id = ?`, offenVorhaben.id)?.status).toBe('geschafft');
      expect(eintrag('Dran').abschluss).toBeNull();
      expect(eine<{ status: string }>(`SELECT status FROM vorhaben WHERE id = ?`, offenVorhaben.id)?.status).toBe('geschafft');
      expect(eine<{ status: string }>(`SELECT status FROM vorhaben WHERE id = ?`, zweites.id)?.status).toBe('offen');
    });
  });

  it('löst eine Vision auf und meldet fehlende oder mehrdeutige Projekte', async () => {
    const jetzt = new Date();
    await mitApi({
      projekte: [{ id: 'p1', name: 'Post' }],
      ereignisse: [ereignis('e1', 'Visionseintrag', { datum: jetzt.toISOString() })],
    });
    await mitWeltAsync(welt(), async () => {
      const vorlage = taetigkeit('Allgemein');
      const lauf = vision('Lauf');
      await verbindeTodoist(TOKEN, jetzt);
      expect(() =>
        ordneTodoistProjektZu('p1', { projektId: null, vorlageId: null, stunden: null, zielArt: 'vision', zielId: lauf.id }),
      ).toThrow(/kein aktives Projekt/);
      const erster = projekt('Alpha', vorlage, lauf.id);
      projekt('Beta', vorlage, lauf.id);
      expect(() =>
        ordneTodoistProjektZu('p1', { projektId: null, vorlageId: null, stunden: null, zielArt: 'vision', zielId: lauf.id }),
      ).toThrow(/Wähle ein Projekt/);
      ausfuehren(`UPDATE todoist_projekte SET ziel_art = 'vision', ziel_id = ?, projekt_id = NULL WHERE todoist_id = 'p1'`, lauf.id);
      const fehler = await gleicheTodoistAb(jetzt);
      expect(fehler.fehler.join(' ')).toMatch(/Wähle ein Projekt/);
      expect(eine<{ wert: number }>('SELECT COUNT(*) AS wert FROM todoist_erledigt')?.wert).toBe(0);
      ordneTodoistProjektZu('p1', {
        projektId: erster.id,
        vorlageId: null,
        stunden: null,
        zielArt: 'vision',
        zielId: lauf.id,
      });
      const danach = await gleicheTodoistAb(jetzt);
      expect(danach.neu).toBe(1);
      expect(eintrag('Visionseintrag').projektId).toBe(erster.id);
    });
  });

  it('importiert über ein Label, auch wenn das Todoist-Projekt aus ist', async () => {
    const jetzt = new Date();
    await mitApi({
      projekte: [{ id: 'p1', name: 'Post' }],
      labels: [{ id: 'ziel', name: 'Ziel' }],
      ereignisse: [ereignis('e1', 'Trotz aus', { labels: ['Ziel'], datum: jetzt.toISOString() })],
    });
    await mitWeltAsync(welt(), async () => {
      const vorlage = taetigkeit('Allgemein');
      const ziel = projekt('Ziel', vorlage);
      await verbindeTodoist(TOKEN, jetzt);
      labelAn('ziel', { zielArt: 'projekt', zielId: ziel.id, projektId: ziel.id, notiz: 'extra' });
      const ergebnis = await gleicheTodoistAb(jetzt);
      expect(ergebnis.fehler).toEqual([]);
      expect(eintrag('Trotz aus\nextra').projektId).toBe(ziel.id);
    });
  });

  it('gleicht nachts seltener ab und speichert die Zeitzone', async () => {
    const nacht = new Date('2026-07-15T21:00:00.000Z');
    const tag = new Date('2026-07-15T20:00:00.000Z');
    const attrappe = await mitApi({ projekte: [{ id: 'p1', name: 'Post' }] });
    await mitWeltAsync(welt(), async () => {
      expect(() => aendereEinstellungen({ zeitzone: 'Kein/Zone' })).toThrow(/Zeitzone/);
      expect(aendereEinstellungen({ zeitzone: 'Europe/Berlin' }).zeitzone).toBe('Europe/Berlin');
      expect(ladeEinstellungen().zeitzone).toBe('Europe/Berlin');
      await verbindeTodoist(TOKEN, new Date());
      ausfuehren(
        `INSERT INTO einstellungen (schluessel, wert) VALUES ('todoistAbgleich', ?)
         ON CONFLICT (schluessel) DO UPDATE SET wert = excluded.wert`,
        JSON.stringify(new Date(nacht.getTime() - 60 * 60 * 1000).toISOString()),
      );
      attrappe.anfragen.length = 0;
      await gleicheGeplantAb(nacht);
      expect(attrappe.anfragen.some((anfrage) => anfrage.pfad.endsWith('/activities'))).toBe(false);
      await gleicheGeplantAb(tag);
      expect(attrappe.anfragen.some((anfrage) => anfrage.pfad.endsWith('/activities'))).toBe(true);
      expect(JSON.stringify(attrappe.anfragen)).not.toContain(TOKEN);
    });
  });
});
