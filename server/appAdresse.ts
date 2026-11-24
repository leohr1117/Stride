import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { APP_ADRESSE_META, gueltigeAppAdresse } from '../shared/appAdresse.ts';
import { ungueltig } from './fehler.ts';
import { CHANGE_PASSWORD_PFAD, PASSWORT_AENDERN_PFAD } from './features/zugang/passwortAdresse.ts';
import { fuegeTestVersionEin, testversionEinblendung } from './testVersionen.ts';
import { strideVariable } from './umgebung.ts';

export function gesetzteAppAdresse(env: NodeJS.ProcessEnv = process.env): string | null {
  return gueltigeAppAdresse(strideVariable('APP_URL', env));
}

export function oauthWeiterleitung(host: string, sicher: boolean, appRoh: string | undefined): string {
  const adresse = gueltigeAppAdresse(appRoh);
  if (adresse) {
    return `${adresse}/api/zugang/google/zurueck`;
  }
  if (!host || host.includes('/') || host.includes(' ')) {
    throw ungueltig('Ungültige Eingabe.');
  }
  const proto = sicher ? 'https' : 'http';
  return `${proto}://${host}/api/zugang/google/zurueck`;
}

export function istDokumentPfad(pfad: string): boolean {
  if (pfad === '/api' || pfad.startsWith('/api/')) {
    return false;
  }
  if (pfad === '/' || pfad === '/index.html') {
    return true;
  }
  const name = pfad.slice(pfad.lastIndexOf('/') + 1);
  return name.length > 0 && !name.includes('.');
}

export function fuegeAppAdresseEin(html: string, adresse: string): string {
  const marker = `name="${APP_ADRESSE_META}"`;
  if (html.includes(marker)) {
    return html;
  }
  const kopf = html.indexOf('</head>');
  if (kopf < 0) {
    return html;
  }
  const inhalt = adresse.replace(/["<>&]/g, '');
  const meta = `<meta name="${APP_ADRESSE_META}" content="${inhalt}">`;
  return `${html.slice(0, kopf)}${meta}${html.slice(kopf)}`;
}

function liesIndex(clientPfad: string): string | null {
  const datei = path.join(clientPfad, 'index.html');
  if (!existsSync(datei)) {
    return null;
  }
  return readFileSync(datei, 'utf8');
}

export function dokumentMitAppAdresse(clientPfad: string, adresse: string): string | null {
  const html = liesIndex(clientPfad);
  if (html === null) {
    return null;
  }
  return fuegeAppAdresseEin(html, adresse);
}

export function registriereAppAdresse(
  app: FastifyInstance,
  clientPfad: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  app.addHook('onRequest', (anfrage, antwort, fertig) => {
    if (anfrage.method === 'GET' || anfrage.method === 'HEAD') {
      const wechsel = anfrage.url.split('?')[0] ?? anfrage.url;
      if (wechsel === CHANGE_PASSWORD_PFAD) {
        antwort.redirect(PASSWORT_AENDERN_PFAD, 302);
        return;
      }
    }
    const adresse = gesetzteAppAdresse(env);
    const testversion = testversionEinblendung(env);
    if (!adresse && testversion === null) {
      fertig();
      return;
    }
    if (anfrage.method !== 'GET' && anfrage.method !== 'HEAD') {
      fertig();
      return;
    }
    const pfad = anfrage.url.split('?')[0] ?? anfrage.url;
    if (!istDokumentPfad(pfad)) {
      fertig();
      return;
    }
    const roh = liesIndex(clientPfad);
    if (roh === null) {
      fertig();
      return;
    }
    let html = adresse ? fuegeAppAdresseEin(roh, adresse) : roh;
    if (testversion !== null) {
      html = fuegeTestVersionEin(html, testversion);
    }
    antwort.type('text/html; charset=utf-8').send(html);
  });
}
