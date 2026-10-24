import { tx } from './text.ts';
import { useEffect, useRef, type MouseEvent } from 'react';
import { useLocation, useNavigate, useNavigationType, type NavigateFunction } from 'react-router';
import { elternZiel, herkunftsZiel, istHauptseite, zurueckPasst, type ZurueckZiel } from '../../shared/spiel/herkunft.ts';
import { pfadAktiv } from '../../shared/spiel/sichtbarkeit.ts';
import { useEbenen, useFunktionen } from './funktionen.ts';
import { vorbilderListePfad } from './features/vorbilder/vorbilderAuswahl.ts';

const WURZEL_SCHLUESSEL = 'ascend.nav.wurzel';
const HAUPT_SCHLUESSEL = 'ascend.nav.haupt';

function zielAdresse(ziel: ZurueckZiel): string {
  return ziel.pfad === '/vorbilder' ? vorbilderListePfad() : ziel.pfad;
}

function merkeHauptseite(pfad: string): void {
  try {
    sessionStorage.setItem(WURZEL_SCHLUESSEL, pfad);
    sessionStorage.setItem(HAUPT_SCHLUESSEL, '1');
  } catch {
    return;
  }
}

function merkeUnterseite(): void {
  try {
    sessionStorage.setItem(HAUPT_SCHLUESSEL, '0');
  } catch {
    return;
  }
}

function gespeicherteWurzel(): string | null {
  try {
    if (sessionStorage.getItem(HAUPT_SCHLUESSEL) !== '1') {
      return null;
    }
    return sessionStorage.getItem(WURZEL_SCHLUESSEL);
  } catch {
    return null;
  }
}

function kamPerZurueck(): boolean {
  const eintrag = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  return eintrag?.type === 'back_forward';
}

/** Tab-Wechsel macht diese Hauptseite zum neuen Ausgangspunkt. */
export function setzeHauptseite(navigiere: NavigateFunction, pfad: string, zustand?: unknown): void {
  navigiere(pfad, zustand === undefined ? { replace: true } : { replace: true, state: zustand });
}

export function klickeHauptseite(ereignis: MouseEvent, navigiere: NavigateFunction): void {
  if (ereignis.defaultPrevented || ereignis.button !== 0) {
    return;
  }
  if (ereignis.metaKey || ereignis.ctrlKey || ereignis.shiftKey || ereignis.altKey) {
    return;
  }
  const ziel = ereignis.target;
  if (!(ziel instanceof Element)) {
    return;
  }
  const link = ziel.closest('a[href]');
  if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download')) {
    return;
  }
  if (link.target && link.target !== '_self') {
    return;
  }
  const url = new URL(link.href, window.location.origin);
  if (url.origin !== window.location.origin || !istHauptseite(url.pathname)) {
    return;
  }
  if (url.pathname === window.location.pathname) {
    if (url.hash && url.hash !== window.location.hash) {
      return;
    }
    ereignis.preventDefault();
    ereignis.stopPropagation();
    return;
  }
  ereignis.preventDefault();
  ereignis.stopPropagation();
  const herkunft = link.getAttribute('data-herkunft');
  setzeHauptseite(navigiere, `${url.pathname}${url.search}`, herkunft ? { herkunft } : undefined);
}

/** Hält Browser-Zurück auf der Elternseite und macht Hauptseiten zur Wurzel. */
export function useVerlauf(): void {
  const ort = useLocation();
  const typ = useNavigationType();
  const navigiere = useNavigate();
  const vorher = useRef(ort.pathname);
  const korrekturen = useRef(0);
  const erster = useRef(true);

  useEffect(() => {
    const hier = `${ort.pathname}${ort.search}`;
    const korrigiere = (pfad: string) => {
      korrekturen.current += 1;
      if (korrekturen.current > 6) {
        return;
      }
      navigiere(pfad, { replace: true });
    };
    if (erster.current) {
      erster.current = false;
      const wurzel = gespeicherteWurzel();
      if (kamPerZurueck() && wurzel && !istHauptseite(ort.pathname) && wurzel !== hier) {
        korrigiere(wurzel);
        return;
      }
    }
    // Der erste Seitenaufruf meldet POP, obwohl niemand zurückgegangen ist.
    if (typ === 'POP' && vorher.current !== ort.pathname) {
      const von = vorher.current;
      if (istHauptseite(von) && ort.pathname !== von) {
        korrigiere(von);
        return;
      }
      const eltern = elternZiel(von);
      if (eltern && !zurueckPasst(von, ort.pathname)) {
        vorher.current = eltern.pfad;
        korrigiere(zielAdresse(eltern));
        return;
      }
    }
    korrekturen.current = 0;
    vorher.current = ort.pathname;
    if (istHauptseite(ort.pathname)) {
      merkeHauptseite(hier);
    } else {
      merkeUnterseite();
    }
  }, [navigiere, ort.pathname, ort.search, ort.key, typ]);
}

export function useZurueck(standard: ZurueckZiel | null): ZurueckZiel | null {
  const { pathname } = useLocation();
  const funktionen = useFunktionen();
  const ebenen = useEbenen();
  const roh = herkunftsZiel([], pathname, [], standard);
  const ziel = roh ? { ...roh, pfad: zielAdresse(roh) } : null;
  const sichtbarkeit = { funktionen, ebenen };
  if (!ziel || pfadAktiv(ziel.pfad, sichtbarkeit)) {
    return ziel;
  }
  if (standard && pfadAktiv(standard.pfad, sichtbarkeit)) {
    return { ...standard, pfad: zielAdresse(standard) };
  }
  return { pfad: '/', label: tx("Übersicht") };
}
