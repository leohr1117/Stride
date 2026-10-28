import type { NavigateFunction } from 'react-router';
import {
  istLeistenplatz,
  istUmlenkung,
  ketteUnter,
  pfadname,
  platzFuer,
  STAPEL_SCHLUESSEL,
  type NavLage,
  type NavStapel,
} from '../../shared/spiel/herkunft.ts';
import {
  anfangDesPlatzes,
  beiPop,
  ersetzeOben,
  oeffneImStapel,
  stapelAus,
  stapelNachLaden,
  wechslePlatz,
} from '../../shared/spiel/herkunftStapel.ts';

const STAND_SCHLUESSEL = 'stride.nav.stand';

interface HistorieZustand {
  usr?: unknown;
  key?: string;
  idx?: number;
}

interface Wartend {
  art: 'push' | 'replace';
  adresse: string;
}

let lage: NavLage = { leiste: [], seitenleiste: [], verlaufAn: true };
let nav: NavStapel = { aktiv: '/', orte: { '/': ['/'] } };
let kette: string[] = [];
let pending: Wartend | null = null;
let stapelSchon = false;
let sprungNachOben = false;
let historieIndex = 0;
let letzterSchlussel: string | null = null;
const hoerer = new Set<() => void>();

function speicher(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

function leseStandKarte(): Record<string, Record<string, unknown>> {
  try {
    const daten = JSON.parse(speicher()?.getItem(STAND_SCHLUESSEL) ?? 'null') as unknown;
    return typeof daten === 'object' && daten !== null ? (daten as Record<string, Record<string, unknown>>) : {};
  } catch {
    return {};
  }
}

function standSchluessel(adresse: string): string {
  return adresse.split('#')[0] ?? adresse;
}

export function standVon(adresse: string): Record<string, unknown> | null {
  return leseStandKarte()[standSchluessel(adresse)] ?? null;
}

function historie(): HistorieZustand {
  return (history.state ?? {}) as HistorieZustand;
}

function historyIdx(): number {
  const idx = historie().idx;
  return typeof idx === 'number' ? idx : 0;
}

function melde(): void {
  for (const zu of hoerer) zu();
}

function speichere(): void {
  speicher()?.setItem(STAPEL_SCHLUESSEL, JSON.stringify({ ...nav, kette }));
}

function schreibe(neu: NavStapel): void {
  nav = neu;
  speichere();
  melde();
}

function lade(): void {
  try {
    const daten = JSON.parse(speicher()?.getItem(STAPEL_SCHLUESSEL) ?? 'null') as { kette?: unknown } | null;
    const gelesen = stapelAus(daten);
    if (gelesen) nav = gelesen;
    if (daten && Array.isArray(daten.kette)) {
      kette = daten.kette.filter((eintrag): eintrag is string => typeof eintrag === 'string');
    }
  } catch {
    return;
  }
}

lade();

export function setzeNavLage(neu: NavLage): void {
  const seitenleiste = [...(neu.seitenleiste ?? [])];
  const leiste = [...neu.leiste];
  const verlaufAn = neu.verlaufAn !== false;
  if (
    leiste.join('\0') === lage.leiste.join('\0') &&
    seitenleiste.join('\0') === (lage.seitenleiste ?? []).join('\0') &&
    verlaufAn === (lage.verlaufAn !== false)
  ) {
    return;
  }
  lage = { leiste, seitenleiste, verlaufAn };
}

export function abonniereNav(zu: () => void): () => void {
  hoerer.add(zu);
  return () => hoerer.delete(zu);
}

export function liesAktiv(): string {
  return nav.aktiv;
}

export function liesStapel(): readonly string[] {
  return nav.orte[nav.aktiv] ?? [];
}

export function liesLage(): NavLage {
  return lage;
}

export function merkeStand(teil: Record<string, unknown>): void {
  const basis = historie();
  const bisher = (basis.usr ?? {}) as Record<string, unknown>;
  const neu = { ...bisher, ...teil };
  history.replaceState({ ...basis, usr: neu }, '');
  const adresse = `${location.pathname}${location.search}${location.hash}`;
  const karte = leseStandKarte();
  karte[standSchluessel(adresse)] = { ...(karte[standSchluessel(adresse)] ?? {}), ...teil };
  speicher()?.setItem(STAND_SCHLUESSEL, JSON.stringify(karte));
}

function scrolle(hash: string, state: unknown, oben: boolean, pop: boolean): void {
  if (!oben && hash) {
    const id = decodeURIComponent(hash.slice(1));
    const suche = (rest: number) => {
      const knoten = document.getElementById(id);
      if (knoten) {
        knoten.scrollIntoView({ block: 'center' });
        return;
      }
      if (rest > 0) requestAnimationFrame(() => suche(rest - 1));
    };
    suche(8);
    return;
  }
  const stand = state as { strideScroll?: unknown } | null;
  const y = oben ? 0 : stand && typeof stand.strideScroll === 'number' ? stand.strideScroll : pop ? null : 0;
  if (y === null) return;
  const setze = () => window.scrollTo(0, y);
  setze();
  requestAnimationFrame(setze);
}

if (typeof history !== 'undefined') history.scrollRestoration = 'manual';

function saehe(adresse: string): void {
  const unter = ketteUnter(adresse, lage);
  nav = stapelNachLaden(nav, adresse, platzFuer(adresse, lage));
  if (unter.length > 1 && historyIdx() === 0) {
    const basis = historie();
    const usr = basis.usr ?? null;
    const key = basis.key ?? 's';
    history.replaceState({ usr: null, key: `${key}a`, idx: 0 }, '', unter[0]);
    for (let index = 1; index < unter.length; index += 1) {
      const letzter = index === unter.length - 1;
      history.pushState(
        { usr: letzter ? usr : null, key: `${key}${index}`, idx: index },
        '',
        unter[index],
      );
    }
  }
  kette = unter;
  historieIndex = historyIdx();
  speichere();
  melde();
}

function ketteAuf(idx: number, adresse: string): void {
  if (idx < kette.length) {
    kette = kette.slice(0, idx + 1);
  }
  while (kette.length < idx) {
    kette.push(adresse);
  }
  if (kette.length === idx) {
    kette.push(adresse);
  }
  kette[idx] = adresse;
  kette = kette.slice(0, idx + 1);
}

export function vorigerPasst(ziel: string): boolean {
  const idx = historyIdx();
  const vor = kette[idx - 1];
  return vor !== undefined && pfadname(vor) === pfadname(ziel) && (vor.split('#')[0] ?? vor) === (ziel.split('#')[0] ?? ziel);
}

export function zurueckGehen(navigiere: NavigateFunction, ziel: string): void {
  if (vorigerPasst(ziel)) {
    navigiere(-1);
    return;
  }
  nav = beiPop(nav, ziel, platzFuer(ziel, lage));
  schreibe(nav);
  stapelSchon = true;
  const idx = historyIdx();
  ketteAuf(idx, ziel);
  speichere();
  navigiere(ziel, { replace: true, state: standVon(ziel) });
}

function nachPlatz(navigiere: NavigateFunction, adresse: string, art: 'push' | 'replace' | 'pop', schritte: number): void {
  stapelSchon = true;
  if (art === 'pop') {
    navigiere(-schritte);
    return;
  }
  const option = art === 'replace' ? { replace: true as const, state: standVon(adresse) } : { state: standVon(adresse) };
  if (art === 'replace') {
    kette = [kette[0] ?? '/', adresse];
  } else {
    kette = [...kette, adresse];
  }
  speichere();
  navigiere(adresse, option);
}

export function wechsleOderAnfang(platz: string, navigiere: NavigateFunction): void {
  const anfang = platz === nav.aktiv;
  const ergebnis = anfang ? anfangDesPlatzes(nav) : wechslePlatz(nav, platz);
  schreibe(ergebnis.nav);
  const adresse = ergebnis.adresse;
  const idx = historyIdx();
  const zielPfad = pfadname(adresse);
  if (anfang) {
    const hier = `${location.pathname}${location.search}`;
    if (pfadname(hier) === zielPfad && (adresse.split('#')[0] ?? adresse) === hier) {
      window.scrollTo(0, 0);
      merkeStand({ strideScroll: 0 });
      return;
    }
    sprungNachOben = true;
    const bei = kette.findIndex((eintrag) => pfadname(eintrag) === zielPfad);
    if (bei >= 0 && bei < idx) {
      stapelSchon = true;
      kette = kette.slice(0, bei + 1);
      speichere();
      navigiere(bei - idx);
      return;
    }
    stapelSchon = true;
    ketteAuf(idx, adresse);
    speichere();
    navigiere(adresse, { replace: true, state: { ...(standVon(adresse) ?? {}), strideScroll: 0 } });
    return;
  }
  if (platz === '/') {
    if (zielPfad === '/') {
      if (idx <= 0) {
        return;
      }
      kette = [kette[0] ?? '/'];
      speichere();
      nachPlatz(navigiere, '/', 'pop', idx);
      return;
    }
    if (idx <= 0) {
      nachPlatz(navigiere, adresse, 'push', 0);
      return;
    }
    pending = { art: 'push', adresse };
    kette = [kette[0] ?? '/'];
    speichere();
    nachPlatz(navigiere, '/', 'pop', idx);
    return;
  }
  if (idx <= 0) {
    nachPlatz(navigiere, adresse, 'push', 0);
    return;
  }
  if (idx === 1) {
    nachPlatz(navigiere, adresse, 'replace', 0);
    return;
  }
  pending = { art: 'replace', adresse };
  kette = [kette[0] ?? '/'];
  speichere();
  nachPlatz(navigiere, adresse, 'pop', idx - 1);
}

export function verarbeiteOrt(eingabe: {
  bereit: boolean;
  adresse: string;
  hash: string;
  state: unknown;
  key: string;
  typ: string;
  navigiere: NavigateFunction;
}): void {
  if (!eingabe.bereit || istUmlenkung(eingabe.adresse)) {
    return;
  }
  const idx = historyIdx();
  if (pending) {
    const wartend = pending;
    pending = null;
    stapelSchon = true;
    if (wartend.art === 'push') {
      kette = [...kette, wartend.adresse];
      eingabe.navigiere(wartend.adresse, { state: standVon(wartend.adresse) });
    } else {
      kette = [kette[0] ?? '/', wartend.adresse];
      eingabe.navigiere(wartend.adresse, { replace: true, state: standVon(wartend.adresse) });
    }
    speichere();
    letzterSchlussel = eingabe.key;
    historieIndex = idx;
    return;
  }
  if (letzterSchlussel === null) {
    letzterSchlussel = eingabe.key;
    historieIndex = idx;
    if (idx === 0) {
      saehe(eingabe.adresse);
    } else {
      if (kette.length === 0 || pfadname(kette.at(-1) ?? '') !== pfadname(eingabe.adresse)) {
        kette = ketteUnter(eingabe.adresse, lage);
      }
      nav = stapelNachLaden(nav, eingabe.adresse, platzFuer(eingabe.adresse, lage));
      speichere();
      melde();
    }
    scrolle(eingabe.hash, eingabe.state, false, true);
    return;
  }
  if (letzterSchlussel === eingabe.key) {
    return;
  }
  const vorIndex = historieIndex;
  letzterSchlussel = eingabe.key;
  historieIndex = idx;
  const oben = sprungNachOben;
  if (stapelSchon) {
    stapelSchon = false;
    sprungNachOben = false;
    scrolle(eingabe.hash, eingabe.state, oben, eingabe.typ === 'POP');
    if (oben) {
      merkeStand({ strideScroll: 0 });
    }
    return;
  }
  if (eingabe.typ === 'POP') {
    const platz = platzFuer(eingabe.adresse, lage);
    nav = idx < vorIndex ? beiPop(nav, eingabe.adresse, platz) : oeffneImStapel(nav, eingabe.adresse);
    ketteAuf(idx, eingabe.adresse);
    schreibe(nav);
    scrolle(eingabe.hash, eingabe.state, oben, true);
    sprungNachOben = false;
    return;
  }
  if (eingabe.typ === 'REPLACE') {
    nav = ersetzeOben(nav, eingabe.adresse);
  } else {
    nav = oeffneImStapel(nav, eingabe.adresse);
  }
  ketteAuf(idx, eingabe.adresse);
  schreibe(nav);
  scrolle(eingabe.hash, eingabe.state, false, false);
}

export function platzVonPfad(pathname: string): boolean {
  return istLeistenplatz(pathname, lage.leiste, lage.seitenleiste ?? []);
}
