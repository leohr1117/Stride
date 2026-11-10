import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { alle, eine, mitWelt, schliesseWelt } from '../../db.ts';
import { ladeAttribut, ladeAttributXp, ladeCharakterLevel } from '../attribute/attribute.ts';
import { erstelleEintrag } from '../eintraege/eintraege.ts';
import { erstelleVorlage } from '../taetigkeiten/vorlagen.ts';
import { bucheAttributXp } from '../../services/fortschritt.ts';
import { leseJetzt, lokalesDatum, setzeTestzeit } from '../../services/zeit.ts';
import { aendereInvestition, erstelleInvestition, loescheInvestition } from './ausruestung.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-zahlung-'));
const offen: string[] = [];
let nummer = 0;

function welt(): string {
  nummer += 1;
  const datei = path.join(ordner, `${nummer}.db`);
  offen.push(datei);
  return datei;
}

function kuenftigerTesttag(): string {
  return `${new Date().getFullYear() + 1}-06-15`;
}

function mitTesttag(datum: string, lauf: () => void): void {
  const vorher = process.env.STRIDE_TEST;
  process.env.STRIDE_TEST = '1';
  try {
    setzeTestzeit(datum);
    lauf();
  } finally {
    setzeTestzeit(null);
    if (vorher === undefined) {
      delete process.env.STRIDE_TEST;
    } else {
      process.env.STRIDE_TEST = vorher;
    }
  }
}

afterEach(() => {
  setzeTestzeit(null);
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

interface Buchung {
  id: number;
  attributId: number;
  investitionId: number | null;
  xp: number;
}

function buchungen(): Buchung[] {
  return alle<Buchung>(
    `SELECT id, attribut_id AS attributId, investition_id AS investitionId, xp
     FROM xp_ereignisse WHERE quelle = 'investition' ORDER BY id`,
  );
}

function gutschrift(id: number, xp: number): void {
  bucheAttributXp(
    { quelle: 'eintrag', attributId: id, xp, eintragId: null, vorhabenId: null },
    '2026-06-01T08:00:00.000Z',
  );
}

describe('Investition bezahlen', () => {
  it('zieht beim Speichern ab und senkt das Level', () => {
    mitWelt(welt(), () => {
      const ressourcen = attributId('ressourcen');
      const koerper = attributId('koerper');
      gutschrift(ressourcen, 100);
      expect(ladeAttribut(ressourcen).level.level).toBe(2);
      expect(ladeCharakterLevel().level).toBe(2);

      const angelegt = erstelleInvestition({
        name: 'Lager',
        icon: 'gem',
        groesse: 1,
        attributId: koerper,
        bezahltAttributId: ressourcen,
        betrag: 51,
      });

      expect(angelegt.bezahltAttributId).toBe(ressourcen);
      expect(angelegt.betrag).toBe(51);
      expect(ladeAttributXp(ressourcen)).toBe(49);
      expect(ladeAttribut(ressourcen).level.level).toBe(1);
      expect(ladeCharakterLevel().level).toBe(1);
      expect(buchungen()).toEqual([{ id: buchungen()[0]?.id, attributId: ressourcen, investitionId: angelegt.id, xp: -51 }]);
    });
  });

  it('bleibt ohne Angabe bei Nichts und bucht nicht', () => {
    mitWelt(welt(), () => {
      const koerper = attributId('koerper');
      const angelegt = erstelleInvestition({ name: 'Lager', icon: 'gem', groesse: 1, attributId: koerper });
      expect(angelegt.bezahltAttributId).toBeNull();
      expect(angelegt.betrag).toBe(0);
      expect(buchungen()).toEqual([]);

      const umbenannt = aendereInvestition(angelegt.id, { name: 'Regal' });
      expect(umbenannt.name).toBe('Regal');
      expect(umbenannt.betrag).toBe(0);
      expect(buchungen()).toEqual([]);

      const leer = erstelleInvestition({
        name: 'Ohne',
        icon: 'gem',
        groesse: 0,
        attributId: koerper,
        bezahltAttributId: koerper,
        betrag: 0,
      });
      expect(leer.bezahltAttributId).toBeNull();
      expect(leer.betrag).toBe(0);
      expect(() =>
        erstelleInvestition({ name: 'Offen', icon: 'gem', groesse: 1, attributId: koerper, betrag: 10 }),
      ).toThrow(/Attribut/);
      expect(buchungen()).toEqual([]);
    });
  });

  it('bucht bei Betrag und Attribut nur die Differenz und lässt alte Zeilen stehen', () => {
    mitWelt(welt(), () => {
      const ressourcen = attributId('ressourcen');
      const koerper = attributId('koerper');
      gutschrift(ressourcen, 100);
      gutschrift(koerper, 80);
      const angelegt = erstelleInvestition({
        name: 'Lager',
        icon: 'gem',
        groesse: 1,
        attributId: koerper,
        bezahltAttributId: ressourcen,
        betrag: 80,
      });
      const erste = buchungen()[0];
      expect(erste?.xp).toBe(-80);

      const weniger = aendereInvestition(angelegt.id, { betrag: 30 });
      expect(weniger.betrag).toBe(30);
      expect(weniger.bezahltAttributId).toBe(ressourcen);
      expect(buchungen()[0]).toEqual(erste);
      expect(buchungen().map((zeile) => zeile.xp)).toEqual([-80, 50]);
      expect(ladeAttributXp(ressourcen)).toBe(70);

      const wechsel = aendereInvestition(angelegt.id, { bezahltAttributId: koerper });
      expect(wechsel.bezahltAttributId).toBe(koerper);
      expect(wechsel.betrag).toBe(30);
      expect(buchungen()[0]).toEqual(erste);
      expect(buchungen().map((zeile) => zeile.xp)).toEqual([-80, 50, 30, -30]);
      expect(ladeAttributXp(ressourcen)).toBe(100);
      expect(ladeAttributXp(koerper)).toBe(50);
    });
  });

  it('archiviert ohne Rückbuchung', () => {
    mitWelt(welt(), () => {
      const ressourcen = attributId('ressourcen');
      gutschrift(ressourcen, 40);
      const angelegt = erstelleInvestition({
        name: 'Lager',
        icon: 'gem',
        groesse: 1,
        attributId: ressourcen,
        bezahltAttributId: ressourcen,
        betrag: 40,
      });
      const archiv = aendereInvestition(angelegt.id, { archiviert: true });
      expect(archiv.archiviert).toBe(true);
      expect(archiv.betrag).toBe(40);
      expect(buchungen()).toHaveLength(1);
      expect(ladeAttributXp(ressourcen)).toBe(0);

      loescheInvestition(angelegt.id);
      expect(ladeAttributXp(ressourcen)).toBe(40);
      expect(buchungen().map((zeile) => zeile.xp)).toEqual([-40, 40]);
      expect(buchungen().every((zeile) => zeile.investitionId === angelegt.id)).toBe(true);
    });
  });

  it('gibt beim Löschen das XP zurück und behält die Buchungen', () => {
    mitWelt(welt(), () => {
      const ressourcen = attributId('ressourcen');
      gutschrift(ressourcen, 100);
      const angelegt = erstelleInvestition({
        name: 'Lager',
        icon: 'gem',
        groesse: 1,
        attributId: ressourcen,
        bezahltAttributId: ressourcen,
        betrag: 30,
      });
      const erste = buchungen()[0];
      loescheInvestition(angelegt.id);
      expect(eine('SELECT id FROM investitionen WHERE id = ?', angelegt.id)).toBeUndefined();
      expect(buchungen()[0]).toEqual(erste);
      expect(buchungen()[1]).toMatchObject({ attributId: ressourcen, investitionId: angelegt.id, xp: 30 });
      expect(ladeAttributXp(ressourcen)).toBe(100);
      expect(ladeCharakterLevel().level).toBe(2);
    });
  });

  it('lehnt mehr als das verfügbare XP ab und ändert nichts', () => {
    mitWelt(welt(), () => {
      const ressourcen = attributId('ressourcen');
      const koerper = attributId('koerper');
      gutschrift(ressourcen, 40);
      expect(() =>
        erstelleInvestition({
          name: 'Lager',
          icon: 'gem',
          groesse: 1,
          attributId: koerper,
          bezahltAttributId: ressourcen,
          betrag: 41,
        }),
      ).toThrow(/XP/);
      expect(eine('SELECT id FROM investitionen')).toBeUndefined();
      expect(buchungen()).toEqual([]);
      expect(ladeAttributXp(ressourcen)).toBe(40);

      const angelegt = erstelleInvestition({
        name: 'Lager',
        icon: 'gem',
        groesse: 1,
        attributId: koerper,
        bezahltAttributId: ressourcen,
        betrag: 40,
      });
      expect(ladeAttributXp(ressourcen)).toBe(0);
      expect(() => aendereInvestition(angelegt.id, { betrag: 50 })).toThrow(/XP/);
      expect(aendereInvestition(angelegt.id, { name: 'Bleibt' }).betrag).toBe(40);
      expect(buchungen().map((zeile) => zeile.xp)).toEqual([-40]);
      expect(ladeAttributXp(ressourcen)).toBe(0);
    });
  });

  it('bucht beim blockierten Löschen nichts zurück', () => {
    mitWelt(welt(), () => {
      const ressourcen = attributId('ressourcen');
      const koerper = attributId('koerper');
      gutschrift(ressourcen, 80);
      const angelegt = erstelleInvestition({
        name: 'Lager',
        icon: 'gem',
        groesse: 1,
        attributId: koerper,
        bezahltAttributId: ressourcen,
        betrag: 20,
      });
      const vorlageId = erstelleVorlage({ name: 'Heben', icon: 'star', gewichte: [{ attributId: koerper, gewicht: 1 }] }).id;
      erstelleEintrag({
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
      });
      expect(() => loescheInvestition(angelegt.id)).toThrow(/genutzt/);
      expect(eine<{ id: number }>('SELECT id FROM investitionen WHERE id = ?', angelegt.id)?.id).toBe(angelegt.id);
      expect(buchungen().map((zeile) => zeile.xp)).toEqual([-20]);
      expect(ladeAttributXp(ressourcen)).toBe(60);
    });
  });

  it('bucht die Zahlung auf den Testtag und ohne Testtag auf die echte Uhr', () => {
    const datum = kuenftigerTesttag();
    mitTesttag(datum, () => {
      mitWelt(welt(), () => {
        const ressourcen = attributId('ressourcen');
        gutschrift(ressourcen, 100);
        erstelleInvestition({
          name: 'Lager',
          icon: 'gem',
          groesse: 1,
          attributId: attributId('koerper'),
          bezahltAttributId: ressourcen,
          betrag: 10,
        });
        const zeit = eine<{ erstelltAm: string }>(
          `SELECT erstellt_am AS erstelltAm FROM xp_ereignisse WHERE quelle = 'investition'`,
        )?.erstelltAm;
        expect(zeit).toBe(leseJetzt().toISOString());
        expect(lokalesDatum(new Date(zeit ?? ''))).toBe(datum);
      });
    });

    mitWelt(welt(), () => {
      const ressourcen = attributId('ressourcen');
      gutschrift(ressourcen, 100);
      const vor = Date.now();
      erstelleInvestition({
        name: 'Lager',
        icon: 'gem',
        groesse: 1,
        attributId: attributId('koerper'),
        bezahltAttributId: ressourcen,
        betrag: 10,
      });
      const nach = Date.now();
      const zeit = eine<{ erstelltAm: string }>(
        `SELECT erstellt_am AS erstelltAm FROM xp_ereignisse WHERE quelle = 'investition'`,
      )?.erstelltAm;
      const millis = Date.parse(zeit ?? '');
      expect(millis).toBeGreaterThanOrEqual(vor);
      expect(millis).toBeLessThanOrEqual(nach);
    });
  });
});
