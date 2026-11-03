import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChronikEintrag, InvestitionsBuchung } from '../../../shared/api/index.ts';
import { ausfuehren, eine, mitWelt, schliesseWelt } from '../../db.ts';
import { bucheAttributXp } from '../../services/fortschritt.ts';
import { aendereInvestition, erstelleInvestition, loescheInvestition } from '../investitionen/ausruestung.ts';
import { erstelleVorlage } from '../taetigkeiten/vorlagen.ts';
import { ladeChronik } from './eintraege.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-chronik-'));
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

function vorlageId(): number {
  const koerper = eine<{ id: number }>('SELECT id FROM attribute WHERE kennung = ?', 'koerper')?.id;
  if (koerper === undefined) {
    throw new Error('Körper fehlt.');
  }
  return erstelleVorlage({ name: 'Tun', icon: 'star', gewichte: [{ attributId: koerper, gewicht: 1 }] }).id;
}

function eintrag(vorlage: number, tag: string, meilenstein: number): void {
  const [jahr, monat, tageszahl] = tag.split('-').map(Number);
  const zeit = new Date(jahr, monat - 1, tageszahl, 12, 0, 0).toISOString();
  ausfuehren(
    `INSERT INTO eintraege (vorlage_id, stunden, notiz, meilenstein, erstellt_am) VALUES (?, 1, '', ?, ?)`,
    vorlage,
    meilenstein,
    zeit,
  );
}

function arten(eintraege: ChronikEintrag[]): string[] {
  return eintraege.map((zeile) => (zeile.typ === 'protokoll' ? zeile.protokoll.art : zeile.typ));
}

function attributId(kennung: string): number {
  const id = eine<{ id: number }>('SELECT id FROM attribute WHERE kennung = ?', kennung)?.id;
  if (id === undefined) {
    throw new Error(`${kennung} fehlt.`);
  }
  return id;
}

function buchungVon(zeile: ChronikEintrag): InvestitionsBuchung {
  if (zeile.typ !== 'investition') {
    throw new Error('Investition fehlt.');
  }
  return zeile.buchung;
}

describe('Chronik Protokoll', () => {
  it('zeigt die sichtbaren Zeilen auch bei Meilensteinen und blendet sie bei Filtern aus', () => {
    mitWelt(welt(), () => {
      const vorlage = vorlageId();
      eintrag(vorlage, '2026-10-18', 1);
      eintrag(vorlage, '2026-10-19', 0);
      ausfuehren(
        `INSERT INTO protokoll (art, tag) VALUES ('schutz_verdient', '2026-10-20'), ('push_gesendet', '2026-10-21')`,
      );

      const offen = ladeChronik({}, undefined, 20);
      expect(arten(offen.eintraege)).toEqual(['schutz_verdient', 'eintrag', 'eintrag']);
      const protokoll = offen.eintraege[0];
      if (protokoll?.typ !== 'protokoll') {
        throw new Error('Protokoll fehlt.');
      }
      expect(protokoll.protokoll).toEqual({
        id: protokoll.protokoll.id,
        art: 'schutz_verdient',
        tag: '2026-10-20',
        erstelltAm: '2026-10-20T12:00:00.000Z',
      });

      const meilensteine = ladeChronik({ nurMeilensteine: true }, undefined, 20);
      expect(arten(meilensteine.eintraege)).toEqual(['schutz_verdient', 'eintrag']);
      const meilenstein = meilensteine.eintraege[1];
      expect(meilenstein?.typ === 'eintrag' && meilenstein.eintrag.meilenstein).toBe(true);

      const taetigkeit = ladeChronik({ vorlageId: vorlage }, undefined, 20);
      expect(arten(taetigkeit.eintraege)).toEqual(['eintrag', 'eintrag']);

      expect(arten(ladeChronik({ visionId: 1 }, undefined, 20).eintraege)).toEqual([]);
      expect(arten(ladeChronik({ visionIds: [1] }, undefined, 20).eintraege)).toEqual([]);
      expect(arten(ladeChronik({ faehigkeitId: 1 }, undefined, 20).eintraege)).toEqual([]);

      const erste = ladeChronik({}, undefined, 1);
      expect(erste.eintraege[0]?.typ).toBe('protokoll');
      expect(erste.naechsterCursor).toMatch(/_protokoll_\d+$/);
      const zweite = ladeChronik({}, erste.naechsterCursor ?? undefined, 1);
      expect(zweite.eintraege[0]?.typ).toBe('eintrag');
    });
  });

  it('zeigt Zahlung und Rückbuchung und blendet sie bei Bereich und Tätigkeit aus', () => {
    mitWelt(welt(), () => {
      const ressourcen = attributId('ressourcen');
      const koerper = attributId('koerper');
      bucheAttributXp(
        { quelle: 'eintrag', attributId: ressourcen, xp: 100, eintragId: null, vorhabenId: null },
        '2026-06-01T08:00:00.000Z',
      );
      const angelegt = erstelleInvestition({
        name: 'Lager',
        icon: 'gem',
        groesse: 1,
        attributId: koerper,
        bezahltAttributId: ressourcen,
        betrag: 40,
      });

      const offen = ladeChronik({}, undefined, 20);
      expect(arten(offen.eintraege)).toEqual(['investition']);
      const zahlung = buchungVon(offen.eintraege[0]);
      expect(zahlung.xp).toBe(-40);
      expect(zahlung.name).toBe('Lager');
      expect(zahlung.icon).toBe('gem');
      expect(zahlung.investitionId).toBe(angelegt.id);
      expect(zahlung.attributKennung).toBe('ressourcen');

      const weniger = aendereInvestition(angelegt.id, { betrag: 20 });
      const angepasst = ladeChronik({}, undefined, 20).eintraege.map(buchungVon);
      expect(angepasst.map((zeile) => zeile.xp)).toEqual([20, -40]);
      expect(angepasst.every((zeile) => zeile.name === 'Lager' && zeile.investitionId === weniger.id)).toBe(true);

      const erste = ladeChronik({}, undefined, 1);
      expect(buchungVon(erste.eintraege[0]).xp).toBe(20);
      expect(erste.naechsterCursor).toMatch(/_investition_\d+$/);
      const zweite = ladeChronik({}, erste.naechsterCursor ?? undefined, 1);
      expect(buchungVon(zweite.eintraege[0]).xp).toBe(-40);

      expect(arten(ladeChronik({ nurMeilensteine: true }, undefined, 20).eintraege)).toEqual(['investition', 'investition']);
      const vorlage = vorlageId();
      expect(arten(ladeChronik({ vorlageId: vorlage }, undefined, 20).eintraege)).toEqual([]);
      expect(arten(ladeChronik({ visionId: 1 }, undefined, 20).eintraege)).toEqual([]);
      expect(arten(ladeChronik({ faehigkeitId: 1 }, undefined, 20).eintraege)).toEqual([]);

      loescheInvestition(angelegt.id);
      const danach = ladeChronik({}, undefined, 20).eintraege.map(buchungVon);
      expect(danach.map((zeile) => zeile.xp)).toEqual([20, 20, -40]);
      expect(danach.every((zeile) => zeile.name === null && zeile.investitionId === null)).toBe(true);
      expect(danach.every((zeile) => zeile.attributKennung === 'ressourcen')).toBe(true);

      const neu = erstelleInvestition({
        name: 'Regal',
        icon: 'gem',
        groesse: 1,
        attributId: koerper,
        bezahltAttributId: ressourcen,
        betrag: 10,
      });
      const wieder = ladeChronik({}, undefined, 20).eintraege.map(buchungVon);
      expect(wieder.filter((zeile) => zeile.name === 'Regal').map((zeile) => zeile.xp)).toEqual([-10]);
      expect(wieder.filter((zeile) => zeile.investitionId === neu.id)).toHaveLength(1);
      expect(wieder.filter((zeile) => zeile.name === null)).toHaveLength(3);
    });
  });
});
