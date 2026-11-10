import fs from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import type { FastifyServerOptions } from 'fastify';
import { strideVariable } from './umgebung.ts';

const PROJEKT_WURZEL = path.resolve(import.meta.dirname, '..');
const AUFBEWAHRUNG_TAGE = 14;
const SCHLIESS_FRIST_MS = 200;
const REDIGIERT = '[redigiert]';
const LOG_NAME = /^stride-(\d{4})-(\d{2})-(\d{2})\.log$/;

const GEHEIM_FELDER = [
  'cookie',
  'authorization',
  'set-cookie',
  'passwort',
  'password',
  'token',
  'secret',
  'access_token',
  'refresh_token',
  'id_token',
  'client_secret',
  'code',
  'state',
  'email',
  'adresse',
] as const;

const REDACT_PFADE = GEHEIM_FELDER.flatMap((feld) => [feld, `*.${feld}`]);

type LoggerWahl = Exclude<FastifyServerOptions['logger'], boolean | undefined>;

export type DateiOeffnen = (pfad: string) => fs.WriteStream;

export interface LogVorgaben {
  env?: NodeJS.ProcessEnv;
  wurzel?: string;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
  jetzt?: () => Date;
  oeffneDatei?: DateiOeffnen;
}

interface LogStromOptionen {
  ordner: string;
  jetzt: () => Date;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  oeffne: DateiOeffnen;
}

export function tagesstempel(datum: Date): string {
  const monat = String(datum.getMonth() + 1).padStart(2, '0');
  const tag = String(datum.getDate()).padStart(2, '0');
  return `${datum.getFullYear()}-${monat}-${tag}`;
}

function tageVor(damals: Date, heute: Date): number {
  const start = Date.UTC(damals.getFullYear(), damals.getMonth(), damals.getDate());
  const ende = Date.UTC(heute.getFullYear(), heute.getMonth(), heute.getDate());
  return Math.round((ende - start) / 86_400_000);
}

export function loescheAlteLogdateien(ordner: string, heute: Date): void {
  let namen: string[];
  try {
    namen = fs.readdirSync(ordner);
  } catch {
    return;
  }
  for (const name of namen) {
    const treffer = LOG_NAME.exec(name);
    if (!treffer) {
      continue;
    }
    const jahr = Number(treffer[1]);
    const monat = Number(treffer[2]);
    const tag = Number(treffer[3]);
    const datum = new Date(jahr, monat - 1, tag);
    if (datum.getFullYear() !== jahr || datum.getMonth() !== monat - 1 || datum.getDate() !== tag) {
      continue;
    }
    if (tageVor(datum, heute) <= AUFBEWAHRUNG_TAGE) {
      continue;
    }
    const ziel = path.join(ordner, name);
    try {
      if (!fs.statSync(ziel).isFile()) {
        continue;
      }
      fs.unlinkSync(ziel);
    } catch {
      continue;
    }
  }
}

export function ersetzeAdressen(text: string): string {
  return text.replace(/(?:https?|webcal):\/\/\S+/gi, '[adresse]');
}

function anfrageFuerLog(anfrage: { method?: string; url?: string }): { method: string; url: string } {
  const url = typeof anfrage.url === 'string' ? (anfrage.url.split('?')[0] ?? '') : '';
  return { method: anfrage.method ?? '', url };
}

function fehlerFuerLog(fehler: { name?: string; message?: string; stack?: string }): {
  type: string;
  message: string;
  stack: string;
} {
  const meldung = ersetzeAdressen(typeof fehler?.message === 'string' ? fehler.message : '');
  const stapel = ersetzeAdressen(typeof fehler?.stack === 'string' ? fehler.stack : meldung);
  const type = typeof fehler?.name === 'string' && fehler.name.length > 0 ? fehler.name : 'Error';
  return { type, message: meldung, stack: stapel };
}

export function loggerOptionen(stufe: string, strom?: Writable): LoggerWahl {
  const basis = {
    level: stufe,
    redact: { paths: REDACT_PFADE, censor: REDIGIERT },
    serializers: { req: anfrageFuerLog, err: fehlerFuerLog },
  };
  if (!strom) {
    return basis;
  }
  return { ...basis, stream: strom };
}

type LogAblage =
  | { art: 'konsole'; grund: 'leer' | 'datei' }
  | { art: 'ordner'; pfad: string };

export function logAblageAus(
  env: NodeJS.ProcessEnv,
  wurzel: string,
  stderr: NodeJS.WritableStream,
): LogAblage {
  const roh = strideVariable('LOG_PFAD', env);
  const text = typeof roh === 'string' ? roh.trim() : '';
  if (text.length === 0) {
    return { art: 'konsole', grund: 'leer' };
  }
  const pfad = path.isAbsolute(text) ? path.normalize(text) : path.resolve(wurzel, text);
  try {
    if (fs.existsSync(pfad) && fs.statSync(pfad).isFile()) {
      stderr.write('Der Log-Pfad zeigt auf eine Datei. Es wird nur auf die Konsole geschrieben.\n');
      return { art: 'konsole', grund: 'datei' };
    }
  } catch {
    stderr.write('Der Log-Pfad lässt sich nicht lesen. Es wird nur auf die Konsole geschrieben.\n');
    return { art: 'konsole', grund: 'datei' };
  }
  return { art: 'ordner', pfad };
}

function standardOeffnen(pfad: string): fs.WriteStream {
  return fs.createWriteStream(pfad, { flags: 'a' });
}

class LogTee extends Writable {
  private datei: fs.WriteStream | null = null;
  private tag = '';
  private dateiAus = false;
  private dateiGewarnt = false;
  private zu = false;
  private warte: Promise<void> = Promise.resolve();
  private readonly ordner: string;
  private readonly jetzt: () => Date;
  private readonly ausgabe: NodeJS.WritableStream;
  private readonly stderr: NodeJS.WritableStream;
  private readonly oeffne: DateiOeffnen;

  constructor(optionen: LogStromOptionen) {
    super();
    this.ordner = optionen.ordner;
    this.jetzt = optionen.jetzt;
    this.ausgabe = optionen.stdout;
    this.stderr = optionen.stderr;
    this.oeffne = optionen.oeffne;
    const datum = this.jetzt();
    this.oeffneDatei(datum, tagesstempel(datum));
  }

  override _write(chunk: Buffer | string, _encoding: BufferEncoding, fertig: (fehler?: Error | null) => void): void {
    try {
      this.ausgabe.write(chunk);
    } catch {
      // absichtlich leer: eine tote Konsole beendet den Server nicht
    }
    this.schreibeDatei(chunk);
    fertig();
  }

  override _final(fertig: (fehler?: Error | null) => void): void {
    void this.schliesse().then(
      () => fertig(),
      () => fertig(),
    );
  }

  schliesse(): Promise<void> {
    if (this.zu) {
      return this.warte;
    }
    this.zu = true;
    if (this.datei) {
      this.merkeEnde(this.datei);
      this.datei = null;
    }
    return this.warte;
  }

  private schreibeDatei(chunk: Buffer | string): void {
    try {
      const datum = this.jetzt();
      const tag = tagesstempel(datum);
      if (tag !== this.tag) {
        this.dateiAus = false;
        this.dateiGewarnt = false;
        this.beendeDatei();
        this.tag = '';
      }
      if (this.dateiAus) {
        return;
      }
      if (!this.datei) {
        this.oeffneDatei(datum, tag);
      }
      if (!this.datei || this.dateiAus) {
        return;
      }
      this.datei.write(chunk);
    } catch {
      this.schalteDateiAus();
    }
  }

  private oeffneDatei(datum: Date, tag: string): void {
    try {
      fs.mkdirSync(this.ordner, { recursive: true });
      if (!fs.statSync(this.ordner).isDirectory()) {
        this.tag = tag;
        this.schalteDateiAus();
        return;
      }
      loescheAlteLogdateien(this.ordner, datum);
      const strom = this.oeffne(path.join(this.ordner, `stride-${tag}.log`));
      strom.on('error', () => {
        this.schalteDateiAus();
      });
      this.datei = strom;
      this.tag = tag;
      this.dateiAus = false;
    } catch {
      this.tag = tag;
      this.schalteDateiAus();
    }
  }

  private schalteDateiAus(): void {
    const alt = this.datei;
    this.datei = null;
    this.dateiAus = true;
    if (!this.dateiGewarnt) {
      this.dateiGewarnt = true;
      this.stderr.write('Die Logdatei ist nicht schreibbar. Weitere Zeilen gehen nur an die Konsole.\n');
    }
    if (!alt) {
      return;
    }
    try {
      alt.removeAllListeners('error');
      alt.on('error', () => undefined);
      alt.destroy();
    } catch {
      // Der Strom ist schon zu.
    }
  }

  private beendeDatei(): void {
    if (!this.datei) {
      return;
    }
    const alt = this.datei;
    this.datei = null;
    this.merkeEnde(alt);
  }

  private merkeEnde(strom: fs.WriteStream): void {
    const ende = new Promise<void>((resolve) => {
      let fertig = false;
      const los = () => {
        if (fertig) {
          return;
        }
        fertig = true;
        clearTimeout(frist);
        resolve();
      };
      const frist = setTimeout(los, SCHLIESS_FRIST_MS);
      strom.once('finish', los);
      strom.once('error', () => {
        strom.removeAllListeners('error');
        strom.on('error', () => undefined);
        los();
      });
      try {
        strom.end();
      } catch {
        los();
      }
    });
    this.warte = this.warte.then(() => ende);
  }
}

let aktiv: LogTee | null = null;

export function oeffneLogStrom(optionen: {
  ordner: string;
  jetzt?: () => Date;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
  oeffneDatei?: DateiOeffnen;
}): Writable {
  const tee = new LogTee({
    ordner: optionen.ordner,
    jetzt: optionen.jetzt ?? (() => new Date()),
    stdout: optionen.stdout ?? process.stdout,
    stderr: optionen.stderr ?? process.stderr,
    oeffne: optionen.oeffneDatei ?? standardOeffnen,
  });
  aktiv = tee;
  return tee;
}

export function schliesseLogStrom(): Promise<void> {
  const tee = aktiv;
  aktiv = null;
  if (!tee) {
    return Promise.resolve();
  }
  return tee.schliesse();
}

export function bereiteLoggerVor(stufe: string, vorgaben: LogVorgaben = {}): LoggerWahl {
  const stderr = vorgaben.stderr ?? process.stderr;
  const ablage = logAblageAus(vorgaben.env ?? process.env, vorgaben.wurzel ?? PROJEKT_WURZEL, stderr);
  if (ablage.art === 'konsole') {
    if (ablage.grund === 'datei' && vorgaben.stdout) {
      return loggerOptionen(stufe, vorgaben.stdout as Writable);
    }
    return loggerOptionen(stufe);
  }
  const strom = oeffneLogStrom({
    ordner: ablage.pfad,
    jetzt: vorgaben.jetzt,
    stdout: vorgaben.stdout,
    stderr,
    oeffneDatei: vorgaben.oeffneDatei,
  });
  return loggerOptionen(stufe, strom);
}
