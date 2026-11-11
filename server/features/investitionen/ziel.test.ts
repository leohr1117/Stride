import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { alle, ausfuehren, eine, mitWelt, schliesseWelt } from '../../db.ts';
import { bucheAttributXp } from '../../services/fortschritt.ts';
import { aendereEinstellungen } from '../einstellungen/einstellungen.ts';
import { ladeAttributXp } from '../attribute/attribute.ts';
import { erstelleProjekt, erstelleVision } from '../../services/struktur.ts';
import { erstelleVorlage } from '../taetigkeiten/vorlagen.ts';
import { aendereInvestition, bonusAufAttribut, bonusAufProjekt, erstelleInvestition } from './ausruestung.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-investition-ziel-'));
const offen: string[] = [];
let nummer = 0;
const ZEIT = '2026-06-01T12:00:00.000Z';

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

function attributId(kennung: string): number {
  const id = eine<{ id: number }>('SELECT id FROM attribute WHERE kennung = ?', kennung)?.id;
  if (id === undefined) {
    throw new Error(`${kennung} fehlt.`);
  }
  return id;
}

function alleAttributIds(): number[] {
  return alle<{ id: number }>('SELECT id FROM attribute').map((zeile) => zeile.id);
}

function vorlage(name: string, zielAttribut: number): number {
  return erstelleVorlage({ name, icon: 'star', gewichte: [{ attributId: zielAttribut, gewicht: 1 }] }).id;
}

function projektAnlegen(name: string, vorlageId: number, visionId: number | null) {
  return erstelleProjekt({
    name,
    beschreibung: '',
    visionId,
    organisationId: null,
    standardVorlageId: vorlageId,
  });
}

function visionAnlegen(titel: string): number {
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

function zielArt(id: number): string | null {
  return eine<{ art: string | null }>('SELECT ziel_art AS art FROM investitionen WHERE id = ?', id)?.art ?? null;
}

describe('Ziel einer eigenen Investition', () => {
  it('zählt nur Attribut, nur Projekt, nur Vision oder beides', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { ausruestung: true } });
      const koerper = attributId('koerper');
      const vorlageId = vorlage('Tun', koerper);
      const visionId = visionAnlegen('Weit');
      const ziel = projektAnlegen('Werkstatt', vorlageId, visionId);

      const nurAttribut = erstelleInvestition({ name: 'Ring', icon: 'gem', groesse: 1, attributId: koerper });
      expect(nurAttribut.ziel).toBeNull();
      expect(nurAttribut.attributId).toBe(koerper);
      expect(zielArt(nurAttribut.id)).toBeNull();
      expect(bonusAufAttribut(koerper, ZEIT)).toBeCloseTo(0.1);
      expect(bonusAufProjekt(ziel.id, visionId, ZEIT)).toBe(0);

      const nurProjekt = erstelleInvestition({
        name: 'Halle',
        icon: 'gem',
        groesse: 1,
        attributId: null,
        ziel: { art: 'projekt', id: ziel.id },
      });
      expect(nurProjekt.attributId).toBeNull();
      expect(nurProjekt.attributName).toBeNull();
      expect(nurProjekt.ziel).toEqual({ art: 'projekt', id: ziel.id });
      expect(zielArt(nurProjekt.id)).toBe('projekt');
      expect(bonusAufProjekt(ziel.id, visionId, ZEIT)).toBeCloseTo(0.1);
      for (const id of alleAttributIds()) {
        expect(bonusAufAttribut(id, ZEIT)).toBe(id === koerper ? 0.1 : 0);
      }

      const nurVision = erstelleInvestition({
        name: 'Fernrohr',
        icon: 'gem',
        groesse: 2,
        ziel: { art: 'vision', id: visionId },
      });
      expect(nurVision.attributId).toBeNull();
      expect(zielArt(nurVision.id)).toBe('vision');
      expect(bonusAufProjekt(ziel.id, visionId, ZEIT)).toBeCloseTo(0.3);

      const beides = erstelleInvestition({
        name: 'Beides',
        icon: 'gem',
        groesse: 0,
        attributId: koerper,
        ziel: { art: 'projekt', id: ziel.id },
      });
      expect(beides.attributId).toBe(koerper);
      expect(beides.ziel).toEqual({ art: 'projekt', id: ziel.id });
      expect(zielArt(beides.id)).toBe('projekt');
      expect(bonusAufAttribut(koerper, ZEIT)).toBeCloseTo(0.15);
      expect(bonusAufProjekt(ziel.id, visionId, ZEIT)).toBeCloseTo(0.35);

      expect(aendereInvestition(beides.id, { attributId: null }).attributId).toBeNull();
      expect(bonusAufAttribut(koerper, ZEIT)).toBeCloseTo(0.1);
      expect(() => aendereInvestition(beides.id, { ziel: null })).toThrow(/Attribut oder ein Projekt/);
      expect(() => erstelleInvestition({ name: 'Leer', icon: 'gem', groesse: 1, attributId: null })).toThrow(
        /Attribut oder ein Projekt/,
      );
      expect(() =>
        erstelleInvestition({
          name: 'Altneu',
          icon: 'gem',
          groesse: 1,
          attributId: koerper,
          ziel: { art: 'attribut', id: attributId('ressourcen') },
        }),
      ).toThrow(/Attribut oder ein Projekt/);
    });
  });

  it('lässt ein zweites Attribut aus dem Bestand stehen, bis ein Projekt gewählt wird', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { ausruestung: true } });
      const koerper = attributId('koerper');
      const ressourcen = attributId('ressourcen');
      const vorlageId = vorlage('Tun', koerper);
      const ziel = projektAnlegen('Werkstatt', vorlageId, null);
      const alt = erstelleInvestition({ name: 'Alt', icon: 'gem', groesse: 1, attributId: koerper });
      ausfuehren(`UPDATE investitionen SET ziel_art = 'attribut', ziel_id = ? WHERE id = ?`, ressourcen, alt.id);

      const gleich = aendereInvestition(alt.id, { name: 'Alt bleibt' });
      expect(gleich.ziel).toEqual({ art: 'attribut', id: ressourcen });
      expect(gleich.attributId).toBe(koerper);
      expect(zielArt(alt.id)).toBe('attribut');
      expect(bonusAufAttribut(koerper, ZEIT)).toBeCloseTo(0.1);
      expect(bonusAufAttribut(ressourcen, ZEIT)).toBeCloseTo(0.1);

      const ohneAenderung = aendereInvestition(alt.id, { attributId: koerper });
      expect(ohneAenderung.ziel).toEqual({ art: 'attribut', id: ressourcen });

      const ersetzt = aendereInvestition(alt.id, { ziel: { art: 'projekt', id: ziel.id } });
      expect(ersetzt.ziel).toEqual({ art: 'projekt', id: ziel.id });
      expect(zielArt(alt.id)).toBe('projekt');
      expect(bonusAufAttribut(ressourcen, ZEIT)).toBe(0);
      expect(bonusAufProjekt(ziel.id, null, ZEIT)).toBeCloseTo(0.1);
      expect(() => aendereInvestition(alt.id, { attributId: null, ziel: null })).toThrow(/Attribut oder ein Projekt/);
    });
  });

  it('bucht die Zahlung weiter auf das Bezahl-Attribut', () => {
    mitWelt(welt(), () => {
      const ressourcen = attributId('ressourcen');
      const koerper = attributId('koerper');
      const vorlageId = vorlage('Tun', koerper);
      const ziel = projektAnlegen('Kasse', vorlageId, null);
      bucheAttributXp(
        { quelle: 'eintrag', attributId: ressourcen, xp: 100, eintragId: null, vorhabenId: null },
        '2026-06-01T08:00:00.000Z',
      );
      const angelegt = erstelleInvestition({
        name: 'Kauf',
        icon: 'gem',
        groesse: 1,
        attributId: null,
        ziel: { art: 'projekt', id: ziel.id },
        bezahltAttributId: ressourcen,
        betrag: 40,
      });
      expect(angelegt.betrag).toBe(40);
      expect(angelegt.bezahltAttributId).toBe(ressourcen);
      expect(ladeAttributXp(ressourcen)).toBe(60);
      expect(
        eine<{ quelle: string; xp: number }>(
          `SELECT quelle, xp FROM xp_ereignisse WHERE investition_id = ?`,
          angelegt.id,
        ),
      ).toEqual({ quelle: 'investition', xp: -40 });
    });
  });
});
