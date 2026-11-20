import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const LIZENZ_DATEIEN = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md', 'COPYING', 'COPYING.md'] as const;
const NOTICE_DATEIEN = ['NOTICE', 'NOTICE.md'] as const;
const ROBOTO_VERSION = '3.015';

export interface NpmKnoten {
  version?: string;
  path?: string;
  missing?: boolean;
  dev?: boolean;
  dependencies?: Record<string, NpmKnoten>;
}

export interface Eintrag {
  name: string;
  version: string;
  lizenz: string;
  copyright: string;
  text: string;
}

export function istSha(wert: string): boolean {
  return /^[0-9a-f]{40}$/.test(wert);
}

/** Git gewinnt. Nur ein ungültiger oder fehlender Stand fällt auf STRIDE_COMMIT zurück. */
export function leseCommit(env: NodeJS.ProcessEnv, git: () => string): string {
  try {
    const ausGit = git().trim();
    if (istSha(ausGit)) {
      return ausGit;
    }
  } catch {
    // Tarball ohne .git oder ohne Git.
  }
  const ausEnv = (env.STRIDE_COMMIT ?? '').trim();
  return istSha(ausEnv) ? ausEnv : '';
}

export function gitHead(cwd: string): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
}

export function behaeltPaket(knoten: { dev?: boolean }): boolean {
  return knoten.dev !== true;
}

function text(wert: unknown): string {
  return typeof wert === 'string' ? wert.trim() : '';
}

function autor(wert: unknown): string {
  if (typeof wert === 'string') {
    return wert.trim();
  }
  if (wert && typeof wert === 'object' && 'name' in wert) {
    return text((wert as { name: unknown }).name);
  }
  return '';
}

function ohneHtml(roh: string): string {
  return roh.replaceAll('\r\n', '\n').replace(/<!--[\s\S]*?-->/g, '').trim();
}

function ersteCopyrightZeile(inhalt: string): string {
  for (const zeile of inhalt.split('\n')) {
    const rein = zeile.trim();
    if (/copyright/i.test(rein)) {
      return rein;
    }
  }
  return '';
}

function liesFallsDa(ordner: string, namen: readonly string[]): string {
  const vorhanden = new Map(fs.readdirSync(ordner).map((name) => [name.toLowerCase(), name]));
  for (const name of namen) {
    const echt = vorhanden.get(name.toLowerCase());
    if (!echt) {
      continue;
    }
    const datei = path.join(ordner, echt);
    if (!fs.statSync(datei).isFile()) {
      continue;
    }
    return ohneHtml(fs.readFileSync(datei, 'utf8'));
  }
  return '';
}

function istApache(lizenz: string): boolean {
  return /\bapache\b/i.test(lizenz);
}

export function liesPaket(ordner: string): Eintrag {
  const paket = JSON.parse(fs.readFileSync(path.join(ordner, 'package.json'), 'utf8')) as {
    name?: unknown;
    version?: unknown;
    license?: unknown;
    author?: unknown;
  };
  const name = text(paket.name) || path.basename(ordner);
  const version = text(paket.version) || '0.0.0';
  const lizenz = text(paket.license) || 'unbekannt';
  const lizenztext = liesFallsDa(ordner, LIZENZ_DATEIEN);
  if (lizenztext.length === 0) {
    if (lizenz === 'unbekannt') {
      throw new Error(`Lizenzliste: ${name} hat keine Lizenzdatei.`);
    }
    return {
      name,
      version,
      lizenz,
      copyright: autor(paket.author),
      text: `Dieses Paket liefert keine Lizenzdatei mit. Das Feld license nennt ${lizenz}.`,
    };
  }
  const notice = liesFallsDa(ordner, NOTICE_DATEIEN);
  const copyright = ersteCopyrightZeile(notice) || ersteCopyrightZeile(lizenztext) || autor(paket.author);
  const koerper = istApache(lizenz) && notice.length > 0 ? `${lizenztext}\n\n${notice}` : lizenztext;
  return { name, version, lizenz, copyright, text: koerper };
}

function loeseOrdner(name: string, start: string, knoten: NpmKnoten): string | null {
  if (typeof knoten.path === 'string' && knoten.path.trim().length > 0) {
    return knoten.path;
  }
  const teile = name.split('/');
  let dir = start;
  for (;;) {
    const kandidat = path.join(dir, 'node_modules', ...teile);
    if (fs.existsSync(path.join(kandidat, 'package.json'))) {
      return kandidat;
    }
    const eltern = path.dirname(dir);
    if (eltern === dir) {
      return null;
    }
    dir = eltern;
  }
}

function direkteNamen(wurzel: string): string[] {
  const paket = JSON.parse(fs.readFileSync(path.join(wurzel, 'package.json'), 'utf8')) as { dependencies?: unknown };
  const wert = paket.dependencies;
  if (!wert || typeof wert !== 'object' || Array.isArray(wert)) {
    return [];
  }
  return Object.keys(wert);
}

export function sammleProduktionspakete(wurzel: string, baum?: NpmKnoten): Eintrag[] {
  const daten = baum ?? npmLs(wurzel);
  const gesehen = new Set<string>();
  const eintraege: Eintrag[] = [];
  const fehlt: string[] = [];

  const besuche = (name: string, knoten: NpmKnoten, start: string, pflicht: boolean): void => {
    if (!behaeltPaket(knoten)) {
      return;
    }
    if (knoten.missing === true) {
      if (pflicht) {
        fehlt.push(name);
      }
      return;
    }
    const ordner = loeseOrdner(name, start, knoten);
    if (!ordner) {
      if (pflicht) {
        fehlt.push(name);
      }
      return;
    }
    let real: string;
    try {
      real = fs.realpathSync(ordner);
    } catch {
      if (pflicht) {
        fehlt.push(name);
      }
      return;
    }
    if (!gesehen.has(real)) {
      gesehen.add(real);
      eintraege.push(liesPaket(real));
    }
    for (const [kindName, kind] of Object.entries(knoten.dependencies ?? {})) {
      besuche(kindName, kind, real, false);
    }
  };

  const kinder = daten.dependencies ?? {};
  for (const name of direkteNamen(wurzel)) {
    const knoten = kinder[name];
    if (!knoten) {
      fehlt.push(name);
      continue;
    }
    besuche(name, knoten, wurzel, true);
  }
  if (fehlt.length > 0) {
    throw new Error(`Lizenzliste: direkte Abhängigkeit fehlt: ${[...new Set(fehlt)].sort().join(', ')}`);
  }
  eintraege.sort((links, rechts) => links.name.localeCompare(rechts.name) || links.version.localeCompare(rechts.version));
  return eintraege;
}

function jsonAusNpm(stdout: string): NpmKnoten {
  const start = stdout.indexOf('{');
  const ende = stdout.lastIndexOf('}');
  if (start < 0 || ende < start) {
    throw new Error('Lizenzliste: npm ls lieferte kein JSON.');
  }
  return JSON.parse(stdout.slice(start, ende + 1)) as NpmKnoten;
}

export function parseNpmLs(stdout: string, code: number): NpmKnoten {
  try {
    return jsonAusNpm(stdout);
  } catch (fehler) {
    if (code === 0) {
      throw fehler;
    }
    throw new Error(`Lizenzliste: npm ls endete mit Code ${code} ohne JSON.`);
  }
}

function npmBefehl(): { befehl: string; shell: boolean } {
  if (process.platform === 'win32') {
    // execFile startet keine .cmd, darum hier die Shell.
    return { befehl: 'npm.cmd', shell: true };
  }
  return { befehl: 'npm', shell: false };
}

function npmLs(wurzel: string): NpmKnoten {
  const { befehl, shell } = npmBefehl();
  const args = ['ls', '--omit=dev', '--json', '--all'] as const;
  const optionen = {
    cwd: wurzel,
    encoding: 'utf8' as const,
    maxBuffer: 32 * 1024 * 1024,
    shell,
    windowsHide: true,
  };
  try {
    return parseNpmLs(execFileSync(befehl, args, optionen), 0);
  } catch (fehler) {
    const stdout = fehler && typeof fehler === 'object' && 'stdout' in fehler ? (fehler as { stdout?: unknown }).stdout : '';
    const roh = typeof stdout === 'string' ? stdout : Buffer.isBuffer(stdout) ? stdout.toString('utf8') : '';
    const status = fehler && typeof fehler === 'object' && 'status' in fehler ? (fehler as { status?: unknown }).status : 1;
    const code = typeof status === 'number' ? status : 1;
    if (roh.trim().length > 0) {
      return parseNpmLs(roh, code);
    }
    const meldung = fehler instanceof Error ? fehler.message : String(fehler);
    throw new Error(`Lizenzliste: npm ls ist fehlgeschlagen (${meldung}).`);
  }
}

export function robotoEintrag(ofl: string): Eintrag {
  const koerper = ohneHtml(ofl);
  return {
    name: 'Roboto',
    version: ROBOTO_VERSION,
    lizenz: 'OFL-1.1',
    copyright: ersteCopyrightZeile(koerper),
    text: koerper,
  };
}

function block(eintrag: Eintrag): string {
  const zeilen = [`## ${eintrag.name}@${eintrag.version}`, `Lizenz: ${eintrag.lizenz}`];
  if (eintrag.copyright.length > 0) {
    zeilen.push(eintrag.copyright);
  }
  zeilen.push('', eintrag.text);
  return zeilen.join('\n');
}

export function erzeugeLizenztext(eintraege: readonly Eintrag[], commit: string, roboto: Eintrag): string {
  const kopf = ['Open-Source-Komponenten von Wupo', istSha(commit) ? `Commit: ${commit}` : 'Commit: keiner', ''];
  const inhalt = `${kopf.join('\n')}${[...eintraege, roboto].map(block).join('\n\n')}\n`;
  if (inhalt.includes('<!--')) {
    throw new Error('Lizenzliste enthält einen HTML-Kommentar.');
  }
  return inhalt;
}

export function lizenztextFuerRepo(wurzel: string, commit: string, oflPfad: string): string {
  return erzeugeLizenztext(sammleProduktionspakete(wurzel), commit, robotoEintrag(fs.readFileSync(oflPfad, 'utf8')));
}
