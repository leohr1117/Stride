import type { AbgleichErgebnis, Kalender, KalenderAenderung, KalenderDaten } from '../../../shared/api/index.ts';
import { GRENZEN } from '../../../shared/spiel/begriffe.ts';
import { aktualisiere, alle, ausfuehren, eine } from '../../db.ts';
import { nichtGefunden, ungueltig } from '../../fehler.ts';
import { liesEreignisse, termineZwischen, type Termin } from '../../integrationen/ical.ts';
import { tagesbeginn } from '../../services/zeit.ts';
import { fehlertext, legeEintragAn, pruefeZiel } from './gemeinsam.ts';

const ZEITLIMIT_MS = 15_000;
const KALENDER_MAX_BYTES = 5 * 1024 * 1024;
const MS_PRO_STUNDE = 60 * 60 * 1000;
const STUNDEN_RUNDUNG = 100;
const KALENDER_KENNUNG = 'BEGIN:VCALENDAR';
const ERLAUBTE_PROTOKOLLE = ['http:', 'https:'];

interface KalenderZeile {
  id: number;
  name: string;
  adresse: string;
  projektId: number;
  vorlageId: number | null;
  filter: string;
  seit: string;
  letzterAbgleich: string | null;
  fehler: string | null;
  uebernommen: number;
}

const KALENDER_ABFRAGE = `
  SELECT k.id, k.name, k.adresse, k.projekt_id AS projektId, k.vorlage_id AS vorlageId, k.filter, k.seit,
         k.letzter_abgleich AS letzterAbgleich, k.fehler,
         (SELECT COUNT(*) FROM kalender_termine t WHERE t.kalender_id = k.id AND t.eintrag_id IS NOT NULL) AS uebernommen
  FROM kalender k
`;

function zuKalender({ adresse: _adresse, ...zeile }: KalenderZeile): Kalender {
  return zeile;
}

export function ladeKalenderListe(): Kalender[] {
  return alle<KalenderZeile>(`${KALENDER_ABFRAGE} ORDER BY k.name`).map(zuKalender);
}

function ladeKalenderZeile(id: number): KalenderZeile {
  const zeile = eine<KalenderZeile>(`${KALENDER_ABFRAGE} WHERE k.id = ?`, id);
  if (!zeile) {
    throw nichtGefunden('Der Kalender');
  }
  return zeile;
}

function normalisiereAdresse(eingabe: string): string {
  const roh = eingabe.trim().replace(/^webcals?:\/\//i, 'https://');
  let adresse: URL;
  try {
    adresse = new URL(roh);
  } catch {
    throw ungueltig('Die Kalender-Adresse ist keine gültige Internetadresse.');
  }
  if (!ERLAUBTE_PROTOKOLLE.includes(adresse.protocol)) {
    throw ungueltig('Die Kalender-Adresse muss mit https:// oder webcal:// beginnen.');
  }
  return adresse.toString();
}

async function ladeKalenderText(adresse: string): Promise<string> {
  let antwort: Response;
  try {
    antwort = await fetch(adresse, { signal: AbortSignal.timeout(ZEITLIMIT_MS) });
  } catch (fehler) {
    throw ungueltig(`Der Kalender ist nicht erreichbar (${(fehler as Error).message}).`);
  }
  if (!antwort.ok) {
    throw ungueltig(`Der Kalender hat mit Fehler ${antwort.status} geantwortet.`);
  }
  const text = await antwort.text();
  if (text.length > KALENDER_MAX_BYTES) {
    throw ungueltig('Der Kalender ist zu groß.');
  }
  if (!text.includes(KALENDER_KENNUNG)) {
    throw ungueltig('Unter dieser Adresse liegt kein Kalender im iCal-Format.');
  }
  return text;
}

export async function erstelleKalender(daten: KalenderDaten, jetzt = new Date()): Promise<Kalender> {
  const adresse = normalisiereAdresse(daten.adresse);
  pruefeZiel(daten.projektId, daten.vorlageId);
  liesEreignisse(await ladeKalenderText(adresse));
  const { id } = ausfuehren(
    `INSERT INTO kalender (name, adresse, projekt_id, vorlage_id, filter, seit) VALUES (?, ?, ?, ?, ?, ?)`,
    daten.name,
    adresse,
    daten.projektId,
    daten.vorlageId,
    daten.filter,
    tagesbeginn(jetzt).toISOString(),
  );
  return zuKalender(ladeKalenderZeile(id));
}

export function aendereKalender(id: number, aenderung: KalenderAenderung): Kalender {
  const bisher = ladeKalenderZeile(id);
  if (aenderung.projektId !== undefined || aenderung.vorlageId !== undefined) {
    const projektId = aenderung.projektId !== undefined ? aenderung.projektId : bisher.projektId;
    const vorlageId = aenderung.vorlageId !== undefined ? aenderung.vorlageId : bisher.vorlageId;
    pruefeZiel(projektId, vorlageId);
  }
  aktualisiere('kalender', id, {
    name: aenderung.name,
    projekt_id: aenderung.projektId,
    vorlage_id: aenderung.vorlageId,
    filter: aenderung.filter,
  });
  return zuKalender(ladeKalenderZeile(id));
}

export function loescheKalender(id: number): void {
  ladeKalenderZeile(id);
  ausfuehren('DELETE FROM kalender WHERE id = ?', id);
}

function passtZumFilter(termin: Termin, filter: string): boolean {
  const woerter = filter
    .split(',')
    .map((wort) => wort.trim().toLowerCase())
    .filter((wort) => wort !== '');
  if (woerter.length === 0) {
    return true;
  }
  const titel = termin.titel.toLowerCase();
  return woerter.some((wort) => titel.includes(wort));
}

function stundenVon(termin: Termin): number | null {
  const stunden = Math.round(((termin.ende.getTime() - termin.beginn.getTime()) / MS_PRO_STUNDE) * STUNDEN_RUNDUNG) / STUNDEN_RUNDUNG;
  if (stunden < GRENZEN.stundenMin) {
    return null;
  }
  return Math.min(GRENZEN.stundenMax, stunden);
}

async function gleicheEinenKalenderAb(kalender: KalenderZeile, jetzt: Date): Promise<AbgleichErgebnis> {
  try {
    const text = await ladeKalenderText(kalender.adresse);
    const termine = termineZwischen(text, new Date(kalender.seit), jetzt).filter(
      (termin) => !termin.ganztags && passtZumFilter(termin, kalender.filter),
    );
    const fehler = new Set<string>();
    const bekannt = new Set(
      alle<{ terminId: string }>('SELECT termin_id AS terminId FROM kalender_termine WHERE kalender_id = ?', kalender.id).map(
        (zeile) => zeile.terminId,
      ),
    );
    let neu = 0;
    for (const termin of termine) {
      if (bekannt.has(termin.id)) {
        continue;
      }
      try {
        const eintragId = legeEintragAn(
          { projektId: kalender.projektId, vorlageId: kalender.vorlageId },
          stundenVon(termin),
          termin.titel,
          termin.ende,
          jetzt,
        );
        ausfuehren(
          'INSERT INTO kalender_termine (kalender_id, termin_id, eintrag_id) VALUES (?, ?, ?)',
          kalender.id,
          termin.id,
          eintragId,
        );
        bekannt.add(termin.id);
        neu++;
      } catch (ausnahme) {
        fehler.add(`${kalender.name}: ${fehlertext(ausnahme, 'dem Kalender')}`);
      }
    }
    aktualisiere('kalender', kalender.id, { letzter_abgleich: jetzt.toISOString(), fehler: [...fehler][0] ?? null });
    return { neu, fehler: [...fehler] };
  } catch (ausnahme) {
    const nachricht = `${kalender.name}: ${fehlertext(ausnahme, 'dem Kalender')}`;
    aktualisiere('kalender', kalender.id, { fehler: nachricht });
    return { neu: 0, fehler: [nachricht] };
  }
}

export async function gleicheKalenderAb(jetzt = new Date()): Promise<AbgleichErgebnis> {
  const ergebnis: AbgleichErgebnis = { neu: 0, fehler: [] };
  for (const kalender of alle<KalenderZeile>(KALENDER_ABFRAGE)) {
    const teil = await gleicheEinenKalenderAb(kalender, jetzt);
    ergebnis.neu += teil.neu;
    ergebnis.fehler.push(...teil.fehler);
  }
  return ergebnis;
}
