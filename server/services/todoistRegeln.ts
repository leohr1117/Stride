import { GRENZEN } from '../../shared/spiel/begriffe.ts';

/** Nachts, Stunde inklusive 23 bis exklusive 6, Ortszeit des Nutzers. */
export const NACHT_VON = 23;
export const NACHT_BIS = 6;
export const NACHT_INTERVALL_MS = 3 * 60 * 60 * 1000;

export type ZielArt = 'vision' | 'projekt' | 'vorhaben';
export type RegelAbschluss = 'geschafft' | 'gescheitert' | 'offen';

export interface TodoistDauer {
  amount: number;
  unit: 'minute' | 'day';
}

/**
 * Eine Quelle fürs Zusammenführen.
 * null heißt bei Labels „wie das Projekt“. 0 bei Dauer und Fähigkeit und „offen“ beim Stand
 * sind gesetzt und leeren den Wert. Beim Projekt ist null der Basiswert, nicht geerbt.
 */
export interface RegelQuelle {
  zielArt: ZielArt | null;
  zielId: number | null;
  projektId: number | null;
  vorlageId: number | null;
  stunden: number | null;
  faehigkeitId: number | null;
  abschluss: RegelAbschluss | null;
  erkenntnis: string;
  notiz: string;
  meilenstein: boolean | null;
}

export interface RegelErgebnis {
  zielArt: ZielArt | null;
  zielId: number | null;
  projektId: number | null;
  vorlageId: number | null;
  stunden: number | null;
  faehigkeitId: number | null;
  abschluss: 'geschafft' | 'gescheitert' | null;
  erkenntnis: string;
  notiz: string;
  meilenstein: boolean;
}

export function istNachtstunde(stunde: number): boolean {
  return stunde >= NACHT_VON || stunde < NACHT_BIS;
}

export function stundeInZone(jetzt: Date, zone: string): number | null {
  try {
    const teile = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(jetzt);
    const wert = Number(teile.find((teil) => teil.type === 'hour')?.value);
    if (!Number.isInteger(wert)) {
      return null;
    }
    return wert === 24 ? 0 : wert;
  } catch {
    return null;
  }
}

/** Tagsüber immer. Nachts nur, wenn der letzte Abgleich fehlt oder mindestens drei Stunden her ist. Ungültige Zone bremst nicht. */
export function istTodoistFaellig(jetzt: Date, zone: string | null, letzterIso: string | null): boolean {
  const stunde = zone ? stundeInZone(jetzt, zone) : null;
  if (stunde === null || !istNachtstunde(stunde)) {
    return true;
  }
  if (!letzterIso) {
    return true;
  }
  const letzter = new Date(letzterIso);
  if (Number.isNaN(letzter.getTime())) {
    return true;
  }
  return jetzt.getTime() - letzter.getTime() >= NACHT_INTERVALL_MS;
}

export function stundenAusDauer(dauer: TodoistDauer | null | undefined): number | null {
  if (!dauer || !Number.isFinite(dauer.amount) || dauer.amount <= 0) {
    return null;
  }
  const stunden = dauer.unit === 'day' ? dauer.amount * 24 : dauer.amount / 60;
  const gerundet = Math.round(stunden * 100) / 100;
  if (gerundet < GRENZEN.stundenMin) {
    return GRENZEN.stundenMin;
  }
  return Math.min(GRENZEN.stundenMax, gerundet);
}

export function notizFuerEintrag(aufgabe: string, regel: string): string {
  const teile = [aufgabe.trim(), regel.trim()].filter((teil) => teil !== '');
  return teile.join('\n').slice(0, GRENZEN.notizMax);
}

function erster<T>(regeln: RegelQuelle[], lies: (regel: RegelQuelle) => T | undefined, sonst: T): T {
  for (const regel of regeln) {
    const wert = lies(regel);
    if (wert !== undefined) {
      return wert;
    }
  }
  return sonst;
}

function basisFuerKette(basis: RegelQuelle): RegelQuelle {
  return { ...basis, meilenstein: basis.meilenstein === true };
}

/**
 * Oberste gesetzte Regel pro Feld, danach die Projekt-Basis.
 * Labels stehen vor der Basis. Gleiche Werte sind kein Konflikt.
 * Meilenstein und Stand bleiben getrennt; der Aufrufer wirft weg, was nicht zum Ziel passt.
 */
export function fuehreRegelnZusammen(labels: RegelQuelle[], basis: RegelQuelle | null): RegelErgebnis {
  const kette = basis ? [...labels, basisFuerKette(basis)] : [...labels];
  const ziel = erster(
    kette,
    (regel) => {
      if (regel.zielArt === null || regel.zielId === null) {
        return undefined;
      }
      return { zielArt: regel.zielArt, zielId: regel.zielId, projektId: regel.projektId };
    },
    null,
  );
  const abschluss = erster(
    kette,
    (regel) => {
      if (regel.abschluss === null) {
        return undefined;
      }
      return regel.abschluss === 'offen' ? null : regel.abschluss;
    },
    null,
  );
  const gesetzt = kette.find((regel) => regel.abschluss !== null);
  const erkenntnisDirekt = gesetzt?.erkenntnis.trim() ?? '';
  const erkenntnis =
    erkenntnisDirekt !== ''
      ? erkenntnisDirekt
      : erster(
          kette,
          (regel) => {
            const text = regel.erkenntnis.trim();
            return text === '' ? undefined : text;
          },
          '',
        );
  return {
    zielArt: ziel?.zielArt ?? null,
    zielId: ziel?.zielId ?? null,
    projektId: ziel?.projektId ?? null,
    vorlageId: erster(
      kette,
      (regel) => (regel.vorlageId === null ? undefined : regel.vorlageId),
      null,
    ),
    stunden: erster(
      kette,
      (regel) => {
        if (regel.stunden === null) {
          return undefined;
        }
        return regel.stunden === 0 ? null : regel.stunden;
      },
      null,
    ),
    faehigkeitId: erster(
      kette,
      (regel) => {
        if (regel.faehigkeitId === null) {
          return undefined;
        }
        return regel.faehigkeitId === 0 ? null : regel.faehigkeitId;
      },
      null,
    ),
    abschluss,
    erkenntnis,
    notiz: erster(
      kette,
      (regel) => {
        const text = regel.notiz.trim();
        return text === '' ? undefined : text;
      },
      '',
    ),
    meilenstein: erster(
      kette,
      (regel) => (regel.meilenstein === null ? undefined : regel.meilenstein),
      false,
    ),
  };
}
