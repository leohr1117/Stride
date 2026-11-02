import { type Abschluss, GRENZEN } from '../../../shared/spiel/begriffe.ts';
import { ausfuehren, eine } from '../../db.ts';
import { AppFehler, ungueltig } from '../../fehler.ts';
import { erstelleEintrag, type EintragSonder } from '../eintraege/eintraege.ts';
import { KONTEXT_JOINS, PROJEKT_AKTIV } from '../ziele/kontext.ts';
import { pruefeAktiveVorlage, pruefeVorlageZumProjekt } from '../taetigkeiten/vorlagen.ts';

export function leseWert(schluessel: string): string | null {
  const zeile = eine<{ wert: string }>('SELECT wert FROM einstellungen WHERE schluessel = ?', schluessel);
  if (!zeile) {
    return null;
  }
  try {
    const wert: unknown = JSON.parse(zeile.wert);
    return typeof wert === 'string' ? wert : null;
  } catch {
    return null;
  }
}

export function setzeWert(schluessel: string, wert: string | null): void {
  if (wert === null) {
    ausfuehren('DELETE FROM einstellungen WHERE schluessel = ?', schluessel);
    return;
  }
  ausfuehren(
    `INSERT INTO einstellungen (schluessel, wert) VALUES (?, ?)
     ON CONFLICT (schluessel) DO UPDATE SET wert = excluded.wert`,
    schluessel,
    JSON.stringify(wert),
  );
}

const FEHLER_SICHTBAR = 3;

export function fehlertext(fehler: unknown, bereich: string): string {
  if (fehler instanceof AppFehler) {
    return fehler.message;
  }
  if (bereich === 'Todoist') {
    return 'Unerwarteter Fehler beim Abgleich mit Todoist.';
  }
  return 'Unerwarteter Fehler beim Abgleich mit dem Kalender.';
}

export function fasseFehler(fehler: readonly string[]): string | null {
  const einzig: string[] = [];
  for (const eintrag of fehler) {
    if (einzig.includes(eintrag)) {
      continue;
    }
    einzig.push(eintrag);
    if (einzig.length === FEHLER_SICHTBAR) {
      break;
    }
  }
  return einzig.length > 0 ? einzig.join('\n') : null;
}

export function pruefeProjekt(projektId: number): number {
  const projekt = eine<{ standardVorlageId: number }>(
    `SELECT p.standard_vorlage_id AS standardVorlageId FROM projekte p ${KONTEXT_JOINS}
     WHERE p.id = ? AND ${PROJEKT_AKTIV}`,
    projektId,
  );
  if (!projekt) {
    throw ungueltig('Das zugeordnete Projekt ist archiviert oder existiert nicht.');
  }
  return projekt.standardVorlageId;
}

export function legeEintragAn(
  ziel: { projektId: number | null; vorlageId: number | null },
  stunden: number | null,
  notiz: string,
  zeitpunkt: Date,
  jetzt: Date,
  extra?: {
    vorhabenId: number | null;
    faehigkeitId: number | null;
    abschluss: Abschluss | null;
    erkenntnis: string;
    meilenstein: boolean;
  },
  sonder?: EintragSonder,
): number {
  let vorlageId = ziel.vorlageId;
  if (ziel.projektId !== null) {
    const standard = pruefeProjekt(ziel.projektId);
    vorlageId = vorlageId ?? standard;
  } else if (vorlageId === null) {
    throw ungueltig('Wähle eine Tätigkeit.');
  }
  const ergebnis = erstelleEintrag(
    {
      projektId: ziel.projektId,
      vorlageId,
      vorhaben: extra?.vorhabenId ? { art: 'bestehend', id: extra.vorhabenId } : null,
      abschluss: extra?.abschluss ?? null,
      erkenntnis: extra?.erkenntnis ?? '',
      stunden,
      notiz: notiz.slice(0, GRENZEN.notizMax),
      meilenstein: extra?.meilenstein ?? false,
      faehigkeitId: extra?.faehigkeitId ?? null,
      datum: null,
    },
    zeitpunkt > jetzt ? jetzt : zeitpunkt,
    sonder ?? {},
  );
  return ergebnis.eintrag.id;
}

export function pruefeZiel(projektId: number | null, vorlageId: number | null): void {
  if (projektId === null && vorlageId === null) {
    throw ungueltig('Wähle eine Tätigkeit.');
  }
  if (projektId !== null) {
    pruefeProjekt(projektId);
  }
  if (vorlageId !== null) {
    pruefeAktiveVorlage(vorlageId);
    pruefeVorlageZumProjekt(vorlageId, projektId);
  }
}
