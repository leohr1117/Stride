import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppFehler } from '../../fehler.ts';
import { entferneKonto, erstelleMitglied, hauptweltdatei, konten } from './konten.ts';
import {
  aenderePasswort,
  anzahlKonten,
  benenneBenutzer,
  benutzerPasswortStimmt,
  hatKeinKonto,
  istGesperrt,
  kontenSichtbar,
  legeBenutzerAn,
  merkeFehlversuch,
  oeffneSitzung,
  passwortDerSitzungStimmt,
  passwortStimmt,
  schliesseSitzung,
  setzeFehlversucheZurueck,
  sitzungsBenutzer,
  uebernimmAltesPasswort,
  zugangStatus,
  ZUGANG,
} from './zugang.ts';
import { anmeldeSchema, benutzernameSchema, idParameter, kontoSchema, passwortAenderungSchema } from '../../validierung.ts';

export const SITZUNG_COOKIE = 'ascend_sitzung';

const OEFFENTLICH = new Set(['GET /zugang', 'POST /zugang', 'POST /zugang/abmelden']);
const ZU_VIELE_VERSUCHE = 'Zu viele Versuche. Bitte später erneut versuchen.';

export function istOeffentlicherZugang(methode: string, url: string): boolean {
  const ohneQuery = url.split('?')[0] ?? url;
  const ohneApi = ohneQuery.startsWith('/api/') ? ohneQuery.slice('/api'.length) : ohneQuery;
  const pfad = ohneApi.length > 1 && ohneApi.endsWith('/') ? ohneApi.slice(0, -1) : ohneApi;
  return OEFFENTLICH.has(`${methode.toUpperCase()} ${pfad}`);
}

export function leseSitzungsToken(cookieKopf: string | string[] | undefined): string | undefined {
  const kopf = Array.isArray(cookieKopf) ? cookieKopf.join('; ') : cookieKopf;
  if (!kopf) {
    return undefined;
  }
  for (const teil of kopf.split(';')) {
    const trenn = teil.indexOf('=');
    if (trenn === -1) {
      continue;
    }
    if (teil.slice(0, trenn).trim() !== SITZUNG_COOKIE) {
      continue;
    }
    const wert = teil.slice(trenn + 1).trim();
    return wert ? decodeURIComponent(wert) : undefined;
  }
  return undefined;
}

function cookieZeile(token: string, maxAlter: number, sicher: boolean): string {
  const teile = [`${SITZUNG_COOKIE}=${encodeURIComponent(token)}`, 'HttpOnly', 'Path=/', 'SameSite=Lax', `Max-Age=${maxAlter}`];
  if (sicher) {
    teile.push('Secure');
  }
  return teile.join('; ');
}

export function sitzungsCookie(token: string, sicher: boolean): string {
  return cookieZeile(token, ZUGANG.sitzungSekunden, sicher);
}

export function abmeldeCookie(sicher: boolean): string {
  return cookieZeile('', 0, sicher);
}

export function verbindungIstSicher(protocol: string, forwardedProto: string | string[] | undefined): boolean {
  if (protocol === 'https') {
    return true;
  }
  const roh = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  return roh?.split(',')[0]?.trim() === 'https';
}

function ersterKopf(wert: string | string[] | undefined): string | undefined {
  const roh = Array.isArray(wert) ? wert[0] : wert;
  const erster = roh?.split(',')[0]?.trim();
  return erster ? erster : undefined;
}

function letzterKopf(wert: string | string[] | undefined): string | undefined {
  const roh = Array.isArray(wert) ? wert.join(',') : wert;
  if (!roh) {
    return undefined;
  }
  const teile = roh
    .split(',')
    .map((teil) => teil.trim())
    .filter(Boolean);
  return teile[teile.length - 1];
}

export function clientAdresse(
  ip: string,
  koepfe: { cfConnectingIp?: string | string[]; xForwardedFor?: string | string[] },
): string {
  return ersterKopf(koepfe.cfConnectingIp) ?? letzterKopf(koepfe.xForwardedFor) ?? (ip || 'unbekannt');
}

function adresseVon(anfrage: FastifyRequest): string {
  return clientAdresse(anfrage.ip, {
    cfConnectingIp: anfrage.headers['cf-connecting-ip'],
    xForwardedFor: anfrage.headers['x-forwarded-for'],
  });
}

function sicherVon(anfrage: FastifyRequest): boolean {
  return verbindungIstSicher(anfrage.protocol, anfrage.headers['x-forwarded-proto']);
}

function setzeSitzung(anfrage: FastifyRequest, antwort: FastifyReply, token: string): void {
  antwort.header('set-cookie', sitzungsCookie(token, sicherVon(anfrage)));
}

export async function zugangRouten(app: FastifyInstance): Promise<void> {
  app.get('/zugang', async (anfrage) => zugangStatus(leseSitzungsToken(anfrage.headers.cookie)));

  app.post('/zugang', async (anfrage, antwort) => {
    const { benutzername, passwort } = anmeldeSchema.parse(anfrage.body);
    const adresse = adresseVon(anfrage);
    if (istGesperrt(adresse)) {
      throw new AppFehler(429, ZU_VIELE_VERSUCHE);
    }
    const falsch = (): never => {
      merkeFehlversuch(adresse);
      if (istGesperrt(adresse)) {
        throw new AppFehler(429, ZU_VIELE_VERSUCHE);
      }
      throw new AppFehler(401, 'Anmeldung fehlgeschlagen.');
    };
    let token: string;
    if (hatKeinKonto()) {
      if (!benutzername) {
        throw new AppFehler(400, 'Der Benutzername fehlt.');
      }
      const konto = legeBenutzerAn({ benutzername, passwort, rolle: 'inhaber', weltdatei: hauptweltdatei() });
      token = oeffneSitzung(new Date(), konto.id);
    } else if (anzahlKonten() === 0) {
      if (!passwortStimmt(passwort)) {
        falsch();
      }
      token = oeffneSitzung();
    } else {
      if (!benutzername) {
        throw new AppFehler(400, 'Der Benutzername fehlt.');
      }
      const konto = benutzerPasswortStimmt(benutzername, passwort);
      if (!konto) {
        return falsch();
      }
      token = oeffneSitzung(new Date(), konto.id);
    }
    setzeFehlversucheZurueck(adresse);
    setzeSitzung(anfrage, antwort, token);
    return zugangStatus(token);
  });

  app.post('/zugang/abmelden', async (anfrage, antwort) => {
    schliesseSitzung(leseSitzungsToken(anfrage.headers.cookie));
    antwort.header('set-cookie', abmeldeCookie(sicherVon(anfrage)));
    return antwort.status(204).send();
  });

  app.post('/zugang/passwort', async (anfrage) => {
    const { bisher, neu } = passwortAenderungSchema.parse(anfrage.body);
    const token = leseSitzungsToken(anfrage.headers.cookie);
    const adresse = adresseVon(anfrage);
    if (!token) {
      throw new AppFehler(401, 'Anmeldung erforderlich.');
    }
    if (istGesperrt(adresse)) {
      throw new AppFehler(429, ZU_VIELE_VERSUCHE);
    }
    if (!passwortDerSitzungStimmt(token, bisher)) {
      merkeFehlversuch(adresse);
      throw new AppFehler(401, 'Das Passwort ist falsch.');
    }
    aenderePasswort(neu, token);
    setzeFehlversucheZurueck(adresse);
    return zugangStatus(token);
  });

  app.post('/zugang/benutzername', async (anfrage) => {
    const token = leseSitzungsToken(anfrage.headers.cookie);
    if (!token || zugangStatus(token).modus === 'anmelden' || zugangStatus(token).modus === 'passwort' || zugangStatus(token).modus === 'einrichten') {
      throw new AppFehler(401, 'Anmeldung erforderlich.');
    }
    const { benutzername } = benutzernameSchema.parse(anfrage.body);
    if (zugangStatus(token).modus === 'benutzername') {
      uebernimmAltesPasswort(benutzername, hauptweltdatei());
      return zugangStatus(token);
    }
    const selbst = sitzungsBenutzer(token);
    if (!selbst) {
      throw new AppFehler(401, 'Anmeldung erforderlich.');
    }
    benenneBenutzer(selbst.id, benutzername);
    return zugangStatus(token);
  });

  app.get('/zugang/konten', async (anfrage) => {
    const token = leseSitzungsToken(anfrage.headers.cookie);
    if (!kontenSichtbar(token)) {
      throw new AppFehler(403, 'Nur der Inhaber sieht die Accounts.');
    }
    return konten();
  });

  app.post('/zugang/konten', async (anfrage, antwort) => {
    const token = leseSitzungsToken(anfrage.headers.cookie);
    if (!kontenSichtbar(token)) {
      throw new AppFehler(403, 'Nur der Inhaber legt Accounts an.');
    }
    const konto = erstelleMitglied(kontoSchema.parse(anfrage.body));
    return antwort.status(201).send(konto);
  });

  app.delete('/zugang/konten/:id', async (anfrage, antwort) => {
    const token = leseSitzungsToken(anfrage.headers.cookie);
    if (!kontenSichtbar(token)) {
      throw new AppFehler(403, 'Nur der Inhaber entfernt Accounts.');
    }
    const { id } = idParameter.parse(anfrage.params);
    entferneKonto(id);
    return antwort.status(204).send();
  });
}
