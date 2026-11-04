import { localeFuer, type Sprache } from '../../../shared/sprache/kern.ts';
import { zeige } from '../../../shared/sprache/index.ts';
import { zeigeMenge } from '../../../shared/sprache/menge.ts';
import { datumInZone } from '../../../shared/spiel/datum.ts';
import type { HinweisAnlass } from '../../../shared/spiel/hinweis.ts';
import { alle, ausfuehren, eine, inTransaktion } from '../../db.ts';
import { ladeEinstellungen } from '../einstellungen/einstellungen.ts';
import { sammleHinweise, type HinweisSammlung } from './sammler.ts';

const TAG = /^(\d{4})-(\d{2})-(\d{2})$/;
const NICHT_EINGERICHTET = 'Benachrichtigungen sind auf diesem Server nicht eingerichtet.';

export interface PushZiel {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushNutzlast {
  title: string;
  body: string;
  data: { ziel: '/' };
}

export type PushAusgang = 'ok' | 'ungueltig' | 'fehler' | 'nicht-eingerichtet';

export interface PushErgebnis {
  status: PushAusgang;
  httpStatus: number | null;
}

export type PushSenden = (abo: PushZiel, nutzlast: PushNutzlast) => Promise<PushErgebnis>;

export type HinweisLog = (zeile: string) => void;

let schonGewarnt = false;

export function httpStatusVon(fehler: unknown): number | null {
  if (typeof fehler !== 'object' || fehler === null || !('statusCode' in fehler)) {
    return null;
  }
  const wert = fehler.statusCode;
  return typeof wert === 'number' && Number.isInteger(wert) ? wert : null;
}

/** Übernimmt nur Statuscode und Klasse. Endpunkt, Text und Schlüssel bleiben draußen. */
export function ergebnisFuerFehler(fehler: unknown): PushErgebnis {
  const httpStatus = httpStatusVon(fehler);
  const status = httpStatus === 404 || httpStatus === 410 ? 'ungueltig' : 'fehler';
  return { status, httpStatus };
}

function tabelleDa(name: string): boolean {
  return eine<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, name) !== undefined;
}

function gueltigeAbos(): PushZiel[] {
  if (!tabelleDa('push_abos')) {
    return [];
  }
  return alle<PushZiel>(
    `SELECT id, endpoint, p256dh, auth FROM push_abos WHERE ungueltig_am IS NULL ORDER BY id`,
  );
}

function markiereUngueltig(id: number, jetzt: Date): void {
  ausfuehren(
    `UPDATE push_abos SET ungueltig_am = ? WHERE id = ? AND ungueltig_am IS NULL`,
    jetzt.toISOString(),
    id,
  );
}

function kurzesDatum(tag: string, sprache: Sprache): string {
  const teile = TAG.exec(tag);
  if (!teile) {
    return tag;
  }
  const datum = new Date(Date.UTC(Number(teile[1]), Number(teile[2]) - 1, Number(teile[3])));
  return new Intl.DateTimeFormat(localeFuer(sprache), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(datum);
}

function textFuer(anlass: HinweisAnlass, sprache: Sprache): string {
  if (anlass.art === 'streak') {
    const laenge = Number(anlass.name);
    return zeigeMenge(sprache, Number.isFinite(laenge) ? laenge : 0, '{laenge} Tage sind angeschlagen. Ein Eintrag heute hält sie.', {
      laenge: anlass.name,
    });
  }
  if (anlass.art === 'rueckkehr') {
    return zeige('Die Rückkehr ist offen bis {datum}.', sprache, { datum: kurzesDatum(anlass.name, sprache) });
  }
  return zeige('Morgen ist das Datum: {name}.', sprache, { name: anlass.name });
}

function nutzlast(anlass: HinweisAnlass, sprache: Sprache): PushNutzlast {
  return { title: 'Stride', body: textFuer(anlass, sprache), data: { ziel: anlass.ziel } };
}

function meldung(httpStatus: number | null, aboId: number): string {
  const status = httpStatus === null ? 'ohne' : String(httpStatus);
  return `Push fehlgeschlagen. Status ${status}. Abo ${aboId}.`;
}

function protokollZeile(art: 'push_gesendet' | 'push_ausgelassen', anlass: HinweisAnlass, tag: string): void {
  ausfuehren(
    `INSERT INTO protokoll (art, bezug_typ, bezug_id, tag) VALUES (?, ?, ?, ?)`,
    art,
    anlass.art,
    anlass.bezugId,
    tag,
  );
}

function schreibeProtokoll(sammlung: HinweisSammlung, tag: string): void {
  const gewinner = sammlung.gewinner;
  if (gewinner === null) {
    return;
  }
  inTransaktion(() => {
    protokollZeile('push_gesendet', gewinner, tag);
    for (const anlass of sammlung.daneben) {
      protokollZeile('push_ausgelassen', anlass, tag);
    }
  });
}

/**
 * Schickt den Gewinner an jedes gültige Gerät.
 * Protokoll erst nach einem Erfolg. Sonst bleibt der Hinweis ein Kandidat.
 * 410 und 404 setzen ungueltig_am nur an der betroffenen Zeile.
 */
export async function sendeHinweise(
  senden: PushSenden,
  jetzt = new Date(),
  log: HinweisLog = console.warn,
): Promise<number> {
  const einstellungen = ladeEinstellungen();
  const tag = datumInZone(jetzt, einstellungen.zeitzone);
  const sprache = einstellungen.sprache ?? 'de';
  const sammlung = sammleHinweise(jetzt);
  if (sammlung.gewinner === null) {
    return 0;
  }
  const abos = gueltigeAbos();
  if (abos.length === 0) {
    return 0;
  }
  const inhalt = nutzlast(sammlung.gewinner, sprache);
  let gelungen = 0;
  for (const abo of abos) {
    let ergebnis: PushErgebnis;
    try {
      ergebnis = await senden(abo, inhalt);
    } catch {
      log(meldung(null, abo.id));
      continue;
    }
    if (ergebnis.status === 'ok') {
      gelungen += 1;
      continue;
    }
    if (ergebnis.status === 'nicht-eingerichtet') {
      if (gelungen === 0) {
        return 0;
      }
      continue;
    }
    log(meldung(ergebnis.httpStatus, abo.id));
    if (ergebnis.status === 'ungueltig') {
      markiereUngueltig(abo.id, jetzt);
    }
  }
  if (gelungen === 0) {
    return 0;
  }
  schreibeProtokoll(sammlung, tag);
  return gelungen;
}

/** Ohne Einrichtung kein Versand und keine Zeile. Die Warnung nennt keinen Schlüssel. */
export async function sendeHinweiseWennBereit(
  bereit: boolean,
  senden: PushSenden,
  jetzt = new Date(),
  log: HinweisLog = console.warn,
): Promise<number> {
  if (!bereit) {
    if (!schonGewarnt) {
      schonGewarnt = true;
      log(NICHT_EINGERICHTET);
    }
    return 0;
  }
  return sendeHinweise(senden, jetzt, log);
}
