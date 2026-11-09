import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppFehler, ungueltig } from '../../fehler.ts';
import { verbindungIstSicher, leseSitzungsToken, sitzungsCookie } from './routen.ts';
import { beginneGoogle, googleAktiv, googleSchluessel, loeseGoogle, LOESEN_GESPERRT } from './google.ts';
import { schliesseGoogle } from './googleSchluss.ts';
import { oeffneSitzung, sitzungsBenutzer, zugangStatus } from './zugang.ts';

function unbekannt(anfrage: FastifyRequest): AppFehler {
  return new AppFehler(404, `Unbekannter Pfad: ${anfrage.method} ${anfrage.url}`);
}

function sicher(anfrage: FastifyRequest): boolean {
  return verbindungIstSicher(anfrage.protocol, anfrage.headers['x-forwarded-proto']);
}

function weiterleitung(anfrage: FastifyRequest): string {
  const roh = anfrage.headers.host;
  const host = (Array.isArray(roh) ? roh[0] : roh)?.split(',')[0]?.trim() ?? '';
  if (!host || host.includes('/') || host.includes(' ')) {
    throw ungueltig('Ungültige Eingabe.');
  }
  const proto = sicher(anfrage) ? 'https' : 'http';
  return `${proto}://${host}/api/zugang/google/zurueck`;
}

function suchParameter(query: unknown): URLSearchParams {
  const suche = new URLSearchParams();
  if (query === null || typeof query !== 'object') {
    return suche;
  }
  const roh = query as Record<string, unknown>;
  for (const name of ['code', 'state', 'error'] as const) {
    const wert = roh[name];
    if (typeof wert === 'string') {
      suche.set(name, wert);
    }
  }
  return suche;
}

function setzeCookies(antwort: FastifyReply, zeilen: string[]): void {
  if (zeilen.length > 0) {
    antwort.header('set-cookie', zeilen);
  }
}

export function registriereGoogleRouten(app: FastifyInstance): void {
  app.get('/zugang/google/start', async (anfrage, antwort) => {
    if (!googleAktiv()) {
      throw unbekannt(anfrage);
    }
    const zweck = (anfrage.query as { zweck?: unknown }).zweck;
    if (zweck !== 'anmelden' && zweck !== 'verknuepfen') {
      throw ungueltig('Ungültige Eingabe.');
    }
    const benutzer = sitzungsBenutzer(leseSitzungsToken(anfrage.headers.cookie));
    const start = beginneGoogle({
      zweck,
      benutzerId: benutzer?.id ?? null,
      sicher: sicher(anfrage),
      weiterleitung: weiterleitung(anfrage),
    });
    if (start.art === 'weiter') {
      antwort.header('set-cookie', start.cookie);
    }
    return antwort.redirect(start.ort, 302);
  });

  app.get('/zugang/google/zurueck', async (anfrage, antwort) => {
    if (!googleAktiv()) {
      throw unbekannt(anfrage);
    }
    const token = leseSitzungsToken(anfrage.headers.cookie);
    const benutzer = sitzungsBenutzer(token);
    const gast = zugangStatus(undefined);
    const schluss = await schliesseGoogle({
      suche: suchParameter(anfrage.query),
      schluessel: googleSchluessel(anfrage.headers.cookie),
      benutzerId: benutzer?.id ?? null,
      sicher: sicher(anfrage),
      anlageErlaubt: gast.registrierung && gast.modus === 'anmelden',
    });
    const cookies = [...schluss.cookies];
    if (schluss.sitzungFuer !== undefined) {
      cookies.push(sitzungsCookie(oeffneSitzung(new Date(), schluss.sitzungFuer), sicher(anfrage)));
    }
    setzeCookies(antwort, cookies);
    return antwort.redirect(schluss.ort, 302);
  });

  app.delete('/zugang/google', async (anfrage, antwort) => {
    if (!googleAktiv()) {
      throw unbekannt(anfrage);
    }
    const benutzer = sitzungsBenutzer(leseSitzungsToken(anfrage.headers.cookie));
    if (!benutzer) {
      throw new AppFehler(401, 'Anmeldung erforderlich.');
    }
    if (loeseGoogle(benutzer.id) === 'gesperrt') {
      throw new AppFehler(409, LOESEN_GESPERRT);
    }
    return antwort.status(204).send();
  });
}
