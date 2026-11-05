import { useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { istSprache, localeFuer, spracheWaehlen, type Sprache } from '../../shared/sprache/kern.ts';
import { setzeAktiveSprache } from '../../shared/sprache/index.ts';
import { api, SCHLUESSEL } from './api/index.ts';
import { leseText, merkeText, vergiss } from './speicher.ts';

export const SPEICHER_SCHLUESSEL = 'stride-sprache';

interface SpracheWert {
  sprache: Sprache;
  waehle: (sprache: Sprache) => void;
  uebernehme: (gespeichert: Sprache | null, erzwingen?: boolean) => void;
}

const SpracheKontext = createContext<SpracheWert | null>(null);

function browserSprachen(): string[] {
  if (typeof navigator === 'undefined') {
    return [];
  }
  if (navigator.languages.length > 0) {
    return [...navigator.languages];
  }
  return navigator.language ? [navigator.language] : [];
}

export function gespeicherterHinweis(): Sprache | null {
  const wert = leseText(SPEICHER_SCHLUESSEL);
  return istSprache(wert) ? wert : null;
}

export function merkeHinweis(sprache: Sprache | null): void {
  if (sprache) {
    merkeText(SPEICHER_SCHLUESSEL, sprache);
    return;
  }
  vergiss(SPEICHER_SCHLUESSEL);
}

function anfangsSprache(): Sprache {
  return spracheWaehlen(gespeicherterHinweis(), null, browserSprachen());
}

export function SpracheProvider({ children }: { children: ReactNode }) {
  const [sprache, setSprache] = useState<Sprache>(anfangsSprache);
  const eigeneWahl = useRef(false);
  setzeAktiveSprache(sprache);

  const waehle = useCallback((naechste: Sprache) => {
    eigeneWahl.current = true;
    setSprache(naechste);
    merkeHinweis(naechste);
  }, []);

  const uebernehme = useCallback((gespeichert: Sprache | null, erzwingen = false) => {
    if (!erzwingen && eigeneWahl.current) {
      return;
    }
    eigeneWahl.current = false;
    const naechste = spracheWaehlen(null, gespeichert, browserSprachen());
    setSprache(naechste);
    merkeHinweis(gespeichert);
  }, []);

  useEffect(() => {
    document.documentElement.lang = localeFuer(sprache);
  }, [sprache]);

  const wert = useMemo(() => ({ sprache, waehle, uebernehme }), [sprache, waehle, uebernehme]);
  return (
    <SpracheKontext.Provider value={wert}>
      <SprachRahmen key={sprache}>{children}</SprachRahmen>
    </SpracheKontext.Provider>
  );
}

/** Die aktive Sprache liegt im Modul. Ein Wechsel baut die Oberfläche neu auf. */
function SprachRahmen({ children }: { children: ReactNode }) {
  return children;
}

export function useSprache(): SpracheWert {
  const wert = useContext(SpracheKontext);
  if (!wert) {
    throw new Error('SpracheProvider fehlt.');
  }
  return wert;
}

/** Übernimmt die gespeicherte Sprache, sobald die Einstellungen da sind. */
export function SpracheAbgleich() {
  const { data } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const { uebernehme } = useSprache();
  useEffect(() => {
    if (!data) {
      return;
    }
    uebernehme(data.sprache);
  }, [data, data?.sprache, uebernehme]);
  return null;
}
