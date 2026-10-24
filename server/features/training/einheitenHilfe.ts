import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { PlanEintragDaten, Trainingseinheit } from '../../../shared/api/training.ts';
import { ausfuehren, eine, schliesseWelt } from '../../db.ts';
import { aendereEinstellungen } from '../einstellungen/einstellungen.ts';
import { erstelleVorlage } from '../taetigkeiten/vorlagen.ts';
import { erstelleTrainingsplan } from './plaene.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-einheiten-'));
const offen: string[] = [];
let nummer = 0;

export const START = new Date('2026-10-23T10:00:00.000Z');
export const DANACH = new Date(START.getTime() + 45 * 60 * 1000);

export function welt(): string {
  nummer += 1;
  const datei = path.join(ordner, `${nummer}.db`);
  offen.push(datei);
  return datei;
}

export function raeumeAuf(): void {
  for (const datei of offen) {
    schliesseWelt(datei);
  }
  offen.length = 0;
}

export function anzahl(tabelle: string): number {
  return eine<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tabelle}`)?.n ?? 0;
}

export function an(): void {
  aendereEinstellungen({ funktionen: { training: true }, zeitzone: 'UTC' });
}

export function attributId(kennung: string): number {
  const id = eine<{ id: number }>('SELECT id FROM attribute WHERE kennung = ?', kennung)?.id;
  if (id === undefined) {
    throw new Error(`${kennung} fehlt.`);
  }
  return id;
}

export function vorlage(name: string, gewichte?: { attributId: number; gewicht: number }[]): number {
  return erstelleVorlage({
    name,
    icon: 'dumbbell',
    gewichte: gewichte ?? [{ attributId: attributId('koerper'), gewicht: 1 }],
  }).id;
}

export function kraft(name: string, extra: Partial<PlanEintragDaten> = {}): PlanEintragDaten {
  return {
    name,
    art: 'kraft',
    zielSaetze: 3,
    zielWiederholungen: 5,
    zielGewichtG: 80000,
    zielSekunden: null,
    aufwaermSaetze: null,
    aufwaermWiederholungen: null,
    aufwaermGewichtG: null,
    aufwaermSekunden: null,
    ...extra,
  };
}

export function dauer(name: string, sekunden: number): PlanEintragDaten {
  return {
    name,
    art: 'dauer',
    zielSaetze: 1,
    zielWiederholungen: null,
    zielGewichtG: null,
    zielSekunden: sekunden,
    aufwaermSaetze: null,
    aufwaermWiederholungen: null,
    aufwaermGewichtG: null,
    aufwaermSekunden: null,
  };
}

export function plan(
  name: string,
  uebungen: PlanEintragDaten[],
  vorlageId: number | null,
  projektId: number | null = null,
  wochentage = [5],
) {
  return erstelleTrainingsplan({ name, wochentage, projektId, vorlageId, uebungen });
}

export function saetze(einheit: Trainingseinheit) {
  return einheit.uebungen.flatMap((gruppe) => gruppe.saetze);
}

export function xp(eintragId: number, kennung: string): number {
  return (
    eine<{ xp: number }>(
      `SELECT COALESCE(SUM(x.xp), 0) AS xp FROM xp_ereignisse x
       JOIN attribute a ON a.id = x.attribut_id
       WHERE x.eintrag_id = ? AND a.kennung = ?`,
      eintragId,
      kennung,
    )?.xp ?? 0
  );
}

export function quellen(eintragId: number, quelle: string): number {
  return (
    eine<{ n: number }>(
      'SELECT COUNT(*) AS n FROM xp_ereignisse WHERE eintrag_id = ? AND quelle = ?',
      eintragId,
      quelle,
    )?.n ?? 0
  );
}

export function faktorEins(eintragId: number): void {
  ausfuehren('UPDATE eintraege SET faktor = 1 WHERE id = ?', eintragId);
}
