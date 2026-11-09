import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  GOOGLE_AUTH,
  GOOGLE_COOKIE,
  LOESEN_GESPERRT,
  codeChallenge,
  googleSchemaVersion,
  googleSub,
  leereGoogleAblage,
  setzeGoogleUhr,
  verknuepfeGoogle,
} from './google.ts';
import { istOeffentlicherZugang } from './routen.ts';
import { legeBenutzerAn, listeKonten, loescheBenutzer, oeffneSitzung, schliesseZugang, verwendeZugang } from './zugang.ts';
import {
  CLIENT,
  GEHEIM,
  PASSWORT,
  SITZUNG_COOKIE,
  aktuell,
  aufraeumen,
  aufrufe,
  bereit,
  cookieWert,
  googleEnv,
  gut,
  inhaber,
  jwt,
  mitRouten,
  mocke,
  parameter,
  registrierung,
  starte,
  zurueck,
} from './googlePruefung.ts';

beforeEach(() => bereit());
afterEach(() => aufraeumen());

describe('Google-Anmeldung', () => {
  it('bleibt aus, wenn der Schalter oder ein Client-Wert fehlt', async () => {
    expect(istOeffentlicherZugang('GET', '/api/zugang/google/start')).toBe(true);
    expect(istOeffentlicherZugang('GET', '/api/zugang/google/zurueck?code=1')).toBe(true);
    expect(istOeffentlicherZugang('DELETE', '/api/zugang/google')).toBe(false);
    inhaber();
    await mitRouten(async (app) => {
      const schalter = [
        () => {
          delete process.env.STRIDE_GOOGLE;
          delete process.env.ASCEND_GOOGLE;
        },
        () => {
          process.env.STRIDE_GOOGLE = '0';
        },
        () => {
          delete process.env.STRIDE_GOOGLE_CLIENT_ID;
        },
        () => {
          delete process.env.STRIDE_GOOGLE_CLIENT_SECRET;
        },
      ];
      for (const aus of schalter) {
        googleEnv(true);
        aus();
        const status = await app.inject({ method: 'GET', url: '/api/zugang' });
        expect(status.json()).toMatchObject({ google: false, googleEmail: null, googleAnlage: null, googleLoesen: false });
        for (const [methode, url] of [
          ['GET', '/api/zugang/google/start'],
          ['GET', '/api/zugang/google/zurueck'],
          ['DELETE', '/api/zugang/google'],
        ] as const) {
          const antwort = await app.inject({ method: methode, url });
          expect(antwort.statusCode).toBe(404);
          expect(antwort.json()).toEqual({ fehler: `Unbekannter Pfad: ${methode} ${url}` });
        }
      }
    });
  });

  it('schickt state, nonce und S256 an Google', async () => {
    googleEnv(true);
    inhaber();
    expect(codeChallenge('verifier')).toBe(createHash('sha256').update('verifier').digest('base64url'));
    await mitRouten(async (app) => {
      const start = await starte(app);
      expect(start.status).toBe(302);
      expect(start.ort.startsWith(`${GOOGLE_AUTH}?`)).toBe(true);
      const suche = parameter(start.ort);
      expect(suche.get('response_type')).toBe('code');
      expect(suche.get('scope')).toBe('openid email');
      expect(suche.get('code_challenge_method')).toBe('S256');
      expect(start.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(start.state.length).toBeGreaterThan(20);
      expect(start.nonce.length).toBeGreaterThan(20);
      expect(suche.get('redirect_uri')).toContain('/api/zugang/google/zurueck');
      expect(start.roh).toContain('HttpOnly');
      expect(start.roh).toContain('SameSite=Lax');
      const falsch = await app.inject({ method: 'GET', url: '/api/zugang/google/start?zweck=anders' });
      expect(falsch.statusCode).toBe(400);
      const ohne = await starte(app, 'verknuepfen');
      expect(ohne.ort).toContain('google=d');
      expect(ohne.ort).not.toContain('accounts.google.com');
    });
  });

  it('lehnt falschen, verbrauchten und abgelaufenen state ab', async () => {
    googleEnv(true);
    registrierung(false);
    inhaber();
    await mitRouten(async (app) => {
      const start = await starte(app);
      mocke(jwt(gut(start.nonce)), (body) => {
        expect(body.get('grant_type')).toBe('authorization_code');
        expect(body.get('client_id')).toBe(CLIENT);
        expect(body.get('client_secret')).toBe(GEHEIM);
        expect(codeChallenge(body.get('code_verifier') ?? '')).toBe(start.challenge);
        expect(body.get('redirect_uri')).toBe(parameter(start.ort).get('redirect_uri'));
      });
      const falsch = await zurueck(app, { ...start, state: 'falsch' }, { code: 'abc' });
      expect(String(falsch.headers.location)).toContain('google=d');
      expect(cookieWert(falsch, SITZUNG_COOKIE)).toBeUndefined();
      expect(aufrufe).toBe(0);
      const richtig = await zurueck(app, start, { code: 'abc' });
      expect(String(richtig.headers.location)).toContain('google=c');
      expect(aufrufe).toBe(1);
      const nochmal = await zurueck(app, start, { code: 'abc' });
      expect(String(nochmal.headers.location)).toContain('google=d');
      expect(aufrufe).toBe(1);
      const frisch = await starte(app);
      setzeGoogleUhr(() => Date.now() + 11 * 60 * 1000);
      const alt = await zurueck(app, frisch, { code: 'abc' });
      expect(String(alt.headers.location)).toContain('google=d');
      leereGoogleAblage();
      const abbruchStart = await starte(app);
      expect(abbruchStart.cookie).toBeTruthy();
      const abgebrochen = await zurueck(app, abbruchStart, { error: 'access_denied' });
      expect(String(abgebrochen.headers.location)).toContain('google=abbruch');
    });
  });

  it('lehnt falschen Aussteller, Empfänger, Ablauf und nonce ab', async () => {
    googleEnv(true);
    inhaber();
    await mitRouten(async (app) => {
      const faelle: Record<string, unknown>[] = [
        { iss: 'https://evil.example' },
        { aud: 'andere' },
        { exp: Math.floor(Date.now() / 1000) - 30 },
        { nonce: 'falsch' },
      ];
      for (const extra of faelle) {
        const start = await starte(app);
        mocke(jwt(gut(start.nonce, extra)));
        const antwort = await zurueck(app, start, { code: 'abc' });
        expect(String(antwort.headers.location)).toContain('google=d');
        expect(cookieWert(antwort, SITZUNG_COOKIE)).toBeUndefined();
      }
    });
  });

  it('meldet ein verknüpftes Konto an und ignoriert dieselbe E-Mail ohne Verknüpfung', async () => {
    googleEnv(true);
    registrierung(true);
    const id = inhaber();
    verknuepfeGoogle(id, 'sub-ada', 'ada@example.com');
    await mitRouten(async (app) => {
      const start = await starte(app);
      mocke(jwt(gut(start.nonce, { sub: 'sub-ada', email: 'ada@example.com' })));
      const antwort = await zurueck(app, start, { code: 'abc' });
      expect(String(antwort.headers.location)).toContain('google=a');
      const sitzung = cookieWert(antwort, SITZUNG_COOKIE);
      expect(sitzung).toBeTruthy();
      const status = await app.inject({
        method: 'GET',
        url: '/api/zugang',
        headers: { cookie: `${SITZUNG_COOKIE}=${sitzung}` },
      });
      expect(status.json()).toMatchObject({ modus: 'bereit', benutzername: 'Ada', googleEmail: 'ada@example.com' });
      const fremd = await starte(app);
      mocke(jwt(gut(fremd.nonce, { sub: 'sub-neu', email: 'ada@example.com' })));
      const gleiche = await zurueck(app, fremd, { code: 'abc' });
      expect(String(gleiche.headers.location)).toContain('google=b');
      expect(cookieWert(gleiche, SITZUNG_COOKIE)).toBeUndefined();
      expect(googleSub(id)).toBe('sub-ada');
    });
  });

  it('verknüpft beim Anlegen und bleibt bei ausgeschalteter Registrierung unverknüpft', async () => {
    googleEnv(true);
    registrierung(true);
    inhaber();
    await mitRouten(async (app) => {
      const start = await starte(app);
      mocke(jwt(gut(start.nonce, { sub: 'sub-neu', email: 'neu@example.com' })));
      const antwort = await zurueck(app, start, { code: 'abc' });
      expect(String(antwort.headers.location)).toContain('google=b');
      const anlage = cookieWert(antwort, GOOGLE_COOKIE);
      const gast = await app.inject({ method: 'GET', url: '/api/zugang', headers: { cookie: `${GOOGLE_COOKIE}=${anlage}` } });
      expect(gast.json()).toMatchObject({ googleAnlage: 'neu@example.com', modus: 'anmelden' });
      const reg = await app.inject({
        method: 'POST',
        url: '/api/zugang/registrieren',
        headers: { cookie: `${GOOGLE_COOKIE}=${anlage}`, 'content-type': 'application/json' },
        payload: { benutzername: 'Neu', passwort: PASSWORT },
      });
      expect(reg.statusCode).toBe(200);
      const neu = listeKonten().find((konto) => konto.benutzername === 'Neu');
      expect(googleSub(neu?.id ?? 0)).toBe('sub-neu');
      registrierung(false);
      const aus = await starte(app);
      mocke(jwt(gut(aus.nonce, { sub: 'sub-frei', email: 'frei@example.com' })));
      const gesperrt = await zurueck(app, aus, { code: 'abc' });
      expect(String(gesperrt.headers.location)).toContain('google=c');
      expect(cookieWert(gesperrt, SITZUNG_COOKIE)).toBeUndefined();
      expect(listeKonten().some((konto) => konto.benutzername === 'Frei')).toBe(false);
    });
  });

  it('lehnt ein fremdes sub ab, löst nur mit Passwort und entfernt die Verknüpfung mit dem Konto', async () => {
    googleEnv(true);
    const ada = inhaber();
    const berta = legeBenutzerAn({ benutzername: 'Berta', passwort: PASSWORT, rolle: 'mitglied', weltdatei: 'welten/2.db' }).id;
    verknuepfeGoogle(ada, 'sub-fremd', 'fremd@example.com');
    const sitzung = oeffneSitzung(new Date(), berta);
    await mitRouten(async (app) => {
      const start = await starte(app, 'verknuepfen', `${SITZUNG_COOKIE}=${sitzung}`);
      expect(start.ort).toContain('accounts.google.com');
      mocke(jwt(gut(start.nonce, { sub: 'sub-fremd', email: 'fremd@example.com' })));
      const antwort = await zurueck(app, start, { code: 'abc' }, `${SITZUNG_COOKIE}=${sitzung}`);
      expect(String(antwort.headers.location)).toContain('/mehr/profil?google=fremd');
      expect(googleSub(ada)).toBe('sub-fremd');
      expect(googleSub(berta)).toBeNull();
      const eigene = oeffneSitzung(new Date(), ada);
      const loesen = await app.inject({
        method: 'DELETE',
        url: '/api/zugang/google',
        headers: { cookie: `${SITZUNG_COOKIE}=${eigene}` },
      });
      expect(loesen.statusCode).toBe(204);
      expect(googleSub(ada)).toBeNull();
      verknuepfeGoogle(ada, 'sub-fremd', 'fremd@example.com');
    });
    schliesseZugang();
    const db = new DatabaseSync(aktuell);
    db.prepare('UPDATE benutzer SET salt = ?, hash = ? WHERE id = ?').run('', '', ada);
    db.close();
    verwendeZugang(aktuell);
    const ohne = oeffneSitzung(new Date(), ada);
    await mitRouten(async (app) => {
      const gesperrt = await app.inject({
        method: 'DELETE',
        url: '/api/zugang/google',
        headers: { cookie: `${SITZUNG_COOKIE}=${ohne}` },
      });
      expect(gesperrt.statusCode).toBe(409);
      expect(gesperrt.json()).toEqual({ fehler: LOESEN_GESPERRT });
      expect(googleSub(ada)).toBe('sub-fremd');
      const anonym = await app.inject({ method: 'DELETE', url: '/api/zugang/google' });
      expect(anonym.statusCode).toBe(401);
    });
    loescheBenutzer(ada);
    expect(googleSub(ada)).toBeNull();
    expect(verknuepfeGoogle(berta, 'sub-fremd', 'berta@example.com')).toBe('ok');
    expect(googleSchemaVersion()).toBe(1);
    schliesseZugang();
    verwendeZugang(aktuell);
    expect(googleSchemaVersion()).toBe(1);
    expect(googleSub(berta)).toBe('sub-fremd');
  });
});
