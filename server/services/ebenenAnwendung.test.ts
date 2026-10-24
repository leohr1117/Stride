import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { EintragDaten } from '../../shared/api/index.ts';
import { ebenenFuerStufe } from '../../shared/spiel/ebenen.ts';
import { alle, ausfuehren, eine, mitWelt, schliesseWelt } from '../db.ts';
import { ladeAttribute } from '../features/attribute/attribute.ts';
import { aendereEinstellungen, ladeEinstellungen } from '../features/einstellungen/einstellungen.ts';
import { erstelleBasisAufgabe } from '../features/basis/basis.ts';
import { erstelleEintrag } from '../features/eintraege/eintraege.ts';
import { aendereFaehigkeit, erstelleFaehigkeit } from '../features/faehigkeiten/faehigkeiten.ts';
import { aktuelleWoche, speichereRueckblick } from '../features/rueckblick/rueckblick.ts';
import { erstelleOrganisation, erstelleProjekt, erstelleVision, ladeZiele } from './struktur.ts';
import { erstelleVorhaben } from '../features/ziele/vorhaben.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-ebenen-'));
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

function anzahl(tabelle: string): number {
  return eine<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tabelle}`)?.n ?? 0;
}

function xpSumme(tabelle: 'xp_ereignisse' | 'projekt_xp'): number {
  return eine<{ xp: number }>(`SELECT COALESCE(SUM(xp), 0) AS xp FROM ${tabelle}`)?.xp ?? 0;
}

function taetigkeit(): number {
  const vorlageId = ausfuehren(`INSERT INTO vorlagen (name, icon) VALUES ('Tun', 'star')`).id;
  const attributId = eine<{ id: number }>(`SELECT id FROM attribute WHERE kennung = 'koerper'`)?.id;
  if (attributId === undefined) {
    throw new Error('Körper fehlt.');
  }
  ausfuehren(`INSERT INTO vorlage_gewichte (vorlage_id, attribut_id, gewicht) VALUES (?, ?, 1)`, vorlageId, attributId);
  return vorlageId;
}

function eintrag(vorlageId: number, extra: Partial<EintragDaten> = {}): EintragDaten {
  return {
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
    ...extra,
  };
}

const visionDaten = {
  titel: 'Traum',
  beschreibung: '',
  farbe: '#112233',
  woopErgebnis: '',
  woopHindernis: '',
  woopPlan: '',
  level: null,
};

describe('ebenen und fokus', () => {
  it('übernimmt die Stufe einmal und lässt dieselbe Stufe die Schalter in Ruhe', () => {
    mitWelt(welt(), () => {
      expect(aendereEinstellungen({ zielstrebigkeit: 'traeumer', profilAngelegt: true }).ebenen).toEqual(
        ebenenFuerStufe('traeumer'),
      );
      expect(aendereEinstellungen({ zielstrebigkeit: 'macher' }).ebenen).toEqual(ebenenFuerStufe('macher'));
      expect(aendereEinstellungen({ zielstrebigkeit: 'bodenstaendig' }).ebenen).toEqual(ebenenFuerStufe('bodenstaendig'));
      aendereEinstellungen({ zielstrebigkeit: 'traeumer' });
      aendereEinstellungen({ ebenen: { organisationen: true } });
      expect(ladeEinstellungen().ebenen.organisationen).toBe(true);
      aendereEinstellungen({ zielstrebigkeit: 'traeumer' });
      expect(ladeEinstellungen().ebenen.organisationen).toBe(true);
      expect(aendereEinstellungen({ ebenen: { projekte: false, organisationen: true } }).ebenen).toMatchObject({
        projekte: false,
        organisationen: false,
        vorhaben: false,
      });
    });
  });

  it('erlaubt Projekte ohne Eltern und weist Vorhaben und Einträge ohne Ziel zu', () => {
    mitWelt(welt(), () => {
      const vorlageId = taetigkeit();
      const projekt = erstelleProjekt({
        name: 'Bau',
        beschreibung: '',
        visionId: null,
        organisationId: null,
        standardVorlageId: vorlageId,
      });
      expect(projekt.visionId).toBeNull();
      expect(projekt.organisationId).toBeNull();
      const vision = erstelleVision(visionDaten);
      const organisation = erstelleOrganisation({
        name: 'Verein',
        beschreibung: '',
        farbe: '#445566',
        visionId: null,
      });
      expect(() =>
        erstelleProjekt({
          name: 'Beides',
          beschreibung: '',
          visionId: vision.id,
          organisationId: organisation.id,
          standardVorlageId: vorlageId,
        }),
      ).toThrow(/Vision oder zu einer Organisation/);

      expect(() => erstelleVorhaben(null, 'Ohne Projekt')).toThrow(/braucht ein Projekt/);
      ausfuehren(`INSERT INTO vorhaben (titel) VALUES ('Ohne Projekt')`);
      expect(ladeZiele().vorhaben.some((eintrag) => eintrag.titel === 'Ohne Projekt' && eintrag.projektId === null)).toBe(
        true,
      );
      const ohneZiel = erstelleEintrag(eintrag(vorlageId));
      expect(ohneZiel.eintrag.projektId).toBeNull();
      expect(xpSumme('xp_ereignisse')).toBeGreaterThan(0);
      expect(xpSumme('projekt_xp')).toBe(0);

      const gebunden = erstelleVorhaben(projekt.id, 'Am Bau');
      const geerbt = erstelleEintrag(eintrag(vorlageId, { vorhaben: { art: 'bestehend', id: gebunden.id } }));
      expect(geerbt.eintrag.projektId).toBe(projekt.id);
      expect(xpSumme('projekt_xp')).toBeGreaterThan(0);
      const anderes = erstelleProjekt({
        name: 'Anderes',
        beschreibung: '',
        visionId: null,
        organisationId: null,
        standardVorlageId: vorlageId,
      });
      expect(() =>
        erstelleEintrag(
          eintrag(vorlageId, { projektId: anderes.id, vorhaben: { art: 'bestehend', id: gebunden.id } }),
        ),
      ).toThrow(/anderen Projekt/);
    });
  });

  it('blendet Ebenen aus, ohne sie zu löschen, und sperrt Projekt-Schreiben', () => {
    mitWelt(welt(), () => {
      const vorlageId = taetigkeit();
      const vision = erstelleVision(visionDaten);
      const projekt = erstelleProjekt({
        name: 'Bau',
        beschreibung: '',
        visionId: vision.id,
        organisationId: null,
        standardVorlageId: vorlageId,
      });
      aendereEinstellungen({ ebenen: { visionen: false } });
      expect(anzahl('visionen')).toBe(1);
      expect(() => erstelleVision({ ...visionDaten, titel: 'Neu' })).toThrow(/Visionen sind ausgeschaltet/);
      aendereEinstellungen({ ebenen: { visionen: true } });
      expect(ladeZiele().visionen.some((eintrag) => eintrag.id === vision.id)).toBe(true);

      const vorhanden = erstelleVorhaben(projekt.id, 'Bleibt');
      expect(vorhanden.projektId).toBe(projekt.id);
      aendereEinstellungen({ ebenen: { projekte: false } });
      expect(ladeEinstellungen().ebenen).toMatchObject({
        projekte: false,
        vorhaben: false,
        organisationen: false,
      });
      expect(() => erstelleEintrag(eintrag(vorlageId, { projektId: projekt.id }))).toThrow(/Projekte sind ausgeschaltet/);
      expect(anzahl('projekte')).toBe(1);
      expect(() => erstelleVorhaben(projekt.id, 'Neu')).toThrow(/Vorhaben sind ausgeschaltet/);
      expect(anzahl('vorhaben')).toBe(1);
      expect(ladeZiele().vorhaben).toEqual([]);
    });
  });

  it('schaltet Haben aus, wenn der Fokus keinen Haben-Wert braucht', () => {
    mitWelt(welt(), () => {
      ausfuehren(
        `INSERT INTO attribute (typ, name, beschreibung, farbe, icon, sortierung) VALUES ('status', 'Eigenstatus', '', '#ffffff', 'star', 90)`,
      );
      const neu = aendereEinstellungen({ fokus: ['sport'], zielstrebigkeit: 'bodenstaendig', profilAngelegt: true });
      expect(neu.funktionen).toMatchObject({ koennen: true, status: false });
      expect(neu.ebenen).toEqual(ebenenFuerStufe('bodenstaendig'));
      const status = alle<{ kennung: string | null; name: string }>(
        `SELECT kennung, name FROM attribute WHERE typ = 'status' AND archiviert = 0`,
      );
      expect(status).toEqual([{ kennung: null, name: 'Eigenstatus' }]);
      expect(ladeAttribute(true).find((attribut) => attribut.kennung === 'intellekt')?.archiviert).toBe(true);
      expect(ladeAttribute(true).find((attribut) => attribut.kennung === 'koerper')?.archiviert).toBe(false);
      expect(ladeAttribute(false).some((attribut) => attribut.kennung === 'einfluss')).toBe(false);
    });
  });

  it('liest kleineErfolge als bodenstaendig und schaltet bei uebung Fähigkeiten an', () => {
    mitWelt(welt(), () => {
      ausfuehren(`INSERT INTO einstellungen (schluessel, wert) VALUES ('zielstrebigkeit', ?)`, JSON.stringify('kleineErfolge'));
      expect(ladeEinstellungen().zielstrebigkeit).toBe('bodenstaendig');
      const uebung = aendereEinstellungen({ zielstrebigkeit: 'uebung', profilAngelegt: true });
      expect(uebung.ebenen).toEqual(ebenenFuerStufe('uebung'));
      expect(uebung.funktionen.faehigkeiten).toBe(true);
      const einfach = aendereEinstellungen({ zielstrebigkeit: 'einfach' });
      expect(einfach.ebenen).toEqual(ebenenFuerStufe('einfach'));
      expect(einfach.funktionen.faehigkeiten).toBe(true);
    });
  });

  it('nimmt Vorhaben und Fähigkeit zusammen auf', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { faehigkeiten: true } });
      const vorlageId = taetigkeit();
      const projekt = erstelleProjekt({
        name: 'Studio',
        beschreibung: '',
        visionId: null,
        organisationId: null,
        standardVorlageId: vorlageId,
      });
      const vorhaben = erstelleVorhaben(projekt.id, 'Üben');
      const faehigkeit = erstelleFaehigkeit({
        name: 'Gitarre',
        beschreibung: '',
        farbe: '#a78bfa',
        icon: 'star',
      });
      const ergebnis = erstelleEintrag(
        eintrag(vorlageId, {
          vorhaben: { art: 'bestehend', id: vorhaben.id },
          faehigkeitId: faehigkeit.id,
        }),
      );
      expect(ergebnis.eintrag.projektId).toBe(projekt.id);
      expect(ergebnis.eintrag.vorhaben?.id).toBe(vorhaben.id);
      expect(ergebnis.eintrag.faehigkeit?.id).toBe(faehigkeit.id);
    });
  });

  it('verweigert Schreiben auf ausgeschaltete Funktionen und erbt kein Projekt', () => {
    mitWelt(welt(), () => {
      const vorlageId = taetigkeit();
      expect(() => erstelleFaehigkeit({ name: 'Gitarre', beschreibung: '', farbe: '#a78bfa', icon: 'star' })).toThrow(
        /Fähigkeiten ist ausgeschaltet/,
      );
      expect(() =>
        erstelleBasisAufgabe({ name: 'Dehnen', icon: 'star', projektId: null, vorlageId, stunden: null }),
      ).toThrow(/Basis ist ausgeschaltet/);
      expect(() => speichereRueckblick(aktuelleWoche(new Date()), { gut: 'Gut', lernen: '', fokus: '' })).toThrow(
        /Rückblick ist ausgeschaltet/,
      );

      aendereEinstellungen({ funktionen: { faehigkeiten: true } });
      const faehigkeit = erstelleFaehigkeit({ name: 'Gitarre', beschreibung: '', farbe: '#a78bfa', icon: 'star' });
      aendereEinstellungen({ funktionen: { faehigkeiten: false } });
      expect(() => aendereFaehigkeit(faehigkeit.id, { name: 'Neu' })).toThrow(/Fähigkeiten ist ausgeschaltet/);
      expect(() => erstelleEintrag(eintrag(vorlageId, { faehigkeitId: faehigkeit.id }))).toThrow(
        /Fähigkeiten ist ausgeschaltet/,
      );
      const ohne = erstelleEintrag(eintrag(vorlageId));
      expect(ohne.eintrag.projektId).toBeNull();
      expect(ohne.eintrag.faehigkeit).toBeNull();

      const projekt = erstelleProjekt({
        name: 'Bau',
        beschreibung: '',
        visionId: null,
        organisationId: null,
        standardVorlageId: vorlageId,
      });
      const vorhaben = erstelleVorhaben(projekt.id, 'Am Bau');
      aendereEinstellungen({ ebenen: { projekte: false } });
      expect(ladeEinstellungen().ebenen.vorhaben).toBe(false);
      expect(() => erstelleEintrag(eintrag(vorlageId, { vorhaben: { art: 'bestehend', id: vorhaben.id } }))).toThrow(
        /Vorhaben sind ausgeschaltet/,
      );
    });
  });

  it('schaltet Projekte mit Vorhaben ein und repariert alte Stufen beim Lesen', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ ebenen: { projekte: false } });
      expect(ladeEinstellungen().ebenen.vorhaben).toBe(false);
      const an = aendereEinstellungen({ ebenen: { vorhaben: true } });
      expect(an.ebenen.projekte).toBe(true);
      expect(an.ebenen.vorhaben).toBe(true);
      ausfuehren(
        `INSERT INTO einstellungen (schluessel, wert) VALUES ('ebenen', ?)
         ON CONFLICT (schluessel) DO UPDATE SET wert = excluded.wert`,
        JSON.stringify({ visionen: false, organisationen: false, projekte: false, vorhaben: true }),
      );
      const gelesen = ladeEinstellungen().ebenen;
      expect(gelesen.projekte).toBe(true);
      expect(gelesen.vorhaben).toBe(true);
      expect(gelesen.visionen).toBe(false);
    });
  });
});
