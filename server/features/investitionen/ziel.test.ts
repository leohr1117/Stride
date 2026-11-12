import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { alle, ausfuehren, eine, mitWelt, schliesseWelt } from '../../db.ts';
import { bucheAttributXp } from '../../services/fortschritt.ts';
import { aendereEinstellungen } from '../einstellungen/einstellungen.ts';
import { ladeAttributXp } from '../attribute/attribute.ts';
import { erstelleProjekt, erstelleVision } from '../../services/struktur.ts';
import { erstelleEintrag } from '../eintraege/eintraege.ts';
import { aendereFaehigkeit, erstelleFaehigkeit } from '../faehigkeiten/faehigkeiten.ts';
import { erstelleVorlage } from '../taetigkeiten/vorlagen.ts';
import { aendereInvestition, bonusAufAttribut, bonusAufFaehigkeit, bonusAufProjekt, erstelleInvestition } from './ausruestung.ts';

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

const frueh = new Date(2026, 5, 1, 10, 0, 0);
const spaet = new Date(2026, 5, 1, 18, 0, 0);

function faehigkeitAnlegen(name: string): number {
  return erstelleFaehigkeit({ name, beschreibung: '', farbe: '#112233', icon: 'sparkles' }).id;
}

function buche(projektId: number, vorlageId: number, faehigkeitId: number | null, zeit: Date) {
  return erstelleEintrag(
    {
      projektId,
      vorlageId,
      vorhaben: null,
      abschluss: null,
      erkenntnis: '',
      stunden: 1,
      notiz: '',
      meilenstein: false,
      faehigkeitId,
      datum: null,
    },
    zeit,
  );
}

function projektXp(eintragId: number): number {
  return eine<{ xp: number }>(
    `SELECT COALESCE(SUM(xp), 0) AS xp FROM projekt_xp WHERE eintrag_id = ? AND quelle = 'eintrag'`,
    eintragId,
  )?.xp ?? 0;
}

function faehigkeitXp(eintragId: number): number {
  return eine<{ xp: number }>(
    `SELECT COALESCE(SUM(xp), 0) AS xp FROM faehigkeit_xp WHERE eintrag_id = ? AND quelle = 'eintrag'`,
    eintragId,
  )?.xp ?? 0;
}

function attributXp(eintragId: number, id: number): number {
  return eine<{ xp: number }>(
    `SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse
     WHERE eintrag_id = ? AND attribut_id = ? AND quelle = 'eintrag'`,
    eintragId,
    id,
  )?.xp ?? 0;
}

function gespeicherterBonus(eintragId: number): number {
  return eine<{ bonus: number }>('SELECT ausruestung_bonus AS bonus FROM eintraege WHERE id = ?', eintragId)?.bonus ?? 0;
}

function erwarte400(aufruf: () => void, muster: RegExp): void {
  let gefangen: unknown;
  try {
    aufruf();
  } catch (fehler) {
    gefangen = fehler;
  }
  expect(gefangen).toMatchObject({ statusCode: 400 });
  expect((gefangen as Error).message).toMatch(muster);
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
      expect(() => aendereInvestition(beides.id, { ziel: null })).toThrow(/Attribut, ein Projekt oder eine Fähigkeit/);
      expect(() => erstelleInvestition({ name: 'Leer', icon: 'gem', groesse: 1, attributId: null })).toThrow(
        /Attribut, ein Projekt oder eine Fähigkeit/,
      );
      expect(() =>
        erstelleInvestition({
          name: 'Altneu',
          icon: 'gem',
          groesse: 1,
          attributId: koerper,
          ziel: { art: 'attribut', id: attributId('ressourcen') },
        }),
      ).toThrow(/Attribut, ein Projekt oder eine Fähigkeit/);
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
      expect(() => aendereInvestition(alt.id, { attributId: null, ziel: null })).toThrow(/Attribut, ein Projekt oder eine Fähigkeit/);
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

  it('hebt nur die Fähigkeit an und lässt Projekt und Attribut gleich', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { ausruestung: true, faehigkeiten: true } });
      const koerper = attributId('koerper');
      const vorlageId = vorlage('Tun', koerper);
      const ziel = projektAnlegen('Werkstatt', vorlageId, null);
      const faehigkeitId = faehigkeitAnlegen('Lesen');
      const ohne = buche(ziel.id, vorlageId, faehigkeitId, frueh);
      erstelleInvestition({ name: 'Nur Fähigkeit', icon: 'gem', groesse: 1, attributId: null, faehigkeitId });
      const mit = buche(ziel.id, vorlageId, faehigkeitId, spaet);
      expect(faehigkeitXp(ohne.eintrag.id)).toBeGreaterThan(20);
      expect(faehigkeitXp(mit.eintrag.id)).toBe(Math.round(faehigkeitXp(ohne.eintrag.id) * 1.1));
      expect(projektXp(mit.eintrag.id)).toBe(projektXp(ohne.eintrag.id));
      expect(attributXp(mit.eintrag.id, koerper)).toBe(attributXp(ohne.eintrag.id, koerper));
      expect(gespeicherterBonus(mit.eintrag.id)).toBe(0);
      expect(bonusAufFaehigkeit(faehigkeitId, ZEIT)).toBeCloseTo(0.1);
      expect(bonusAufProjekt(ziel.id, null, ZEIT)).toBe(0);
    });
  });

  it('gibt bei allen drei Zielen drei Boni und deckelt Projekt plus Fähigkeit bei 50 Prozent', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { ausruestung: true, faehigkeiten: true } });
      const koerper = attributId('koerper');
      const vorlageId = vorlage('Tun', koerper);
      const ziel = projektAnlegen('Werkstatt', vorlageId, null);
      const faehigkeitId = faehigkeitAnlegen('Lesen');
      const ohne = buche(ziel.id, vorlageId, faehigkeitId, frueh);
      const alle = erstelleInvestition({
        name: 'Alle drei',
        icon: 'gem',
        groesse: 1,
        attributId: koerper,
        ziel: { art: 'projekt', id: ziel.id },
        faehigkeitId,
      });
      expect(alle.faehigkeitId).toBe(faehigkeitId);
      expect(alle.faehigkeitName).toBe('Lesen');
      expect(alle.attributId).toBe(koerper);
      expect(alle.ziel).toEqual({ art: 'projekt', id: ziel.id });
      const mit = buche(ziel.id, vorlageId, faehigkeitId, spaet);
      expect(attributXp(mit.eintrag.id, koerper)).toBe(Math.round(attributXp(ohne.eintrag.id, koerper) * 1.1));
      expect(projektXp(mit.eintrag.id)).toBe(Math.round(projektXp(ohne.eintrag.id) * 1.1));
      expect(faehigkeitXp(mit.eintrag.id)).toBe(Math.round(faehigkeitXp(ohne.eintrag.id) * 1.2));
      expect(gespeicherterBonus(mit.eintrag.id)).toBeCloseTo(0.1);

      const hoch = projektAnlegen('Halle', vorlageId, null);
      const andere = faehigkeitAnlegen('Rechnen');
      const basis = buche(hoch.id, vorlageId, andere, frueh);
      erstelleInvestition({
        name: 'Nur Projekt',
        icon: 'gem',
        groesse: 3,
        attributId: null,
        ziel: { art: 'projekt', id: hoch.id },
      });
      erstelleInvestition({ name: 'Nur Fähigkeit hoch', icon: 'gem', groesse: 3, attributId: null, faehigkeitId: andere });
      const gedeckelt = buche(hoch.id, vorlageId, andere, spaet);
      expect(faehigkeitXp(basis.eintrag.id)).toBeGreaterThan(20);
      expect(projektXp(gedeckelt.eintrag.id)).toBe(Math.round(projektXp(basis.eintrag.id) * 1.3));
      expect(faehigkeitXp(gedeckelt.eintrag.id)).toBe(Math.round(faehigkeitXp(basis.eintrag.id) * 1.5));
      expect(faehigkeitXp(gedeckelt.eintrag.id)).not.toBe(Math.round(faehigkeitXp(basis.eintrag.id) * 1.3 * 1.3));
      expect(attributXp(gedeckelt.eintrag.id, koerper)).toBe(attributXp(basis.eintrag.id, koerper));
      expect(gespeicherterBonus(gedeckelt.eintrag.id)).toBeCloseTo(0.3);
      expect(bonusAufFaehigkeit(andere, ZEIT)).toBeCloseTo(0.3);
    });
  });

  it('gibt keinen Bonus, wenn die Fähigkeit archiviert ist oder ein Schalter aus ist', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { ausruestung: true, faehigkeiten: true } });
      const koerper = attributId('koerper');
      const lesen = faehigkeitAnlegen('Lesen');
      const rechnen = faehigkeitAnlegen('Rechnen');
      const angelegt = erstelleInvestition({
        name: 'Auf Lesen',
        icon: 'gem',
        groesse: 1,
        attributId: koerper,
        faehigkeitId: lesen,
      });
      expect(bonusAufFaehigkeit(lesen, ZEIT)).toBeCloseTo(0.1);
      aendereFaehigkeit(lesen, { archiviert: true });
      expect(bonusAufFaehigkeit(lesen, ZEIT)).toBe(0);
      erwarte400(
        () => erstelleInvestition({ name: 'Archiv', icon: 'gem', groesse: 1, attributId: null, faehigkeitId: lesen }),
        /archiviert/,
      );

      aendereEinstellungen({ funktionen: { faehigkeiten: false } });
      expect(bonusAufFaehigkeit(rechnen, ZEIT)).toBe(0);
      expect(aendereInvestition(angelegt.id, { name: 'Bleibt' }).faehigkeitId).toBe(lesen);
      erwarte400(
        () => erstelleInvestition({ name: 'Neu', icon: 'gem', groesse: 1, attributId: null, faehigkeitId: rechnen }),
        /ausgeschaltet/,
      );
      erwarte400(() => aendereInvestition(angelegt.id, { faehigkeitId: rechnen }), /ausgeschaltet/);

      aendereEinstellungen({ funktionen: { faehigkeiten: true, ausruestung: false } });
      expect(bonusAufFaehigkeit(rechnen, ZEIT)).toBe(0);
    });
  });

  it('lässt ein Ziel leer, solange ein anderes bleibt', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { ausruestung: true, faehigkeiten: true } });
      const koerper = attributId('koerper');
      const ressourcen = attributId('ressourcen');
      const vorlageId = vorlage('Tun', koerper);
      const ziel = projektAnlegen('Werkstatt', vorlageId, null);
      const faehigkeitId = faehigkeitAnlegen('Lesen');
      const alle = erstelleInvestition({
        name: 'Alle drei',
        icon: 'gem',
        groesse: 1,
        attributId: koerper,
        ziel: { art: 'projekt', id: ziel.id },
        faehigkeitId,
      });
      const ohneFaehigkeit = aendereInvestition(alle.id, { faehigkeitId: null });
      expect(ohneFaehigkeit.faehigkeitId).toBeNull();
      expect(ohneFaehigkeit.attributId).toBe(koerper);
      expect(ohneFaehigkeit.ziel).toEqual({ art: 'projekt', id: ziel.id });
      const nurProjekt = aendereInvestition(alle.id, { attributId: null });
      expect(nurProjekt.attributId).toBeNull();
      expect(nurProjekt.ziel).toEqual({ art: 'projekt', id: ziel.id });
      erwarte400(
        () => aendereInvestition(alle.id, { ziel: null }),
        /Attribut, ein Projekt oder eine Fähigkeit/,
      );
      erwarte400(
        () => aendereInvestition(alle.id, { attributId: null, ziel: null, faehigkeitId: null }),
        /Attribut, ein Projekt oder eine Fähigkeit/,
      );

      const bestand = erstelleInvestition({ name: 'Alt', icon: 'gem', groesse: 1, attributId: koerper });
      ausfuehren(`UPDATE investitionen SET ziel_art = 'attribut', ziel_id = ? WHERE id = ?`, ressourcen, bestand.id);
      const mitFaehigkeit = aendereInvestition(bestand.id, { faehigkeitId });
      expect(mitFaehigkeit.ziel).toEqual({ art: 'attribut', id: ressourcen });
      expect(mitFaehigkeit.faehigkeitId).toBe(faehigkeitId);
      expect(zielArt(bestand.id)).toBe('attribut');
      erwarte400(
        () => aendereInvestition(bestand.id, { attributId: null }),
        /Attribut, ein Projekt oder eine Fähigkeit/,
      );
      expect(zielArt(bestand.id)).toBe('attribut');
    });
  });
});
