import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { FokusId, Zielstrebigkeit } from '../../../shared/spiel/profil.ts';
import { zeige } from '../../../shared/sprache/index.ts';
import { einstellungenAenderungSchema } from '../../validierung.ts';
import { alle, eine, mitWelt, schliesseWelt } from '../../db.ts';
import { datumPlus, lokalesDatum } from '../../services/zeit.ts';
import { aendereEinstellungen, ladeEinstellungen } from './einstellungen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-onboarding-'));
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

function roh(schluessel: string): unknown {
  const zeile = eine<{ wert: string }>('SELECT wert FROM einstellungen WHERE schluessel = ?', schluessel);
  return zeile ? (JSON.parse(zeile.wert) as unknown) : undefined;
}

function projekte(): { name: string; vorlage: string }[] {
  return alle<{ name: string; vorlage: string }>(
    `SELECT p.name AS name, v.name AS vorlage
     FROM projekte p
     JOIN vorlagen v ON v.id = p.standard_vorlage_id
     ORDER BY p.id`,
  );
}

function bosse(): { titel: string; deadline: string | null; boss: number }[] {
  return alle<{ titel: string; deadline: string | null; boss: number }>(
    'SELECT titel, deadline, boss FROM vorhaben ORDER BY id',
  );
}

const anlage: {
  charakterName: string;
  geburtsjahr: number;
  zielstrebigkeit: Zielstrebigkeit;
  fokus: FokusId[];
  profilAngelegt: boolean;
} = {
  charakterName: 'Leo',
  geburtsjahr: 1991,
  zielstrebigkeit: 'traeumer',
  fokus: ['sport'],
  profilAngelegt: true,
};

describe('onboarding speichern', () => {
  it('nimmt das Schema für null und false an und lehnt eine Zahl ab', () => {
    expect(einstellungenAenderungSchema.safeParse({ startVorbild: null, startBoss: false }).success).toBe(true);
    expect(einstellungenAenderungSchema.safeParse({ startVorbild: 'kipchoge', startBoss: true }).success).toBe(true);
    expect(einstellungenAenderungSchema.safeParse({ startVorbild: 1 }).success).toBe(false);
  });

  it('legt bei Annahme ein Projekt und einen Boss an und lässt Angriffe aus', () => {
    const datei = welt();
    mitWelt(datei, () => {
      const neu = aendereEinstellungen({ ...anlage, startVorbild: 'kipchoge', startBoss: true });
      expect(neu.funktionen.vorbilder).toBe(true);
      expect(neu.funktionen.bossAngriffe).toBe(false);
      expect(roh('start_vorbild')).toBe('kipchoge');
      expect(projekte()).toEqual([{ name: 'Anfang', vorlage: 'Training' }]);
      const frist = datumPlus(lokalesDatum(new Date()), 7);
      expect(bosse()).toEqual([{ titel: 'Lauf beginnen', deadline: frist, boss: 1 }]);
      expect(roh('start_boss_id')).toBe(eine<{ id: number }>('SELECT id FROM vorhaben')?.id);
    });
  });

  it('legt beim zweiten PATCH nichts Zweites an und ersetzt das Vorbild nicht', () => {
    const datei = welt();
    mitWelt(datei, () => {
      aendereEinstellungen({ ...anlage, startVorbild: 'kipchoge', startBoss: true });
      aendereEinstellungen({ startVorbild: 'ronaldo', startBoss: true });
      expect(projekte()).toHaveLength(1);
      expect(bosse()).toHaveLength(1);
      expect(roh('start_vorbild')).toBe('kipchoge');
    });
  });

  it('merkt Überspringen ohne Projekt und ohne Vorbild', () => {
    const datei = welt();
    mitWelt(datei, () => {
      const neu = aendereEinstellungen({ ...anlage, startVorbild: null, startBoss: false });
      expect(neu.funktionen.vorbilder).toBe(false);
      expect(roh('start_vorbild')).toBeUndefined();
      expect(roh('start_boss_id')).toBe(0);
      expect(projekte()).toEqual([]);
      expect(bosse()).toEqual([]);
    });
  });

  it('rollt ein unbekanntes oder den Durchschnitt zurück', () => {
    const datei = welt();
    mitWelt(datei, () => {
      expect(() => aendereEinstellungen({ ...anlage, startVorbild: 'gibt-es-nicht', startBoss: true })).toThrow(
        /Das Vorbild ist unbekannt/,
      );
      expect(() => aendereEinstellungen({ ...anlage, startVorbild: 'durchschnitt', startBoss: true })).toThrow(
        /Das Vorbild ist unbekannt/,
      );
      expect(() => aendereEinstellungen({ ...anlage, startVorbild: '', startBoss: true })).toThrow(/Das Vorbild ist unbekannt/);
      expect(ladeEinstellungen().profilAngelegt).toBe(false);
      expect(projekte()).toEqual([]);
    });
  });

  it('ignoriert den Boss, wenn die Stufe keine Projekte hat', () => {
    const datei = welt();
    mitWelt(datei, () => {
      const neu = aendereEinstellungen({
        ...anlage,
        zielstrebigkeit: 'uebung',
        startVorbild: 'kipchoge',
        startBoss: true,
      });
      expect(neu.funktionen.vorbilder).toBe(true);
      expect(neu.funktionen.bossAngriffe).toBe(false);
      expect(roh('start_vorbild')).toBe('kipchoge');
      expect(roh('start_boss_id')).toBeUndefined();
      expect(projekte()).toEqual([]);
      expect(bosse()).toEqual([]);
    });
  });

  it('nimmt den ersten Fokus für Boss und Tätigkeit', () => {
    const datei = welt();
    mitWelt(datei, () => {
      aendereEinstellungen({
        ...anlage,
        fokus: ['lernen', 'sport'],
        startVorbild: 'su',
        startBoss: true,
      });
      expect(projekte()).toEqual([{ name: 'Anfang', vorlage: 'Lernen' }]);
      expect(bosse()[0]?.titel).toBe('Lernen anfangen');
    });
  });

  it('speichert Projekt und Boss in der Profilsprache', () => {
    const datei = welt();
    mitWelt(datei, () => {
      aendereEinstellungen({
        ...anlage,
        sprache: 'fr',
        startVorbild: 'kipchoge',
        startBoss: true,
      });
      expect(projekte()).toEqual([{ name: zeige('Anfang', 'fr'), vorlage: zeige('Training', 'fr') }]);
      expect(bosse()[0]?.titel).toBe(zeige('Lauf beginnen', 'fr'));
    });
  });
});
