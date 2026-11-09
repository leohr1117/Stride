import {
  GOOGLE_TOKEN,
  googleDatenbank,
  googleGleich,
  googleJetzt,
  googleKonfig,
  legeAnlageCookie,
  leeresGoogleCookie,
  liesFluss,
  verknuepfeGoogle,
  vergissGoogleSchluessel,
  type GoogleFluss,
  type GoogleKonfig,
} from './google.ts';

const AUSSTELLER = new Set(['https://accounts.google.com', 'accounts.google.com']);

export interface GoogleSchluss {
  ort: string;
  cookies: string[];
  sitzungFuer?: number;
}

function ende(ort: string, sicher: boolean): GoogleSchluss {
  return { ort, cookies: [leeresGoogleCookie(sicher)] };
}

/**
 * OIDC Core 3.1.3.7 Nr. 6: Das ID-Token kommt direkt vom Token-Endpunkt über TLS.
 * Deshalb prüfen wir iss, aud, exp und nonce, und keine Signatur.
 */
function pruefeIdToken(token: string, clientId: string, nonce: string): { sub: string; email: string } {
  const teile = token.split('.');
  if (teile.length !== 3 || !teile[1]) {
    throw new Error('form');
  }
  const payload = JSON.parse(Buffer.from(teile[1], 'base64url').toString('utf8')) as Record<string, unknown>;
  if (typeof payload.iss !== 'string' || !AUSSTELLER.has(payload.iss)) {
    throw new Error('iss');
  }
  const aud = payload.aud;
  const audListe = Array.isArray(aud) && aud.every((eintrag) => typeof eintrag === 'string') ? aud : null;
  const audOk = aud === clientId || (audListe !== null && audListe.includes(clientId) && (audListe.length === 1 || payload.azp === clientId));
  if (!audOk) {
    throw new Error('aud');
  }
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp * 1000 <= googleJetzt()) {
    throw new Error('exp');
  }
  if (typeof payload.nonce !== 'string' || !googleGleich(payload.nonce, nonce)) {
    throw new Error('nonce');
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 255) {
    throw new Error('sub');
  }
  const email = typeof payload.email === 'string' ? payload.email.slice(0, 320) : '';
  return { sub: payload.sub, email };
}

async function tauscheCode(code: string, fluss: GoogleFluss, konfig: GoogleKonfig): Promise<string> {
  const koerper = new URLSearchParams({
    code,
    client_id: konfig.clientId,
    client_secret: konfig.geheim,
    redirect_uri: fluss.weiterleitung,
    grant_type: 'authorization_code',
    code_verifier: fluss.verifier,
  });
  const antwort = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: koerper,
  });
  if (!antwort.ok) {
    throw new Error('token');
  }
  const inhalt = (await antwort.json()) as { id_token?: unknown };
  if (typeof inhalt.id_token !== 'string' || inhalt.id_token.length === 0) {
    throw new Error('id_token');
  }
  return inhalt.id_token;
}

function ziel(profil: boolean, code: string): string {
  return profil ? `/mehr/profil?google=${code}` : `/?google=${code}`;
}

export async function schliesseGoogle(eingabe: {
  suche: URLSearchParams;
  schluessel: string | undefined;
  benutzerId: number | null;
  sicher: boolean;
  anlageErlaubt: boolean;
}): Promise<GoogleSchluss> {
  const konfig = googleKonfig();
  const fluss = liesFluss(eingabe.schluessel);
  const profil = fluss?.zweck === 'verknuepfen';
  if (!konfig || !fluss) {
    return ende('/?google=d', eingabe.sicher);
  }
  const state = eingabe.suche.get('state') ?? '';
  if (!googleGleich(fluss.state, state)) {
    return { ort: ziel(profil, 'd'), cookies: [] };
  }
  vergissGoogleSchluessel(eingabe.schluessel);
  const fehler = eingabe.suche.get('error');
  if (fehler === 'access_denied') {
    return ende(ziel(profil, 'abbruch'), eingabe.sicher);
  }
  const code = eingabe.suche.get('code');
  if (fehler || !code) {
    return ende(ziel(profil, 'd'), eingabe.sicher);
  }
  try {
    const idToken = await tauscheCode(code, fluss, konfig);
    const identitaet = pruefeIdToken(idToken, konfig.clientId, fluss.nonce);
    if (fluss.zweck === 'verknuepfen') {
      if (eingabe.benutzerId === null || eingabe.benutzerId !== fluss.benutzerId) {
        return ende('/mehr/profil?google=d', eingabe.sicher);
      }
      const ergebnis = verknuepfeGoogle(eingabe.benutzerId, identitaet.sub, identitaet.email);
      const codeName = ergebnis === 'ok' ? 'a' : ergebnis === 'fremd' ? 'fremd' : 'd';
      return ende(`/mehr/profil?google=${codeName}`, eingabe.sicher);
    }
    const treffer = googleDatenbank()
      .prepare('SELECT benutzer_id AS id FROM google_konto WHERE sub = ?')
      .get(identitaet.sub) as { id: number } | undefined;
    if (treffer) {
      return { ort: '/?google=a', cookies: [leeresGoogleCookie(eingabe.sicher)], sitzungFuer: treffer.id };
    }
    if (!eingabe.anlageErlaubt) {
      return ende('/?google=c', eingabe.sicher);
    }
    return { ort: '/?google=b', cookies: [legeAnlageCookie(identitaet.sub, identitaet.email, eingabe.sicher)] };
  } catch {
    return ende(ziel(profil, 'd'), eingabe.sicher);
  }
}
