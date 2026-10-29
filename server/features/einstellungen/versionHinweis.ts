import { ausfuehren, eine } from '../../db.ts';
import { istVersionsnummer } from '../../../shared/spiel/updateHinweis.ts';

const BENACHRICHTIGT = 'version_benachrichtigt';
const GESEHEN = 'version_gesehen';

export interface Versionsstand {
  benachrichtigt: string | null;
  gesehen: string | null;
}

function lese(schluessel: string): string | null {
  const roh = eine<{ wert: string }>('SELECT wert FROM einstellungen WHERE schluessel = ?', schluessel)?.wert;
  if (roh === undefined) {
    return null;
  }
  try {
    const wert: unknown = JSON.parse(roh);
    return typeof wert === 'string' && istVersionsnummer(wert) ? wert : null;
  } catch {
    return null;
  }
}

function speichere(schluessel: string, wert: string): void {
  ausfuehren(
    `INSERT INTO einstellungen (schluessel, wert) VALUES (?, ?)
     ON CONFLICT (schluessel) DO UPDATE SET wert = excluded.wert`,
    schluessel,
    JSON.stringify(wert),
  );
}

export function leseVersionsstand(): Versionsstand {
  return { benachrichtigt: lese(BENACHRICHTIGT), gesehen: lese(GESEHEN) };
}

export function merkeVersionsstand(teil: { benachrichtigt?: string; gesehen?: string }): void {
  if (teil.benachrichtigt !== undefined) {
    speichere(BENACHRICHTIGT, teil.benachrichtigt);
  }
  if (teil.gesehen !== undefined) {
    speichere(GESEHEN, teil.gesehen);
  }
}

/** Setzt nur fehlende Werte. Ein schon gemerkter Stand bleibt. */
export function setzeVersionsstandWennLeer(version: string): void {
  const stand = leseVersionsstand();
  merkeVersionsstand({
    ...(stand.benachrichtigt === null ? { benachrichtigt: version } : {}),
    ...(stand.gesehen === null ? { gesehen: version } : {}),
  });
}

export function setzeVersionsstand(version: string): void {
  merkeVersionsstand({ benachrichtigt: version, gesehen: version });
}
