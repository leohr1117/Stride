import { useLayoutEffect, useSyncExternalStore, type MouseEvent } from 'react';
import { useLocation, useNavigate, useNavigationType, type NavigateFunction } from 'react-router';
import { herkunftsZiel, pfadname, type ZurueckZiel } from '../../shared/spiel/herkunft.ts';
import { pfadAktiv } from '../../shared/spiel/sichtbarkeit.ts';
import { vorbilderListePfad } from './features/vorbilder/vorbilderAuswahl.ts';
import { useEbenen, useFunktionen } from './funktionen.ts';
import {
  abonniereNav,
  liesAktiv,
  liesLage,
  liesStapel,
  merkeStand,
  platzVonPfad,
  verarbeiteOrt,
  wechsleOderAnfang,
  zurueckGehen,
} from './herkunftLauf.ts';

function zielAdresse(ziel: ZurueckZiel): string {
  const pfad = ziel.pfad;
  if (pfadname(pfad) === '/vorbilder' && !pfad.includes('?')) {
    return vorbilderListePfad();
  }
  return pfad;
}

export function useAktiverPlatz(): string {
  return useSyncExternalStore(abonniereNav, liesAktiv, liesAktiv);
}

export function useVerlauf(bereit: boolean): void {
  const ort = useLocation();
  const typ = useNavigationType();
  const navigiere = useNavigate();
  const adresse = `${ort.pathname}${ort.search}${ort.hash}`;

  useLayoutEffect(() => {
    verarbeiteOrt({
      bereit,
      adresse,
      hash: ort.hash,
      state: ort.state,
      key: ort.key,
      typ,
      navigiere,
    });
  }, [adresse, bereit, navigiere, ort.hash, ort.key, ort.state, typ]);
}

export function useZurueck(standard: ZurueckZiel | null): ZurueckZiel | null {
  const ort = useLocation();
  const stapel = useSyncExternalStore(abonniereNav, liesStapel, liesStapel);
  const funktionen = useFunktionen();
  const ebenen = useEbenen();
  const lage = liesLage();
  const roh = herkunftsZiel(stapel, `${ort.pathname}${ort.search}${ort.hash}`, lage.leiste, standard, lage);
  const sichtbar = { funktionen, ebenen };
  const ziel = roh ? { ...roh, pfad: zielAdresse(roh) } : null;
  if (ziel && pfadAktiv(ziel.pfad, sichtbar)) {
    return ziel;
  }
  if (standard && pfadAktiv(standard.pfad, sichtbar)) {
    return { ...standard, pfad: zielAdresse(standard) };
  }
  if (!ziel) {
    return null;
  }
  return { pfad: '/', label: 'Heute' };
}

export function geheZurueck(navigiere: NavigateFunction, ziel: string): void {
  zurueckGehen(navigiere, zielAdresse({ pfad: ziel, label: '' }));
}

/** Ein Leistenplatz ohne Anker wechselt den Platz. Der Pfeil bleibt unangetastet. */
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
  if (url.origin !== window.location.origin) {
    return;
  }
  merkeStand({ strideScroll: window.scrollY });
  if (link.hasAttribute('data-zurueck') || url.hash || !platzVonPfad(url.pathname)) {
    return;
  }
  ereignis.preventDefault();
  ereignis.stopPropagation();
  wechsleOderAnfang(url.pathname, navigiere);
}
