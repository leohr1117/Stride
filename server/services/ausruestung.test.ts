import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ausfuehren, eine, mitWelt, schliesseWelt } from '../db.ts';
import { aendereEinstellungen } from '../features/einstellungen/einstellungen.ts';
import { erstelleEintrag } from '../features/eintraege/eintraege.ts';
import { aendereProjekt, aendereVision, erstelleProjekt, erstelleVision, ladeProjekt } from './struktur.ts';
import { erstelleVorlage } from '../features/taetigkeiten/vorlagen.ts';
import { aendereInvestition, erstelleInvestition, ladeBoniJeProjekt, ladeInvestitionen } from '../features/investitionen/ausruestung.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-investition-'));
const offen: string[] = [];
let nummer = 0;
const frueh = new Date(2026, 5, 1, 10, 0, 0);
const mitte = new Date(2026, 5, 1, 15, 0, 0);
const spaet = new Date(2026, 5, 1, 18, 0, 0);
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

function vorlage(name: string, attribut: number): number {
  return erstelleVorlage({ name, icon: 'star', gewichte: [{ attributId: attribut, gewicht: 1 }] }).id;
}

function projekt(name: string, vorlageId: number) {
  return erstelleProjekt({
    name,
    beschreibung: '',
    visionId: null,
    organisationId: null,
    standardVorlageId: vorlageId,
  });
}

function eintrag(projektId: number, vorlageId: number, zeit: Date) {
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
      faehigkeitId: null,
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

function gespeicherterBonus(eintragId: number): number {
  return eine<{ bonus: number }>('SELECT ausruestung_bonus AS bonus FROM eintraege WHERE id = ?', eintragId)?.bonus ?? 0;
}

function attributXp(eintragId: number, id: number): number {
  return eine<{ xp: number }>(
    `SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse
     WHERE eintrag_id = ? AND attribut_id = ? AND quelle = 'eintrag'`,
    eintragId,
    id,
  )?.xp ?? 0;
}

describe('Investition aus einem Projekt', () => {
  it('gibt nach dem Schaffen 10 % auf das Projekt und lässt frühere Einträge aus', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { ausruestung: true } });
      const koerper = attributId('koerper');
      const vorlageId = vorlage('Tun', koerper);
      const ziel = projekt('Werkstatt', vorlageId);
      aendereProjekt(
        ziel.id,
        { investition: true, investitionZiel: { art: 'projekt', id: ziel.id }, geschafft: true },
        mitte,
      );

      const ohne = eintrag(ziel.id, vorlageId, frueh);
      const mit = eintrag(ziel.id, vorlageId, spaet);
      expect(projektXp(mit.eintrag.id)).toBe(Math.round(projektXp(ohne.eintrag.id) * 1.1));
      expect(attributXp(mit.eintrag.id, koerper)).toBe(attributXp(ohne.eintrag.id, koerper));
      expect(gespeicherterBonus(mit.eintrag.id)).toBeCloseTo(0.1);
      expect(ladeBoniJeProjekt().get(ziel.id)).toBeCloseTo(0.1);

      const aus = aendereProjekt(ziel.id, { investition: false });
      expect(aus.investitionZiel).toEqual({ art: 'projekt', id: ziel.id });
      expect(ladeBoniJeProjekt().has(ziel.id)).toBe(false);
    });
  });

  it('verstärkt nur das Attribut und nicht die Projekt-XP', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { ausruestung: true } });
      const koerper = attributId('koerper');
      const vorlageId = vorlage('Tun', koerper);
      const ziel = projekt('Werkstatt', vorlageId);
      const quelle = projekt('Gerät', vorlageId);
      aendereProjekt(
        quelle.id,
        { investition: true, investitionZiel: { art: 'attribut', id: koerper }, geschafft: true },
        mitte,
      );
      const ohne = eintrag(ziel.id, vorlageId, frueh);
      const mit = eintrag(ziel.id, vorlageId, spaet);
      expect(projektXp(mit.eintrag.id)).toBe(projektXp(ohne.eintrag.id));
      expect(attributXp(mit.eintrag.id, koerper)).toBe(Math.round(attributXp(ohne.eintrag.id, koerper) * 1.1));
      expect(gespeicherterBonus(mit.eintrag.id)).toBe(0);
    });
  });

  it('legt Vision und Ressourcen übereinander, aber nicht auf denselben XP', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { ausruestung: true } });
      const ressourcen = attributId('ressourcen');
      const vorlageId = vorlage('Kauf', ressourcen);
      const vision = erstelleVision({
        titel: 'Reich werden',
        beschreibung: '',
        farbe: '#facc15',
        woopErgebnis: '',
        woopHindernis: '',
        woopPlan: '',
        level: null,
      });
      const ziel = erstelleProjekt({
        name: 'Café',
        beschreibung: '',
        visionId: vision.id,
        organisationId: null,
        standardVorlageId: vorlageId,
      });
      aendereProjekt(
        ziel.id,
        {
          investition: true,
          investitionZiel: { art: 'vision', id: vision.id },
          investitionRessourcen: true,
          geschafft: true,
        },
        mitte,
      );
      const ohne = eintrag(ziel.id, vorlageId, frueh);
      const mit = eintrag(ziel.id, vorlageId, spaet);
      const vorherProjekt = projektXp(ohne.eintrag.id);
      const vorherAttribut = attributXp(ohne.eintrag.id, ressourcen);
      expect(projektXp(mit.eintrag.id)).toBe(Math.round(vorherProjekt * 1.1));
      expect(attributXp(mit.eintrag.id, ressourcen)).toBe(Math.round(vorherAttribut * 1.1));
      expect(attributXp(mit.eintrag.id, ressourcen)).not.toBe(Math.round(vorherAttribut * 1.21));
      expect(ladeProjekt(ziel.id).investitionRessourcen).toBe(true);
    });
  });

  it('zählt Ressourcen nicht doppelt, wenn das Attribut schon das Ziel ist', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { ausruestung: true } });
      const ressourcen = attributId('ressourcen');
      const vorlageId = vorlage('Kauf', ressourcen);
      const ziel = projekt('Kasse', vorlageId);
      const gespeichert = aendereProjekt(
        ziel.id,
        {
          investition: true,
          investitionZiel: { art: 'attribut', id: ressourcen },
          investitionRessourcen: true,
          geschafft: true,
        },
        mitte,
      );
      expect(gespeichert.investitionRessourcen).toBe(false);
      const erster = eintrag(ziel.id, vorlageId, frueh);
      const zweiter = eintrag(ziel.id, vorlageId, spaet);
      expect(attributXp(zweiter.eintrag.id, ressourcen)).toBe(Math.round(attributXp(erster.eintrag.id, ressourcen) * 1.1));
    });
  });

  it('deckelt sechs Investitionen bei 50 %', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { ausruestung: true } });
      const koerper = attributId('koerper');
      const vorlageId = vorlage('Tun', koerper);
      const ziel = projekt('Werkstatt', vorlageId);
      for (let index = 0; index < 6; index += 1) {
        const quelle = projekt(`Quelle ${index}`, vorlageId);
        aendereProjekt(
          quelle.id,
          { investition: true, investitionZiel: { art: 'projekt', id: ziel.id }, geschafft: true },
          mitte,
        );
      }
      const ohne = eintrag(ziel.id, vorlageId, frueh);
      const mit = eintrag(ziel.id, vorlageId, spaet);
      expect(ladeBoniJeProjekt().get(ziel.id)).toBe(0.5);
      expect(projektXp(mit.eintrag.id)).toBe(Math.round(projektXp(ohne.eintrag.id) * 1.5));
    });
  });

  it('gibt keinen Bonus ohne Funktion, ohne Schaffen oder aus dem Archiv', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { ausruestung: true } });
      const koerper = attributId('koerper');
      const vorlageId = vorlage('Tun', koerper);
      const ziel = projekt('Werkstatt', vorlageId);
      const quelle = projekt('Gerät', vorlageId);
      aendereProjekt(quelle.id, { investition: true, investitionZiel: { art: 'projekt', id: ziel.id } }, mitte);
      const wartend = eintrag(ziel.id, vorlageId, frueh);
      const basis = projektXp(wartend.eintrag.id);

      aendereProjekt(quelle.id, { geschafft: true }, mitte);
      aendereEinstellungen({ funktionen: { ausruestung: false } });
      const aus = eintrag(ziel.id, vorlageId, spaet);
      expect(projektXp(aus.eintrag.id)).toBe(basis);
      expect(ladeBoniJeProjekt().has(ziel.id)).toBe(false);

      aendereEinstellungen({ funktionen: { ausruestung: true } });
      aendereProjekt(quelle.id, { archiviert: true });
      const archiv = eintrag(ziel.id, vorlageId, new Date(2026, 5, 1, 20, 0, 0));
      expect(projektXp(archiv.eintrag.id)).toBe(basis);
    });
  });

  it('lehnt eine archivierte Vision ab und lässt das Ziel leer', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { ausruestung: true } });
      const koerper = attributId('koerper');
      const vorlageId = vorlage('Tun', koerper);
      const ziel = projekt('Werkstatt', vorlageId);
      const vision = erstelleVision({
        titel: 'Weg',
        beschreibung: '',
        farbe: '#94a3b8',
        woopErgebnis: '',
        woopHindernis: '',
        woopPlan: '',
        level: null,
      });
      aendereVision(vision.id, { archiviert: true });
      expect(() =>
        aendereProjekt(ziel.id, { investition: true, investitionZiel: { art: 'vision', id: vision.id } }),
      ).toThrow(/Vision/);

      const leer = aendereProjekt(ziel.id, { investition: true, investitionZiel: { art: 'projekt', id: ziel.id }, geschafft: true });
      expect(aendereProjekt(ziel.id, { investitionZiel: null }).investition).toBe(true);
      expect(ladeProjekt(leer.id).investitionZiel).toBeNull();
      expect(ladeBoniJeProjekt().has(ziel.id)).toBe(false);
    });
  });

  it('verschiebt den Zeitpunkt des Schaffens nicht', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { ausruestung: true } });
      const koerper = attributId('koerper');
      const vorlageId = vorlage('Tun', koerper);
      const ziel = projekt('Werkstatt', vorlageId);
      const erstes = aendereProjekt(ziel.id, { geschafft: true }, mitte);
      const nochmal = aendereProjekt(ziel.id, { geschafft: true }, spaet);
      expect(nochmal.geschafftAm).toBe(erstes.geschafftAm);
      expect(aendereProjekt(ziel.id, { geschafft: false }).geschafftAm).toBeNull();
    });
  });

  it('setzt die Größe und gibt einer eigenen Investition sofort den Bonus', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { ausruestung: true } });
      const koerper = attributId('koerper');
      const vorlageId = vorlage('Tun', koerper);
      const ziel = projekt('Werkstatt', vorlageId);
      const gross = aendereProjekt(
        ziel.id,
        { investition: true, investitionZiel: { art: 'projekt', id: ziel.id }, investitionGroesse: 3, geschafft: true },
        mitte,
      );
      expect(gross.investitionGroesse).toBe(3);
      expect(gross.investitionBonus).toBeCloseTo(0.3);

      const ohne = eintrag(ziel.id, vorlageId, frueh);
      const mit = eintrag(ziel.id, vorlageId, spaet);
      expect(projektXp(mit.eintrag.id)).toBe(Math.round(projektXp(ohne.eintrag.id) * 1.3));
      expect(attributXp(mit.eintrag.id, koerper)).toBe(attributXp(ohne.eintrag.id, koerper));
      expect(eine<{ krit: number }>('SELECT krit FROM eintraege WHERE id = ?', mit.eintrag.id)?.krit).toBe(0);

      const eigene = erstelleInvestition({ name: 'Bank', icon: 'gem', groesse: 0, attributId: koerper });
      expect(eigene.bonus).toBeCloseTo(0.05);
      const danach = eintrag(ziel.id, vorlageId, new Date(2026, 5, 1, 20, 0, 0));
      expect(attributXp(danach.eintrag.id, koerper)).toBe(Math.round(attributXp(mit.eintrag.id, koerper) * 1.05));

      ausfuehren(`UPDATE investitionen SET ziel_art = 'attribut', ziel_id = ? WHERE id = ?`, koerper, eigene.id);
      const nochmal = eintrag(ziel.id, vorlageId, new Date(2026, 5, 1, 21, 0, 0));
      expect(attributXp(nochmal.eintrag.id, koerper)).toBe(attributXp(danach.eintrag.id, koerper));

      expect(mit.eintrag.ausruestungBonus).toBeCloseTo(0.3);
      expect(aendereInvestition(eigene.id, { archiviert: true }).archiviert).toBe(true);
      expect(ladeInvestitionen().some((zeile) => zeile.id === eigene.id && zeile.archiviert)).toBe(true);
      const ohneEigene = eintrag(ziel.id, vorlageId, new Date(2026, 5, 1, 22, 0, 0));
      expect(attributXp(ohneEigene.eintrag.id, koerper)).toBe(attributXp(mit.eintrag.id, koerper));
    });
  });

  it('nimmt bei einer eigenen Investition ein Projekt als Ziel', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { ausruestung: true } });
      const koerper = attributId('koerper');
      const vorlageId = vorlage('Tun', koerper);
      const ziel = projekt('Werkstatt', vorlageId);
      const basis = eintrag(ziel.id, vorlageId, frueh);

      const eigene = erstelleInvestition({
        name: 'Bank',
        icon: 'gem',
        groesse: 1,
        attributId: koerper,
        ziel: { art: 'projekt', id: ziel.id },
      });
      expect(eigene.ziel).toEqual({ art: 'projekt', id: ziel.id });
      expect(eigene.zielName).toBe('Werkstatt');
      expect(eigene.bonus).toBeCloseTo(0.1);

      const mit = eintrag(ziel.id, vorlageId, mitte);
      expect(mit.eintrag.ausruestungBonus).toBeCloseTo(0.1);
      expect(projektXp(mit.eintrag.id)).toBe(Math.round(projektXp(basis.eintrag.id) * 1.1));
      expect(attributXp(mit.eintrag.id, koerper)).toBe(Math.round(attributXp(basis.eintrag.id, koerper) * 1.1));

      expect(() => aendereInvestition(eigene.id, { ziel: { art: 'attribut', id: koerper } })).toThrow(/Attribut oder ein Projekt/);
      const ohneProjekt = aendereInvestition(eigene.id, { ziel: null });
      expect(ohneProjekt.ziel).toBeNull();
      const danach = eintrag(ziel.id, vorlageId, spaet);
      expect(danach.eintrag.ausruestungBonus).toBe(0);
      expect(attributXp(danach.eintrag.id, koerper)).toBe(attributXp(mit.eintrag.id, koerper));
      expect(() =>
        erstelleInvestition({
          name: 'Weg',
          icon: 'gem',
          groesse: 1,
          attributId: koerper,
          ziel: { art: 'projekt', id: 999999 },
        }),
      ).toThrow(/Projekt/);
    });
  });
});
