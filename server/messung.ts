import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { DatabaseSync, StatementSync } from 'node:sqlite';

export const EREIGNIS_SCHWELLE_MS = 100;
export const DATENBANK_SCHWELLE_MS = 100;
export const EREIGNIS_TAKT_MS = 10_000;

const NS_JE_MS = 1_000_000;
const AUFLOESUNG_MS = 20;
const APOSTROPH = 39;
const TEXT_PLATZHALTER = '?';

type Log = (text: string) => void;
type AnweisungAufruf = (this: StatementSync, ...args: unknown[]) => unknown;

export interface MessungOptionen {
  ereignisSchwelleMs?: number;
  datenbankSchwelleMs?: number;
  taktMs?: number;
  liesVerzoegerungNs?: () => number;
}

export function sqlOhneDaten(sql: string): string {
  const teile: string[] = [];
  let start = 0;
  let i = 0;
  while (i < sql.length) {
    if (sql.charCodeAt(i) !== APOSTROPH) {
      i += 1;
      continue;
    }
    teile.push(sql.slice(start, i), TEXT_PLATZHALTER);
    i += 1;
    while (i < sql.length) {
      if (sql.charCodeAt(i) !== APOSTROPH) {
        i += 1;
        continue;
      }
      if (sql.charCodeAt(i + 1) === APOSTROPH) {
        i += 2;
        continue;
      }
      i += 1;
      break;
    }
    start = i;
  }
  teile.push(sql.slice(start));
  return teile.join('');
}

export function ereignisMeldung(maxNs: number, schwelleMs = EREIGNIS_SCHWELLE_MS): string | null {
  if (!Number.isFinite(maxNs) || maxNs <= 0) {
    return null;
  }
  const ms = maxNs / NS_JE_MS;
  if (ms < schwelleMs) {
    return null;
  }
  return `Event-Loop-Verzögerung ${Math.round(ms)} ms`;
}

export function datenbankMeldung(sql: string, dauerMs: number, schwelleMs = DATENBANK_SCHWELLE_MS): string | null {
  if (!Number.isFinite(dauerMs) || dauerMs < schwelleMs) {
    return null;
  }
  return `Langsamer Datenbankzugriff ${Math.round(dauerMs)} ms: ${sqlOhneDaten(sql)}`;
}

let datenbankLog: Log | null = null;
let datenbankSchwelle = DATENBANK_SCHWELLE_MS;
let umhuellt = false;
let lauf = 0;

function meldeSicher(log: Log, text: string): void {
  try {
    log(text);
  } catch {
    return;
  }
}

function meldeZugriff(sql: string, start: number): void {
  const log = datenbankLog;
  if (!log || sql.length === 0) {
    return;
  }
  const text = datenbankMeldung(sql, performance.now() - start, datenbankSchwelle);
  if (!text) {
    return;
  }
  meldeSicher(log, text);
}

function leseQuelle(anweisung: StatementSync): string {
  try {
    return anweisung.sourceSQL;
  } catch {
    return '';
  }
}

function umhuelleMethode(name: 'all' | 'get' | 'run'): void {
  const prototyp = StatementSync.prototype as unknown as Record<'all' | 'get' | 'run', AnweisungAufruf>;
  const original = prototyp[name];
  prototyp[name] = function (this: StatementSync, ...args: unknown[]): unknown {
    const start = performance.now();
    try {
      return original.apply(this, args);
    } finally {
      meldeZugriff(leseQuelle(this), start);
    }
  };
}

function aktiviereDatenbankmessung(): void {
  if (umhuellt) {
    return;
  }
  umhuellt = true;
  umhuelleMethode('all');
  umhuelleMethode('get');
  umhuelleMethode('run');
  const originalExec = DatabaseSync.prototype.exec;
  DatabaseSync.prototype.exec = function (this: DatabaseSync, sql: string): void {
    const start = performance.now();
    try {
      originalExec.call(this, sql);
    } finally {
      meldeZugriff(sql, start);
    }
  };
}

function loeseTimer(timer: ReturnType<typeof setInterval>): void {
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}

function starteEreignis(log: Log, optionen: MessungOptionen | undefined): () => void {
  const schwelle = optionen?.ereignisSchwelleMs ?? EREIGNIS_SCHWELLE_MS;
  const takt = optionen?.taktMs ?? EREIGNIS_TAKT_MS;
  const lies = optionen?.liesVerzoegerungNs;
  if (lies) {
    const timer = setInterval(() => {
      const text = ereignisMeldung(lies(), schwelle);
      if (text) {
        meldeSicher(log, text);
      }
    }, takt);
    loeseTimer(timer);
    return () => {
      clearInterval(timer);
    };
  }
  const histogramm = monitorEventLoopDelay({ resolution: AUFLOESUNG_MS });
  histogramm.enable();
  const timer = setInterval(() => {
    const text = ereignisMeldung(histogramm.max, schwelle);
    histogramm.reset();
    if (text) {
      meldeSicher(log, text);
    }
  }, takt);
  loeseTimer(timer);
  return () => {
    clearInterval(timer);
    histogramm.disable();
  };
}

export function starteMessung(log: Log, optionen?: MessungOptionen): () => void {
  aktiviereDatenbankmessung();
  const meinLauf = ++lauf;
  datenbankLog = log;
  datenbankSchwelle = optionen?.datenbankSchwelleMs ?? DATENBANK_SCHWELLE_MS;
  const stopEreignis = starteEreignis(log, optionen);
  let an = true;
  return () => {
    if (!an) {
      return;
    }
    an = false;
    stopEreignis();
    if (lauf === meinLauf) {
      datenbankLog = null;
    }
  };
}
