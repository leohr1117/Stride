import { istIosGeraet } from './features/mehr/hinweisGeraet.ts';
import { leseMerker, leseSitzungszahl, merke, merkeSitzungszahl } from './speicher.ts';

const SERVICE_WORKER = '/sw.js';
const NEU_GELADEN_SCHLUESSEL = 'stride.neuGeladen';
const NEU_LADEN_SPERRE_MS = 10_000;
const INSTALL_HINWEIS_WEG = 'stride.installHinweisWeg';
const MAC = /Macintosh|Mac OS X/;

export function registriereServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return;
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SERVICE_WORKER).catch((fehler: unknown) => {
      console.error('Service Worker konnte nicht registriert werden.', fehler);
    });
  });
}

export function ladeBeiVeraltetenDateienNeu(): void {
  window.addEventListener('vite:preloadError', (ereignis) => {
    const zuletzt = leseSitzungszahl(NEU_GELADEN_SCHLUESSEL);
    if (zuletzt !== null && Date.now() - zuletzt < NEU_LADEN_SPERRE_MS) {
      return;
    }
    ereignis.preventDefault();
    merkeSitzungszahl(NEU_GELADEN_SCHLUESSEL, Date.now());
    window.location.reload();
  });
}

export function laeuftAlsApp(): boolean {
  const fenster = globalThis.window;
  const nav = globalThis.navigator as (Navigator & { standalone?: boolean }) | undefined;
  const anzeige =
    typeof fenster?.matchMedia === 'function' && fenster.matchMedia('(display-mode: standalone)').matches;
  return anzeige || nav?.standalone === true;
}

export function installGeraet(userAgent: string, maxTouchPoints: number): { ios: boolean; mac: boolean } {
  const ios = istIosGeraet(userAgent, maxTouchPoints);
  return { ios, mac: !ios && MAC.test(userAgent) };
}

export type InstallFall = 'ereignis' | 'ios' | 'mac' | 'nichts';

export interface InstallLage {
  laeuftAlsApp: boolean;
  installiert: boolean;
  ereignis: boolean;
  ios: boolean;
  mac: boolean;
  weggeklickt: boolean;
  bewertungSichtbar: boolean;
  hinweisSichtbar: boolean;
}

export interface InstallAnzeige {
  fall: InstallFall;
  banner: boolean;
  zeile: boolean;
}

export function installAnzeige(lage: InstallLage): InstallAnzeige {
  if (lage.laeuftAlsApp || lage.installiert) {
    return { fall: 'nichts', banner: false, zeile: false };
  }
  const fall: InstallFall = lage.ereignis ? 'ereignis' : lage.ios ? 'ios' : lage.mac ? 'mac' : 'nichts';
  if (fall === 'nichts') {
    return { fall, banner: false, zeile: false };
  }
  const wartet = lage.bewertungSichtbar || lage.hinweisSichtbar;
  return { fall, banner: !lage.weggeklickt && !wartet, zeile: true };
}

export function installHinweisWeg(): boolean {
  return leseMerker(INSTALL_HINWEIS_WEG);
}

export function wegklickenInstallHinweis(): void {
  merke(INSTALL_HINWEIS_WEG, true);
}

export interface InstallStand {
  ereignis: boolean;
  installiert: boolean;
}

interface InstallAufforderung extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

let gespeichert: InstallAufforderung | null = null;
let installiert = false;
let oeffentlich: InstallStand = { ereignis: false, installiert: false };
const hoerer = new Set<() => void>();
let beobachtet = false;

function istAufforderung(ereignis: Event): ereignis is InstallAufforderung {
  const kandidat = ereignis as Event & { prompt?: unknown; userChoice?: unknown };
  const wahl = kandidat.userChoice;
  const istWahl = typeof wahl === 'object' && wahl !== null && 'then' in wahl;
  return typeof kandidat.prompt === 'function' && istWahl;
}

function veroeffentliche(): void {
  const naechstes: InstallStand = { ereignis: gespeichert !== null, installiert };
  if (naechstes.ereignis === oeffentlich.ereignis && naechstes.installiert === oeffentlich.installiert) {
    return;
  }
  oeffentlich = naechstes;
  for (const fn of hoerer) {
    fn();
  }
}

function beiAufforderung(ereignis: Event): void {
  ereignis.preventDefault();
  if (!istAufforderung(ereignis) || installiert || laeuftAlsApp()) {
    return;
  }
  gespeichert = ereignis;
  veroeffentliche();
}

function beiInstalliert(): void {
  gespeichert = null;
  installiert = true;
  veroeffentliche();
}

export function beobachteInstallation(): void {
  if (beobachtet || typeof window === 'undefined') {
    return;
  }
  beobachtet = true;
  const aufforderung: string = 'beforeinstallprompt';
  const fertig: string = 'appinstalled';
  window.addEventListener(aufforderung, beiAufforderung);
  window.addEventListener(fertig, beiInstalliert);
}

export function liesInstallStand(): InstallStand {
  return oeffentlich;
}

export function abonniereInstallation(fn: () => void): () => void {
  hoerer.add(fn);
  return () => {
    hoerer.delete(fn);
  };
}

export async function installationAnbieten(): Promise<void> {
  const aufforderung = gespeichert;
  if (!aufforderung) {
    return;
  }
  gespeichert = null;
  try {
    await aufforderung.prompt();
    const wahl = await aufforderung.userChoice;
    if (wahl.outcome === 'accepted') {
      installiert = true;
    }
  } catch (fehler: unknown) {
    console.error('Installation konnte nicht gestartet werden.', fehler);
  }
  veroeffentliche();
}
