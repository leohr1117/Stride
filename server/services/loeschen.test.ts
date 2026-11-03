import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import type { EintragDaten } from '../../shared/api/index.ts';
import { ausfuehren, eine, mitWelt, schliesseWelt } from '../db.ts';
import { erstelleInvestition, loescheInvestition } from '../features/investitionen/ausruestung.ts';
import { aendereEinstellungen } from '../features/einstellungen/einstellungen.ts';
import { erstelleEintrag } from '../features/eintraege/eintraege.ts';
import { erstelleFaehigkeit, erstelleKnoten, loescheKnoten, schalteSkillFrei } from '../features/faehigkeiten/faehigkeiten.ts';
import {
  istLoeschbar,
  loescheAttribut,
  loescheProjekt,
  loescheVision,
  loescheVorhaben,
  loescheVorlage,
  pruefeKnotenLoeschbar,
} from './loeschen.ts';
import { erstelleProjekt, erstelleVision } from './struktur.ts';
import { erstelleVorhaben } from '../features/ziele/vorhaben.ts';
import { erstelleVorlage } from '../features/taetigkeiten/vorlagen.ts';

const wurzel = path.join(process.cwd(), 'tmp-vitest');
mkdirSync(wurzel, { recursive: true });
const ordner = path.join(wurzel, `loeschen-${process.pid}`);
mkdirSync(ordner, { recursive: true });
const offen: string[] = [];
let nummer = 0;

function welt(): string {
  nummer += 1;
  const datei = path.join(ordner, `${nummer}.db`);
  offen.push(datei);
  return datei;
}

function schliessen(): void {
  for (const datei of offen) {
    schliesseWelt(datei);
  }
  offen.length = 0;
}

afterEach(schliessen);

afterAll(() => {
  schliessen();
  rmSync(ordner, { recursive: true, force: true });
});

function koerperId(): number {
  const id = eine<{ id: number }>(`SELECT id FROM attribute WHERE kennung = 'koerper'`)?.id;
  if (id === undefined) {
    throw new Error('Körper fehlt.');
  }
  return id;
}

function vorlage(name: string, attributId = koerperId()): number {
  return erstelleVorlage({
    name,
    icon: 'sparkles',
    gewichte: [{ attributId, gewicht: 1 }],
  }).id;
}

function vision(titel: string): number {
  return erstelleVision({
    titel,
    beschreibung: '',
    farbe: '#112233',
    woopErgebnis: '',
    woopHindernis: '',
    woopPlan: '',
    level: null,
  }).id;
}

function eintrag(daten: Partial<EintragDaten> & { vorlageId: number }): void {
  erstelleEintrag({
    projektId: daten.projektId ?? null,
    vorlageId: daten.vorlageId,
    vorhaben: daten.vorhaben ?? null,
    abschluss: null,
    erkenntnis: '',
    stunden: 1,
    notiz: '',
    meilenstein: false,
    faehigkeitId: null,
    datum: null,
  });
}

describe('endgültiges Löschen', () => {
  it('löscht eine leere Vision und behält eine mit Projekt', () => {
    mitWelt(welt(), () => {
      const leer = vision('Leer');
      loescheVision(leer);
      expect(eine(`SELECT id FROM visionen WHERE id = ?`, leer)).toBeUndefined();

      const belegt = vision('Belegt');
      const taetigkeit = vorlage('Standard');
      const projekt = erstelleProjekt({
        name: 'Darin',
        beschreibung: '',
        visionId: belegt,
        organisationId: null,
        standardVorlageId: taetigkeit,
      });
      expect(() => loescheVision(belegt)).toThrow(/genutzt/);
      expect(() => loescheVorlage(taetigkeit)).toThrow(/genutzt/);
      loescheProjekt(projekt.id);
      loescheVorlage(taetigkeit);
      loescheVision(belegt);
      expect(eine(`SELECT id FROM visionen WHERE id = ?`, belegt)).toBeUndefined();
    });
  });

  it('löscht eine neue Tätigkeit und verweigert die Standard-Tätigkeit eines Projekts', () => {
    mitWelt(welt(), () => {
      const frei = vorlage('Frei');
      loescheVorlage(frei);
      expect(eine(`SELECT id FROM vorlagen WHERE id = ?`, frei)).toBeUndefined();

      const gebunden = vorlage('Gebunden');
      const projekt = erstelleProjekt({
        name: 'Halt',
        beschreibung: '',
        visionId: null,
        organisationId: null,
        standardVorlageId: gebunden,
      });
      expect(istLoeschbar('vorlage', gebunden)).toBe(false);
      loescheProjekt(projekt.id);
      expect(istLoeschbar('vorlage', gebunden)).toBe(true);
    });
  });

  it('löscht ein ungenutztes Attribut, nicht das letzte aktive und nicht eines mit Gewicht', () => {
    mitWelt(welt(), () => {
      const frei = ausfuehren(
        `INSERT INTO attribute (typ, name, beschreibung, farbe, icon, sortierung) VALUES ('attribut', 'Frei', '', '#112233', 'sparkles', 80)`,
      ).id;
      expect(istLoeschbar('attribut', frei)).toBe(true);
      loescheAttribut(frei);
      expect(eine(`SELECT id FROM attribute WHERE id = ?`, frei)).toBeUndefined();

      const gewichtet = ausfuehren(
        `INSERT INTO attribute (typ, name, beschreibung, farbe, icon, sortierung) VALUES ('attribut', 'Gewicht', '', '#112233', 'sparkles', 81)`,
      ).id;
      vorlage('Wiegt', gewichtet);
      expect(() => loescheAttribut(gewichtet)).toThrow(/genutzt/);

      const letzter = ausfuehren(
        `INSERT INTO attribute (typ, name, beschreibung, farbe, icon, sortierung) VALUES ('attribut', 'Letzter', '', '#112233', 'sparkles', 82)`,
      ).id;
      ausfuehren(`UPDATE attribute SET archiviert = 1 WHERE typ = 'attribut' AND id <> ?`, letzter);
      expect(() => loescheAttribut(letzter)).toThrow(/bleibt aktiv/);
    });
  });

  it('löscht einen ungenutzten Skillbaum und sperrt ihn, sobald ein Nachkomme genutzt ist', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { faehigkeiten: true } });
      const faehigkeit = erstelleFaehigkeit({ name: 'Baum', beschreibung: '', farbe: '#112233', icon: 'sparkles' });
      const elternId = knotenId(erstelleKnoten(faehigkeit.id, { titel: 'Eltern', beschreibung: '', elternId: null }), 'Eltern');
      const kindId = knotenId(erstelleKnoten(faehigkeit.id, { titel: 'Kind', beschreibung: '', elternId }), 'Kind');
      expect(istLoeschbar('knoten', elternId)).toBe(true);
      loescheKnoten(elternId);
      expect(eine(`SELECT id FROM skill_knoten WHERE id = ?`, kindId)).toBeUndefined();

      const erneutEltern = knotenId(erstelleKnoten(faehigkeit.id, { titel: 'Eltern', beschreibung: '', elternId: null }), 'Eltern');
      const erneutKind = knotenId(erstelleKnoten(faehigkeit.id, { titel: 'Kind', beschreibung: '', elternId: erneutEltern }), 'Kind');
      schalteSkillFrei(erneutKind);
      expect(() => pruefeKnotenLoeschbar(erneutKind)).toThrow(/genutzt/);
      expect(() => pruefeKnotenLoeschbar(erneutEltern)).toThrow(/genutzt/);
    });
  });

  it('löscht ein frisches Vorhaben und behält eines mit Eintrag', () => {
    mitWelt(welt(), () => {
      const taetigkeit = vorlage('Tun');
      const projekt = erstelleProjekt({
        name: 'Werk',
        beschreibung: '',
        visionId: null,
        organisationId: null,
        standardVorlageId: taetigkeit,
      });
      const frisch = erstelleVorhaben(projekt.id, 'Frisch');
      expect(frisch.loeschbar).toBe(true);
      loescheVorhaben(frisch.id);
      expect(eine(`SELECT id FROM vorhaben WHERE id = ?`, frisch.id)).toBeUndefined();

      const belegt = erstelleVorhaben(projekt.id, 'Belegt');
      eintrag({ projektId: projekt.id, vorlageId: taetigkeit, vorhaben: { art: 'bestehend', id: belegt.id } });
      expect(() => loescheVorhaben(belegt.id)).toThrow(/genutzt/);
    });
  });

  it('löscht eine Investition, bis ein späterer Eintrag ihren Bonus auslöst', () => {
    mitWelt(welt(), () => {
      const attributId = koerperId();
      const vorher = erstelleInvestition({ name: 'Vorher', icon: 'gem', groesse: 1, attributId });
      loescheInvestition(vorher.id);
      expect(eine(`SELECT id FROM investitionen WHERE id = ?`, vorher.id)).toBeUndefined();

      const nachher = erstelleInvestition({ name: 'Nachher', icon: 'gem', groesse: 1, attributId });
      eintrag({ vorlageId: vorlage('Hebt', attributId) });
      expect(() => loescheInvestition(nachher.id)).toThrow(/genutzt/);
    });
  });
});

function knotenId(faehigkeit: { knoten: { id: number; titel: string }[] }, titel: string): number {
  const id = faehigkeit.knoten.find((eintrag) => eintrag.titel === titel)?.id;
  if (id === undefined) {
    throw new Error(`${titel} fehlt.`);
  }
  return id;
}
