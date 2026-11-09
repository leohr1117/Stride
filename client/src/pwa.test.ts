import { afterEach, describe, expect, it, vi } from 'vitest';
import { meldeAnmeldungAbgelaufen } from './api/kern.ts';
import { beobachteAngebotAbmeldung } from './features/uebersicht/angebotStand.ts';
import {
  beobachteInstallation,
  installAnzeige,
  installGeraet,
  installHinweisWeg,
  laeuftAlsApp,
  wegklickenInstallHinweis,
  type InstallLage,
} from './pwa.ts';
import { leseSitzung, merkeSitzung } from './speicher.ts';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8)';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

function speicher(): Storage {
  const daten = new Map<string, string>();
  return {
    get length() {
      return daten.size;
    },
    clear() {
      daten.clear();
    },
    getItem(schluessel: string) {
      return daten.has(schluessel) ? (daten.get(schluessel) ?? null) : null;
    },
    key(index: number) {
      return [...daten.keys()][index] ?? null;
    },
    removeItem(schluessel: string) {
      daten.delete(schluessel);
    },
    setItem(schluessel: string, wert: string) {
      daten.set(schluessel, wert);
    },
  };
}

function fenster(standaloneAnzeige: boolean, iosStandalone: boolean): { local: Storage; session: Storage } {
  const local = speicher();
  const session = speicher();
  vi.stubGlobal('window', {
    localStorage: local,
    sessionStorage: session,
    addEventListener() {},
    matchMedia(query: string) {
      return { matches: query === '(display-mode: standalone)' && standaloneAnzeige };
    },
  });
  vi.stubGlobal('navigator', { standalone: iosStandalone, userAgent: WINDOWS, maxTouchPoints: 0 });
  return { local, session };
}

function lage(teil: Partial<InstallLage> = {}): InstallLage {
  return {
    laeuftAlsApp: false,
    installiert: false,
    ereignis: false,
    ios: false,
    mac: false,
    weggeklickt: false,
    bewertungSichtbar: false,
    hinweisSichtbar: false,
    ...teil,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('laeuftAlsApp', () => {
  it('erkennt display-mode standalone', () => {
    fenster(true, false);
    expect(laeuftAlsApp()).toBe(true);
  });

  it('erkennt navigator.standalone', () => {
    fenster(false, true);
    expect(laeuftAlsApp()).toBe(true);
  });

  it('ist aus, wenn weder Anzeige noch navigator.standalone gesetzt sind', () => {
    fenster(false, false);
    expect(laeuftAlsApp()).toBe(false);
  });
});

describe('Installationshinweis', () => {
  it('wählt einen der drei Fälle oder nichts', () => {
    expect(installAnzeige(lage({ ereignis: true }))).toEqual({ fall: 'ereignis', banner: true, zeile: true });
    expect(installAnzeige(lage({ ios: true }))).toEqual({ fall: 'ios', banner: true, zeile: true });
    expect(installAnzeige(lage({ mac: true }))).toEqual({ fall: 'mac', banner: true, zeile: true });
    expect(installAnzeige(lage({ ereignis: true, mac: true })).fall).toBe('ereignis');
    expect(installAnzeige(lage({ ereignis: true, ios: true })).fall).toBe('ereignis');
    expect(installAnzeige(lage())).toEqual({ fall: 'nichts', banner: false, zeile: false });

    expect(installGeraet(IPHONE, 0)).toEqual({ ios: true, mac: false });
    expect(installGeraet(IPAD, 0)).toEqual({ ios: true, mac: false });
    expect(installGeraet(MAC, 5)).toEqual({ ios: true, mac: false });
    expect(installGeraet(MAC, 0)).toEqual({ ios: false, mac: true });
    expect(installGeraet(ANDROID, 5)).toEqual({ ios: false, mac: false });
    expect(installGeraet(WINDOWS, 0)).toEqual({ ios: false, mac: false });
    const iphone = installGeraet(IPHONE, 0);
    expect(installAnzeige(lage(iphone)).fall).toBe('ios');
    const mac = installGeraet(MAC, 0);
    expect(installAnzeige(lage({ ...mac, ereignis: true })).fall).toBe('ereignis');
    expect(installAnzeige(lage(installGeraet(WINDOWS, 0))).fall).toBe('nichts');
  });

  it('setzt beim Wegklicken den Geräte-Merker und lässt ihn beim Abmelden stehen', () => {
    const { local, session } = fenster(false, false);
    expect(installHinweisWeg()).toBe(false);
    wegklickenInstallHinweis();
    expect(installHinweisWeg()).toBe(true);
    expect(local.getItem('stride.installHinweisWeg')).toBe('1');
    expect(session.getItem('stride.installHinweisWeg')).toBeNull();
    expect(leseSitzung('stride.installHinweisWeg')).toBe(false);

    merkeSitzung('stride.hinweisAngebot', true);
    beobachteInstallation();
    beobachteAngebotAbmeldung();
    meldeAnmeldungAbgelaufen();
    expect(leseSitzung('stride.hinweisAngebot')).toBe(false);
    expect(installHinweisWeg()).toBe(true);
    expect(local.getItem('stride.installHinweisWeg')).toBe('1');
  });

  it('lässt das Banner warten, solange Bewertung oder HinweisAngebot sichtbar sind', () => {
    const bereit = lage({ ereignis: true });
    expect(installAnzeige({ ...bereit, bewertungSichtbar: true })).toEqual({
      fall: 'ereignis',
      banner: false,
      zeile: true,
    });
    expect(installAnzeige({ ...bereit, hinweisSichtbar: true })).toEqual({
      fall: 'ereignis',
      banner: false,
      zeile: true,
    });
    expect(installAnzeige({ ...bereit, weggeklickt: true }).banner).toBe(false);
    expect(installAnzeige({ ...bereit, weggeklickt: true }).zeile).toBe(true);
  });

  it('zeigt nach der Installation weder Banner noch Zeile', () => {
    expect(installAnzeige(lage({ installiert: true, ereignis: true, ios: true }))).toEqual({
      fall: 'nichts',
      banner: false,
      zeile: false,
    });
    expect(installAnzeige(lage({ laeuftAlsApp: true, mac: true }))).toEqual({
      fall: 'nichts',
      banner: false,
      zeile: false,
    });
  });
});
