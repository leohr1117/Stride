import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { projektAbschlussBonus } from '../../shared/spiel/xp.ts';
import { ausfuehren, eine, migriere, mitWelt, schliesseWelt } from '../db.ts';
import { MIGRATIONEN } from '../migrationen.ts';
import { erstelleEintrag, loescheEintrag } from '../features/eintraege/eintraege.ts';
import { istLoeschbar, loescheProjekt, loescheVorlage } from './loeschen.ts';
import { aendereProjekt, erstelleProjekt, ladeProjekt } from './struktur.ts';
import { aendereVorlage, erstelleVorlage } from '../features/taetigkeiten/vorlagen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-abschluss-'));
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

function attributId(kennung: string): number {
  const id = eine<{ id: number }>('SELECT id FROM attribute WHERE kennung = ?', kennung)?.id;
  if (id === undefined) {
    throw new Error(`${kennung} fehlt.`);
  }
  return id;
}

function vorlage(name: string, attribut: number, projektId?: number): number {
  return erstelleVorlage({
    name,
    icon: 'star',
    gewichte: [{ attributId: attribut, gewicht: 1 }],
    projektId: projektId ?? null,
  }).id;
}

function projekt(name: string, standardVorlageId: number, abschlussVorlageId?: number) {
  return erstelleProjekt({
    name,
    beschreibung: '',
    visionId: null,
    organisationId: null,
    standardVorlageId,
    abschlussVorlageId: abschlussVorlageId ?? null,
  });
}

function xpVon(tabelle: 'projekt_xp' | 'xp_ereignisse', quelle: string): number {
  return (
    eine<{ xp: number }>(`SELECT COALESCE(SUM(xp), 0) AS xp FROM ${tabelle} WHERE quelle = ?`, quelle)?.xp ?? 0
  );
}

function eintraege(projektId: number, vorlageId?: number): number {
  return (
    eine<{ anzahl: number }>(
      `SELECT COUNT(*) AS anzahl FROM eintraege WHERE projekt_id = ? AND (? IS NULL OR vorlage_id = ?)`,
      projektId,
      vorlageId ?? null,
      vorlageId ?? null,
    )?.anzahl ?? 0
  );
}

describe('Projekt abschließen', () => {
  it('zahlt den Bonus einmal über die Abschlusstätigkeit', () => {
    mitWelt(welt(), () => {
      const koerper = attributId('koerper');
      const denken = vorlage('Denken', koerper);
      const liefern = vorlage('Liefern', koerper);
      const ziel = projekt('Stride', denken, liefern);
      const zeit = new Date(2026, 5, 2, 10, 0, 0);
      erstelleEintrag(
        {
          projektId: ziel.id,
          vorlageId: denken,
          vorhaben: null,
          abschluss: null,
          erkenntnis: '',
          stunden: 2,
          notiz: '',
          meilenstein: false,
          faehigkeitId: null,
          datum: null,
        },
        zeit,
      );
      const umfang = xpVon('projekt_xp', 'eintrag');
      const bonus = projektAbschlussBonus(umfang);

      const erstes = aendereProjekt(ziel.id, { geschafft: true }, zeit);
      expect(erstes.belohnung?.meilenstein).toBe(false);
      expect(erstes.belohnung?.boni).toEqual([{ quelle: 'abschluss', label: 'Projekt abgeschlossen', xp: bonus }]);
      expect(erstes.belohnung?.projekt).toEqual({ name: 'Stride', xp: bonus });
      expect(xpVon('projekt_xp', 'abschluss')).toBe(bonus);
      expect(xpVon('xp_ereignisse', 'abschluss')).toBe(bonus);
      expect(eintraege(ziel.id, liefern)).toBe(1);
      expect(eintraege(ziel.id)).toBe(2);
      expect(erstes.abschluss?.stunden).toBe(2);
      expect(erstes.abschluss?.eintraege).toBe(2);
      expect(erstes.abschluss?.xp).toBe(umfang + bonus);
      expect(erstes.abschluss?.bis).toBe(erstes.geschafftAm);

      const offenWieder = aendereProjekt(ziel.id, { geschafft: false });
      expect(offenWieder.geschafftAm).toBeNull();
      expect(offenWieder.abschluss).toBeNull();
      expect(offenWieder.belohnung).toBeNull();
      expect(eine<{ am: string | null }>('SELECT abschluss_bonus_am AS am FROM projekte WHERE id = ?', ziel.id)?.am).toBe(
        erstes.geschafftAm,
      );

      const spaeter = new Date(2026, 5, 3, 10, 0, 0);
      const nochmal = aendereProjekt(ziel.id, { geschafft: true }, spaeter);
      expect(nochmal.belohnung).toBeNull();
      expect(nochmal.geschafftAm).toBe(spaeter.toISOString());
      expect(xpVon('projekt_xp', 'abschluss')).toBe(bonus);
      expect(eintraege(ziel.id, liefern)).toBe(1);
      expect(eine<{ am: string | null }>('SELECT abschluss_bonus_am AS am FROM projekte WHERE id = ?', ziel.id)?.am).toBe(
        erstes.geschafftAm,
      );
    });
  });

  it('zahlt ohne Tätigkeit und lässt den feierlichen Eintrag aus den Stunden', () => {
    mitWelt(welt(), () => {
      const koerper = attributId('koerper');
      const tun = vorlage('Tun', koerper);
      const ziel = projekt('Ohne', tun);
      erstelleEintrag(
        {
          projektId: ziel.id,
          vorlageId: tun,
          vorhaben: null,
          abschluss: null,
          erkenntnis: '',
          stunden: 2,
          notiz: '',
          meilenstein: false,
          faehigkeitId: null,
          datum: null,
        },
        new Date(2026, 5, 2, 11, 0, 0),
      );
      const fertig = aendereProjekt(ziel.id, { geschafft: true });
      expect(fertig.belohnung).not.toBeNull();
      expect(eintraege(ziel.id)).toBe(1);
      expect(fertig.abschluss?.stunden).toBe(2);
      expect(fertig.abschluss?.eintraege).toBe(1);
      expect(xpVon('projekt_xp', 'abschluss')).toBe(projektAbschlussBonus(xpVon('projekt_xp', 'eintrag')));
    });
  });

  it('gibt einem leeren Projekt die Basis und lässt es danach nicht mehr löschen', () => {
    mitWelt(welt(), () => {
      const koerper = attributId('koerper');
      const tun = vorlage('Tun', koerper);
      const liefern = vorlage('Liefern', koerper);
      const ziel = projekt('Leer', tun, liefern);
      expect(istLoeschbar('vorlage', liefern)).toBe(false);
      expect(() => loescheVorlage(liefern)).toThrow(/genutzt/);
      expect(() => aendereVorlage(liefern, { archiviert: true })).toThrow(/Abschlusstätigkeit/);

      const fertig = aendereProjekt(ziel.id, { geschafft: true });
      expect(fertig.belohnung?.boni[0]?.xp).toBe(60);
      expect(fertig.abschluss?.xp).toBe(60);
      expect(fertig.abschluss?.level).toBe(1);
      expect(fertig.abschluss?.stunden).toBe(0);
      expect(fertig.abschluss?.eintraege).toBe(1);
      expect(istLoeschbar('projekt', ziel.id)).toBe(false);
      expect(() => loescheProjekt(ziel.id)).toThrow(/genutzt/);

      const eintragId = eine<{ id: number }>('SELECT id FROM eintraege WHERE projekt_id = ?', ziel.id)?.id;
      if (eintragId === undefined) {
        throw new Error('Abschluss-Eintrag fehlt.');
      }
      loescheEintrag(eintragId);
      const wieder = aendereProjekt(ziel.id, { geschafft: false });
      expect(wieder.geschafftAm).toBeNull();
      expect(eintraege(ziel.id)).toBe(0);
      expect(xpVon('projekt_xp', 'abschluss')).toBe(0);
      expect(istLoeschbar('projekt', ziel.id)).toBe(false);
    });
  });

  it('schließt nicht ab, wenn kein Gewicht trägt', () => {
    mitWelt(welt(), () => {
      const koerper = attributId('koerper');
      const leer = vorlage('Leer', koerper);
      ausfuehren('DELETE FROM vorlage_gewichte WHERE vorlage_id = ?', leer);
      const ziel = projekt('Hängt', leer);
      expect(() => aendereProjekt(ziel.id, { geschafft: true })).toThrow(/kein aktives Attribut/);
      expect(ladeProjekt(ziel.id).geschafftAm).toBeNull();
      expect(eine<{ am: string | null }>('SELECT abschluss_bonus_am AS am FROM projekte WHERE id = ?', ziel.id)?.am).toBeNull();
    });
  });

  it('behält eine archivierte Abschlusstätigkeit und lehnt eine andere ab', () => {
    mitWelt(welt(), () => {
      const koerper = attributId('koerper');
      const standard = vorlage('Standard', koerper);
      const alt = vorlage('Alt', koerper);
      const weg = vorlage('Weg', koerper);
      const ziel = projekt('Wahl', standard, alt);
      ausfuehren('UPDATE vorlagen SET archiviert = 1 WHERE id IN (?, ?)', alt, weg);
      expect(aendereProjekt(ziel.id, { abschlussVorlageId: alt }).abschlussVorlageId).toBe(alt);
      expect(() => aendereProjekt(ziel.id, { abschlussVorlageId: weg })).toThrow(/archiviert/);
      expect(aendereProjekt(ziel.id, { abschlussVorlageId: null }).abschlussVorlageId).toBeNull();
    });
  });

  it('lehnt eine Tätigkeit aus einem anderen Projekt ab', () => {
    mitWelt(welt(), () => {
      const koerper = attributId('koerper');
      const standard = vorlage('Standard', koerper);
      const fremd = projekt('Fremd', standard);
      const eigen = vorlage('Eigen', koerper, fremd.id);
      expect(() => projekt('Hier', standard, eigen)).toThrow(/anderen Projekt/);
      const hier = projekt('Hier', standard);
      expect(() => aendereProjekt(hier.id, { abschlussVorlageId: eigen })).toThrow(/anderen Projekt/);
    });
  });
});

describe('Migration des Abschluss-Bonus', () => {
  const datenbanken: DatabaseSync[] = [];

  afterEach(() => {
    for (const datenbank of datenbanken) {
      datenbank.close();
    }
    datenbanken.length = 0;
  });

  it('merkt bestehende Abschlüsse, ohne XP nachzuzahlen', () => {
    const db = new DatabaseSync(path.join(ordner, 'migration.db'));
    datenbanken.push(db);
    db.exec('PRAGMA foreign_keys = ON');
    const ziel = MIGRATIONEN.findIndex((sql) => sql.includes('abschluss_vorlage_id'));
    expect(ziel).toBeGreaterThan(0);
    migriere(db, ziel);
    const vorlageId = Number(
      db.prepare(`INSERT INTO vorlagen (name, icon, sortierung) VALUES ('Alt', 'star', 1)`).run().lastInsertRowid,
    );
    db.prepare(
      `INSERT INTO projekte (standard_vorlage_id, name, geschafft_am) VALUES (?, 'Schon fertig', '2024-05-01T08:00:00.000Z')`,
    ).run(vorlageId);
    migriere(db);
    const zeile = db
      .prepare(
        `SELECT geschafft_am AS geschafft, abschluss_bonus_am AS bonus, abschluss_vorlage_id AS vorlage
         FROM projekte WHERE name = 'Schon fertig'`,
      )
      .get() as { geschafft: string; bonus: string; vorlage: number | null };
    expect(zeile.bonus).toBe(zeile.geschafft);
    expect(zeile.vorlage).toBeNull();
    expect(db.prepare('SELECT COUNT(*) AS anzahl FROM projekt_xp').get()).toEqual({ anzahl: 0 });
  });
});
