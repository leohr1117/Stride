import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ausfuehren, eine, mitWelt, schliesseWelt } from '../db.ts';
import { erstelleBasisAufgabe } from '../features/basis/basis.ts';
import { aendereEinstellungen } from '../features/einstellungen/einstellungen.ts';
import { erstelleEintrag } from '../features/eintraege/eintraege.ts';
import { aendereProjekt, erstelleProjekt } from './struktur.ts';
import { aendereKalender } from '../features/verbindungen/kalender.ts';
import { ordneTodoistProjektZu } from '../features/verbindungen/todoistZuordnung.ts';
import { erstelleVorlage } from '../features/taetigkeiten/vorlagen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-vorlage-'));
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

function projekt(name: string, standardVorlageId: number) {
  return erstelleProjekt({
    name,
    beschreibung: '',
    visionId: null,
    organisationId: null,
    standardVorlageId,
  });
}

describe('projektgebundene Tätigkeiten', () => {
  it('lässt allgemeine und eigene Tätigkeiten zu und lehnt fremde ab', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { basis: true } });
      const allgemein = taetigkeit('Allgemein');
      const eigen = projekt('Eigen', allgemein);
      const gebunden = taetigkeit('Nur hier', eigen.id);
      const fremd = projekt('Fremd', allgemein);

      expect(() => projekt('Neu', gebunden)).toThrow(/anderen Projekt/);
      expect(aendereProjekt(eigen.id, { standardVorlageId: gebunden }).standardVorlageId).toBe(gebunden);
      expect(() => aendereProjekt(fremd.id, { standardVorlageId: gebunden })).toThrow(/anderen Projekt/);
      expect(() => taetigkeit('Weg', 99999)).toThrow(/nicht gefunden/);

      const passend = erstelleEintrag({
        projektId: eigen.id,
        vorlageId: gebunden,
        vorhaben: null,
        abschluss: null,
        erkenntnis: '',
        stunden: 1,
        notiz: '',
        meilenstein: false,
        faehigkeitId: null,
        datum: null,
      });
      expect(passend.eintrag.projektId).toBe(eigen.id);
      expect(
        erstelleEintrag({
          projektId: fremd.id,
          vorlageId: allgemein,
          vorhaben: null,
          abschluss: null,
          erkenntnis: '',
          stunden: 1,
          notiz: '',
          meilenstein: false,
          faehigkeitId: null,
          datum: null,
        }).eintrag.vorlageId,
      ).toBe(allgemein);
      expect(() =>
        erstelleEintrag({
          projektId: fremd.id,
          vorlageId: gebunden,
          vorhaben: null,
          abschluss: null,
          erkenntnis: '',
          stunden: 1,
          notiz: '',
          meilenstein: false,
          faehigkeitId: null,
          datum: null,
        }),
      ).toThrow(/anderen Projekt/);
      expect(() =>
        erstelleEintrag({
          projektId: null,
          vorlageId: gebunden,
          vorhaben: null,
          abschluss: null,
          erkenntnis: '',
          stunden: 1,
          notiz: '',
          meilenstein: false,
          faehigkeitId: null,
          datum: null,
        }),
      ).toThrow(/anderen Projekt/);

      expect(
        erstelleBasisAufgabe({ name: 'Eigene', icon: 'star', projektId: eigen.id, vorlageId: gebunden, stunden: null }).vorlageId,
      ).toBe(gebunden);
      expect(() =>
        erstelleBasisAufgabe({ name: 'Fremde', icon: 'star', projektId: fremd.id, vorlageId: gebunden, stunden: null }),
      ).toThrow(/anderen Projekt/);
      expect(() =>
        erstelleBasisAufgabe({ name: 'Frei', icon: 'star', projektId: null, vorlageId: gebunden, stunden: null }),
      ).toThrow(/anderen Projekt/);

      ausfuehren(`INSERT INTO todoist_projekte (todoist_id, name) VALUES ('td-1', 'Posteingang')`);
      expect(() => ordneTodoistProjektZu('td-1', { projektId: fremd.id, vorlageId: gebunden, stunden: null })).toThrow(
        /anderen Projekt/,
      );
      ordneTodoistProjektZu('td-1', { projektId: eigen.id, vorlageId: gebunden, stunden: 1 });
      expect(
        eine<{ projektId: number | null; vorlageId: number | null }>(
          `SELECT projekt_id AS projektId, vorlage_id AS vorlageId FROM todoist_projekte WHERE todoist_id = 'td-1'`,
        ),
      ).toEqual({ projektId: eigen.id, vorlageId: gebunden });
      ordneTodoistProjektZu('td-1', { projektId: null, vorlageId: null, stunden: null });
      expect(
        eine<{ projektId: number | null; vorlageId: number | null }>(
          `SELECT projekt_id AS projektId, vorlage_id AS vorlageId FROM todoist_projekte WHERE todoist_id = 'td-1'`,
        ),
      ).toEqual({ projektId: null, vorlageId: null });

      const kalenderId = ausfuehren(
        `INSERT INTO kalender (name, adresse, projekt_id, seit) VALUES ('Haus', 'https://example.test/cal.ics', ?, '2026-01-01T00:00:00.000Z')`,
        eigen.id,
      ).id;
      expect(() => aendereKalender(kalenderId, { vorlageId: gebunden, projektId: fremd.id })).toThrow(/anderen Projekt/);
      expect(aendereKalender(kalenderId, { vorlageId: gebunden }).vorlageId).toBe(gebunden);
      expect(aendereKalender(kalenderId, { vorlageId: allgemein }).vorlageId).toBe(allgemein);
    });
  });
});
