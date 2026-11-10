import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ausfuehren, eine, mitWeltAsync, schliesseWelt } from '../db.ts';
import { starteTodoistAttrappe, type AttrappenDaten, type AttrappenEreignis, type TodoistAttrappe } from '../integrationen/todoistAttrappe.ts';
import type { TodoistLabelDaten, TodoistZuordnungDaten } from '../../shared/api/index.ts';
import { aendereEinstellungen, ladeEinstellungen } from '../features/einstellungen/einstellungen.ts';
import { erstelleFaehigkeit } from '../features/faehigkeiten/faehigkeiten.ts';
import { erstelleProjekt, erstelleVision } from './struktur.ts';
import { gleicheGeplantAb } from '../features/verbindungen/abgleich.ts';
import { gleicheTodoistAb } from '../features/verbindungen/todoistAbgleich.ts';
import { ordneTodoistLabel, ordneTodoistProjektZu } from '../features/verbindungen/todoistZuordnung.ts';
import { setzeTodoistOhne, verbindeTodoist } from '../features/verbindungen/todoist.ts';
import { erstelleVorhaben } from '../features/ziele/vorhaben.ts';
import { erstelleVorlage } from '../features/taetigkeiten/vorlagen.ts';
import { lokalesDatum, plusTage } from '../../shared/spiel/datum.ts';
import { tageZwischen } from '../../shared/spiel/kette.ts';
import { BOSS, eintragXp, GEGNER, meilensteinBonus } from '../../shared/spiel/xp.ts';

const TOKEN = 'test-token-1234';
const TEST_SCHLUESSEL = Buffer.from('stride-test-token-schluessel-v3!').toString('base64');
const vorherStride = process.env.STRIDE_TOKEN_SCHLUESSEL;
const vorherAscend = process.env.ASCEND_TOKEN_SCHLUESSEL;
const ordner = mkdtempSync(path.join(tmpdir(), 'stride-todoist-'));
const offen: string[] = [];
const server: TodoistAttrappe[] = [];
let nummer = 0;

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
    deadline: null,
    ...extra,
  };
}

function disziplinId(): number {
  const id = eine<{ id: number }>(`SELECT id FROM attribute WHERE kennung = 'disziplin'`)?.id;
  if (id === undefined) {
    throw new Error('Disziplin fehlt.');
  }
  return id;
}

function bucheDisziplin(xp: number): void {
  ausfuehren(
    `INSERT INTO xp_ereignisse (quelle, attribut_id, xp, erstellt_am) VALUES ('eintrag', ?, ?, ?)`,
    disziplinId(),
    xp,
    '2026-10-01T10:00:00.000Z',
  );
}

function disziplinSumme(): number {
  return eine<{ xp: number }>('SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse WHERE attribut_id = ?', disziplinId())?.xp ?? 0;
}

function basisDesEintrags(notiz: string): number {
  const zeile = eine<{ faktor: number; stunden: number | null }>('SELECT faktor, stunden FROM eintraege WHERE notiz = ?', notiz);
  if (!zeile) {
    throw new Error(`Eintrag fehlt: ${notiz}`);
  }
  return eintragXp(zeile.stunden, zeile.faktor);
}

function quelleXp(notiz: string, quelle: string): number {
  const id = eine<{ id: number }>('SELECT id FROM eintraege WHERE notiz = ?', notiz)?.id;
  if (id === undefined) {
    throw new Error(`Eintrag fehlt: ${notiz}`);
  }
  return (
    eine<{ xp: number }>('SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse WHERE quelle = ? AND eintrag_id = ?', quelle, id)?.xp ?? 0
  );
}

describe('Todoist-Abgleich', () => {
  it('nimmt die Aufgabendauer und lässt das oberste Label das Projekt ersetzen', async () => {
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
      expect(eintrag('Mit Dauer')).toMatchObject({ stunden: 0.5, vorlageId: eigene, projektId: null, faehigkeitId: null });
      expect(eintrag('Nur Label')).toMatchObject({ stunden: 2, vorlageId: eigene, projektId: null });
      expect(eintrag('Gemischt\nleise')).toMatchObject({ vorlageId: eigene, faehigkeitId: null, projektId: null });
      expect(eintrag('Leer')).toMatchObject({ stunden: 1, vorlageId: allgemein, faehigkeitId: faehigkeit.id, projektId: ziel.id });
      expect(eintrag('Ganzer Tag').stunden).toBe(24);
      expect(eintrag('Kurz').stunden).toBe(0.25);
      expect(eintrag('Kapitel\nleise')).toMatchObject({ vorlageId: eigene, projektId: null });
      const zweiter = await gleicheTodoistAb(jetzt);
      expect(zweiter.neu).toBe(0);
      expect(eine<{ wert: number }>('SELECT COUNT(*) AS wert FROM eintraege')?.wert).toBe(7);
    });
  });

  it('zählt eine Tätigkeit ohne Ziel und lässt den Standard nur ohne Wahl gelten', async () => {
    const jetzt = new Date();
    await mitApi({
      projekte: [
        { id: 'p1', name: 'Nur Tätigkeit' },
        { id: 'p2', name: 'Mit Ziel' },
        { id: 'p3', name: 'Gebunden' },
        { id: 'p4', name: 'Offen' },
      ],
      labels: [
        { id: 'oben', name: 'Oben' },
        { id: 'unten', name: 'Unten' },
      ],
      ereignisse: [
        ereignis('e-nur', 'Nur Tätigkeit', { projektId: 'p1', datum: jetzt.toISOString() }),
        ereignis('e-gebunden', 'Gebunden', { projektId: 'p3', datum: jetzt.toISOString() }),
        ereignis('e-label', 'Label schlägt Ziel', { projektId: 'p2', labels: ['Unten', 'Oben'], datum: jetzt.toISOString() }),
        ereignis('e-offen', 'Ohne Wahl', { projektId: 'p4', datum: jetzt.toISOString() }),
      ],
    });
    await mitWeltAsync(welt(), async () => {
      const allgemein = taetigkeit('Allgemein');
      const eigene = taetigkeit('Lesen');
      const standard = taetigkeit('Standard');
      const ziel = projekt('Ziel', allgemein);
      const anderes = projekt('Anderes', allgemein);
      const gebunden = taetigkeit('Gebunden', ziel.id);
      await verbindeTodoist(TOKEN, jetzt);
      ordneTodoistProjektZu('p1', { projektId: null, vorlageId: eigene, stunden: null, zielArt: null, zielId: null });
      ordneTodoistProjektZu('p3', { projektId: null, vorlageId: gebunden, stunden: null, zielArt: null, zielId: null });
      zuProjekt('p2', ziel.id, { stunden: 1, vorlageId: allgemein, notiz: 'vom Projekt' });
      ordneTodoistProjektZu('p4', { projektId: null, vorlageId: null, stunden: null, aktiv: true });
      labelAn('oben', { vorlageId: eigene });
      labelAn('unten', { zielArt: 'projekt', zielId: anderes.id, projektId: anderes.id, stunden: 3, notiz: 'unten' });
      setzeTodoistOhne('standard', standard);

      const ergebnis = await gleicheTodoistAb(jetzt);
      expect(ergebnis.fehler).toEqual([]);
      expect(ergebnis.neu).toBe(4);
      expect(eintrag('Nur Tätigkeit')).toMatchObject({ vorlageId: eigene, projektId: null, stunden: null });
      expect(eintrag('Gebunden')).toMatchObject({ vorlageId: gebunden, projektId: ziel.id });
      expect(eintrag('Label schlägt Ziel')).toMatchObject({ vorlageId: eigene, projektId: null, stunden: null });
      expect(eintrag('Ohne Wahl')).toMatchObject({ vorlageId: standard, projektId: null });
      expect(eine<{ notiz: string }>('SELECT notiz FROM eintraege WHERE notiz LIKE ?', 'Label schlägt Ziel%')?.notiz).toBe('Label schlägt Ziel');
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
      await verbindeTodoist(TOKEN, new Date(jetzt.getTime() - 120_000));
      ordneTodoistProjektZu('p1', {
        projektId: ziel.id,
        vorlageId: null,
        stunden: null,
        zielArt: 'vorhaben',
        zielId: offenVorhaben.id,
        abschluss: 'geschafft',
      });
      labelAn('dran', { zielArt: 'vorhaben', zielId: offenVorhaben.id, projektId: ziel.id, abschluss: 'offen' });
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
      ausfuehren(
        `UPDATE todoist_projekte SET ziel_art = 'vision', ziel_id = ?, projekt_id = NULL, aktiv = 1 WHERE todoist_id = 'p1'`,
        lauf.id,
      );
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

  it('lässt ein ausgeschaltetes Projekt aus und nimmt den Standard nicht', async () => {
    const jetzt = new Date();
    await mitApi({
      projekte: [{ id: 'p1', name: 'Post' }],
      ereignisse: [ereignis('e1', 'Ausgelassen', { datum: jetzt.toISOString() })],
    });
    await mitWeltAsync(welt(), async () => {
      const eigene = taetigkeit('Lesen');
      const standard = taetigkeit('Standard');
      await verbindeTodoist(TOKEN, jetzt);
      ordneTodoistProjektZu('p1', { projektId: null, vorlageId: eigene, stunden: null, aktiv: false });
      setzeTodoistOhne('standard', standard);
      const aus = await gleicheTodoistAb(jetzt);
      expect(aus.fehler).toEqual([]);
      expect(aus.neu).toBe(0);
      expect(eine<{ wert: number }>('SELECT COUNT(*) AS wert FROM eintraege')?.wert).toBe(0);

      ordneTodoistProjektZu('p1', { projektId: null, vorlageId: null, stunden: null, aktiv: true });
      const an = await gleicheTodoistAb(jetzt);
      expect(an.fehler).toEqual([]);
      expect(an.neu).toBe(1);
      expect(eintrag('Ausgelassen').vorlageId).toBe(standard);
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

  it('übernimmt nur Erledigungen ab dem Verbinden', async () => {
    const jetzt = new Date();
    await mitApi({
      projekte: [{ id: 'p1', name: 'Post' }],
      ereignisse: [
        ereignis('e-davor', 'Davor', { datum: new Date(jetzt.getTime() - 60_000).toISOString() }),
        ereignis('e-jetzt', 'Genau jetzt', { datum: jetzt.toISOString() }),
      ],
    });
    await mitWeltAsync(welt(), async () => {
      const vorlage = taetigkeit('Allgemein');
      const ziel = projekt('Ziel', vorlage);
      await verbindeTodoist(TOKEN, jetzt);
      zuProjekt('p1', ziel.id);
      const ergebnis = await gleicheTodoistAb(jetzt);
      expect(ergebnis.fehler).toEqual([]);
      expect(ergebnis.neu).toBe(1);
      expect(eintrag('Genau jetzt').projektId).toBe(ziel.id);
      expect(eine<{ wert: number }>('SELECT COUNT(*) AS wert FROM eintraege')?.wert).toBe(1);
      expect(eine<{ wert: number }>("SELECT COUNT(*) AS wert FROM todoist_erledigt WHERE ereignis_id = 'e-davor'")?.wert).toBe(0);
    });
  });

  it('zählt ohne Zuordnung als Standard-Tätigkeit oder gar nicht', async () => {
    const jetzt = new Date();
    const daten: AttrappenDaten = {
      projekte: [
        { id: 'p1', name: 'Post' },
        { id: 'p2', name: 'Offen' },
      ],
      ereignisse: [
        ereignis('e-zugeordnet', 'Zugeordnet', { projektId: 'p1', datum: jetzt.toISOString() }),
        ereignis('e-offen', 'Offen', { projektId: 'p2', datum: jetzt.toISOString() }),
      ],
    };
    await mitApi(daten);
    await mitWeltAsync(welt(), async () => {
      const allgemein = taetigkeit('Allgemein');
      const ziel = projekt('Ziel', allgemein);
      const eigene = taetigkeit('Lesen', ziel.id);
      await verbindeTodoist(TOKEN, jetzt);
      zuProjekt('p1', ziel.id);
      ordneTodoistProjektZu('p2', { projektId: null, vorlageId: null, stunden: null, aktiv: true });

      const erster = await gleicheTodoistAb(jetzt);
      expect(erster.fehler).toEqual([]);
      expect(erster.neu).toBe(1);
      expect(eine<{ wert: number }>("SELECT COUNT(*) AS wert FROM todoist_erledigt WHERE ereignis_id = 'e-offen'")?.wert).toBe(0);

      setzeTodoistOhne('standard', eigene);
      const zweiter = await gleicheTodoistAb(jetzt);
      expect(zweiter.fehler).toEqual([]);
      expect(zweiter.neu).toBe(1);
      expect(eintrag('Offen')).toMatchObject({ vorlageId: eigene, projektId: ziel.id, meilenstein: 0 });

      setzeTodoistOhne('keine', null);
      daten.ereignisse?.push(ereignis('e-spaeter', 'Später', { projektId: 'p2', datum: jetzt.toISOString() }));
      const dritter = await gleicheTodoistAb(jetzt);
      expect(dritter.fehler).toEqual([]);
      expect(dritter.neu).toBe(0);
      expect(eine<{ wert: number }>('SELECT COUNT(*) AS wert FROM eintraege')?.wert).toBe(2);
    });
  });

  it('macht eine Deadline zum Gegner und mit Meilenstein zum Boss', async () => {
    const jetzt = new Date();
    const morgen = lokalesDatum(plusTage(jetzt, 1));
    await mitApi({
      projekte: [{ id: 'p1', name: 'Post' }],
      labels: [
        { id: 'stein', name: 'Stein' },
        { id: 'boss', name: 'Boss' },
      ],
      ereignisse: [
        ereignis('e-gegner', 'Gegner', { deadline: morgen, datum: jetzt.toISOString() }),
        ereignis('e-boss', 'Boss', { labels: ['Boss'], deadline: morgen, datum: jetzt.toISOString() }),
        ereignis('e-stein', 'Stein', { labels: ['Stein'], deadline: null, datum: jetzt.toISOString() }),
      ],
    });
    await mitWeltAsync(welt(), async () => {
      aendereEinstellungen({ funktionen: { bossAngriffe: true } });
      bucheDisziplin(100);
      const vorher = disziplinSumme();
      const vorlage = taetigkeit('Allgemein');
      const ziel = projekt('Ziel', vorlage);
      await verbindeTodoist(TOKEN, jetzt);
      zuProjekt('p1', ziel.id);
      labelAn('stein', { zielArt: 'projekt', zielId: ziel.id, projektId: ziel.id, meilenstein: true });
      labelAn('boss', { zielArt: 'projekt', zielId: ziel.id, projektId: ziel.id, meilenstein: true });

      const ergebnis = await gleicheTodoistAb(jetzt);
      expect(ergebnis.fehler).toEqual([]);
      expect(ergebnis.neu).toBe(3);
      const gegnerXp = basisDesEintrags('Gegner');
      const bossXp = basisDesEintrags('Boss');
      const steinXp = basisDesEintrags('Stein');
      expect(eintrag('Gegner').meilenstein).toBe(0);
      expect(quelleXp('Gegner', 'meilenstein')).toBe(Math.round(meilensteinBonus(gegnerXp, false) / GEGNER.belohnungTeiler));
      expect(quelleXp('Gegner', 'bossangriff')).toBe(0);
      expect(eintrag('Boss').meilenstein).toBe(1);
      expect(quelleXp('Boss', 'meilenstein')).toBe(meilensteinBonus(bossXp, false, true));
      expect(eintrag('Stein').meilenstein).toBe(1);
      expect(quelleXp('Stein', 'meilenstein')).toBe(meilensteinBonus(steinXp, false));
      expect(quelleXp('Boss', 'meilenstein')).toBeGreaterThan(quelleXp('Stein', 'meilenstein'));
      expect(quelleXp('Stein', 'meilenstein')).toBeGreaterThan(quelleXp('Gegner', 'meilenstein'));
      expect(disziplinSumme()).toBe(vorher);
    });
  });

  it('zieht nach einer vergangenen Deadline Disziplin ab', async () => {
    const jetzt = new Date();
    const deadline = lokalesDatum(plusTage(jetzt, -2));
    expect(tageZwischen(deadline, lokalesDatum(jetzt))).toBe(2);
    await mitApi({
      projekte: [{ id: 'p1', name: 'Post' }],
      ereignisse: [ereignis('e-spaet', 'Spät', { deadline, datum: jetzt.toISOString() })],
    });
    await mitWeltAsync(welt(), async () => {
      aendereEinstellungen({ funktionen: { bossAngriffe: true } });
      bucheDisziplin(100);
      const vorlage = taetigkeit('Allgemein');
      const ziel = projekt('Ziel', vorlage);
      await verbindeTodoist(TOKEN, new Date(jetzt.getTime() - 60_000));
      zuProjekt('p1', ziel.id);
      const ergebnis = await gleicheTodoistAb(jetzt);
      expect(ergebnis.fehler).toEqual([]);
      expect(ergebnis.neu).toBe(1);
      expect(eintrag('Spät').meilenstein).toBe(0);
      const proTag = Math.floor(BOSS.angriffXpProTag / GEGNER.angriffTeiler);
      expect(quelleXp('Spät', 'bossangriff')).toBe(-(2 * proTag));
      expect(disziplinSumme()).toBe(100 - 2 * proTag);
    });
  });

  it('zieht ohne Boss-Angriffe nichts ab', async () => {
    const jetzt = new Date();
    const deadline = lokalesDatum(plusTage(jetzt, -2));
    await mitApi({
      projekte: [{ id: 'p1', name: 'Post' }],
      ereignisse: [ereignis('e-aus', 'Aus', { deadline, datum: jetzt.toISOString() })],
    });
    await mitWeltAsync(welt(), async () => {
      bucheDisziplin(40);
      const vorlage = taetigkeit('Allgemein');
      const ziel = projekt('Ziel', vorlage);
      await verbindeTodoist(TOKEN, new Date(jetzt.getTime() - 60_000));
      zuProjekt('p1', ziel.id);
      const ergebnis = await gleicheTodoistAb(jetzt);
      expect(ergebnis.neu).toBe(1);
      expect(quelleXp('Aus', 'bossangriff')).toBe(0);
      expect(disziplinSumme()).toBe(40);
    });
  });

});
