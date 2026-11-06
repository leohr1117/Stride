import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router';
import { LEISTE_STANDARD, sichtbareLeiste } from '../../../shared/spiel/leiste.ts';
import { api, SCHLUESSEL } from '../api/index.ts';
import { useEbenen, useFunktionen } from '../funktionen.ts';
import { geheZurueck, useZurueck } from '../herkunft.tsx';
import { standardTitel } from '../seitentitel.ts';
import { tx } from '../text.ts';
import { InfoHinweis } from '../ui/index.ts';
import { ProfilBild } from './ProfilBild.tsx';

export interface KopfAngabe {
  /** Deutscher Schlüssel, außer `roh`. */
  titel: string;
  info?: string;
  /** Nutzertext, nicht übersetzen. */
  roh?: boolean;
}

const KopfSetzen = createContext<(wert: KopfAngabe | null) => void>(() => {});
const KopfLesen = createContext<KopfAngabe | null>(null);
const KopfSlotSetzen = createContext<(knoten: HTMLElement | null) => void>(() => {});
const KopfSlotLesen = createContext<HTMLElement | null>(null);

function gleicheAngabe(links: KopfAngabe | null, rechts: KopfAngabe | null): boolean {
  if (links === rechts) {
    return true;
  }
  if (!links || !rechts) {
    return false;
  }
  return links.titel === rechts.titel && links.info === rechts.info && links.roh === rechts.roh;
}

export function KopfRahmen({ children }: { children: ReactNode }) {
  const [angabe, setAngabe] = useState<KopfAngabe | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const setze = useCallback((wert: KopfAngabe | null) => {
    setAngabe((bisher) => (gleicheAngabe(bisher, wert) ? bisher : wert));
  }, []);
  const setzeSlot = useCallback((knoten: HTMLElement | null) => {
    setSlot((bisher) => (bisher === knoten ? bisher : knoten));
  }, []);
  return (
    <KopfSetzen.Provider value={setze}>
      <KopfSlotSetzen.Provider value={setzeSlot}>
        <KopfLesen.Provider value={angabe}>
          <KopfSlotLesen.Provider value={slot}>{children}</KopfSlotLesen.Provider>
        </KopfLesen.Provider>
      </KopfSlotSetzen.Provider>
    </KopfSetzen.Provider>
  );
}

/** Seite legt eine Aktion links neben den Profilring. Der leere Platz erzeugt keine Box. */
export function KopfAktion({ children }: { children: ReactNode }) {
  const slot = useContext(KopfSlotLesen);
  if (!slot) {
    return null;
  }
  return createPortal(children, slot);
}

/** Seite setzt den Titel im Kopf. Ohne Aufruf gilt der Seitentitel der Route. */
export function useKopf(angabe: KopfAngabe | null): void {
  const setze = useContext(KopfSetzen);
  const titel = angabe?.titel ?? null;
  const info = angabe?.info;
  const roh = angabe?.roh === true;
  useLayoutEffect(() => {
    setze(titel ? { titel, info, roh } : null);
    return () => setze(null);
  }, [info, roh, setze, titel]);
}

function DuennRing({ anteil, kinder }: { anteil: number; kinder: ReactNode }) {
  const begrenzt = Math.min(1, Math.max(0, anteil));
  const radius = 17;
  const umfang = 2 * Math.PI * radius;
  const startKraft = Math.round(58 + begrenzt * 18);
  // Derselbe Verlauf wie am großen Levelring: blass am Anfang, kräftig an der Spitze.
  const verlauf = `conic-gradient(from 0deg, rgb(0 0 0 / ${startKraft}%) 0deg, #000 ${begrenzt * 360}deg, transparent ${begrenzt * 360}deg)`;
  return (
    <span className="relative flex size-9 items-center justify-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 size-9" aria-hidden="true">
        <circle cx="18" cy="18" r={radius} fill="none" stroke="var(--flaeche-2)" strokeWidth="2" />
      </svg>
      <svg
        viewBox="0 0 36 36"
        className="absolute inset-0 size-9"
        aria-hidden="true"
        data-kopfverlauf=""
        style={{ maskImage: verlauf, WebkitMaskImage: verlauf }}
      >
        <circle
          data-kopfring=""
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="var(--fortschritt)"
          strokeWidth="2"
          strokeDasharray={`${umfang * begrenzt} ${umfang}`}
          transform="rotate(-90 18 18)"
        />
      </svg>
      {kinder}
    </span>
  );
}

function useIstPc(): boolean {
  const [pc, setPc] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const medien = window.matchMedia('(min-width: 768px)');
    const setze = () => setPc(medien.matches);
    setze();
    medien.addEventListener('change', setze);
    return () => medien.removeEventListener('change', setze);
  }, []);
  return pc;
}

export function Kopf() {
  const pc = useIstPc();
  const { pathname } = useLocation();
  const navigiere = useNavigate();
  const ziel = useZurueck(null);
  const angabe = useContext(KopfLesen);
  const setzeSlot = useContext(KopfSlotSetzen);
  const slotRef = useCallback(
    (knoten: HTMLDivElement | null) => {
      setzeSlot(knoten);
    },
    [setzeSlot],
  );
  const funktionen = useFunktionen();
  const ebenen = useEbenen();
  const kopf = useRef<HTMLElement>(null);
  const einstellungen = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const { data: uebersicht } = useQuery({ queryKey: SCHLUESSEL.uebersicht, queryFn: api.uebersicht });
  const leiste = sichtbareLeiste(einstellungen.data?.mobilLeiste ?? LEISTE_STANDARD, funktionen, ebenen);
  const profilInLeiste = leiste.includes('/charakter');
  const titel = angabe?.roh ? (angabe.titel ?? '') : tx(angabe?.titel ?? standardTitel(pathname));

  useEffect(() => () => setzeSlot(null), [setzeSlot]);

  useEffect(() => {
    const knoten = kopf.current;
    if (!knoten) {
      return;
    }
    const setzen = () => {
      document.documentElement.style.setProperty('--mobilkopf-hoehe', `${knoten.getBoundingClientRect().height}px`);
    };
    setzen();
    const beobachter = new ResizeObserver(setzen);
    beobachter.observe(knoten);
    return () => {
      beobachter.disconnect();
      document.documentElement.style.removeProperty('--mobilkopf-hoehe');
    };
  }, []);

  const klick = (ereignis: MouseEvent<HTMLAnchorElement>) => {
    if (ereignis.button !== 0 || ereignis.metaKey || ereignis.ctrlKey || ereignis.shiftKey || ereignis.altKey || !ziel) {
      return;
    }
    ereignis.preventDefault();
    geheZurueck(navigiere, ziel.pfad);
  };

  return (
    <header
      ref={kopf}
      data-kopf=""
      className="mobilkopf sticky top-0 z-30 border-b border-rand bg-grund/90 pt-[env(safe-area-inset-top)] backdrop-blur md:static md:z-auto md:bg-transparent md:pt-0 md:backdrop-blur-none"
    >
      <div className="inhalt-rand flex h-14 min-w-0 items-center gap-1">
        <div className="flex min-w-0 flex-1 items-center">
          {ziel && (
            <Link
              to={ziel.pfad}
              data-zurueck=""
              aria-label={tx('Zurück zu {ziel}', { ziel: tx(ziel.label) })}
              onClick={klick}
              className="inline-flex size-12 shrink-0 items-center justify-center rounded-full text-haupt"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </Link>
          )}
          {titel && (
            <h1 className="min-w-0 truncate text-xl leading-7 font-semibold" title={titel}>
              {titel}
            </h1>
          )}
          {angabe?.info ? <InfoHinweis text={angabe.info} name={angabe.titel} /> : null}
        </div>
        <div ref={slotRef} className="flex shrink-0 items-center empty:contents" data-kopf-aktion="" />
        {!ziel && !profilInLeiste && uebersicht && (
          <Link
            to="/charakter"
            aria-label={tx('Profil, Level {level}', { level: uebersicht.level.level })}
            title={pc ? tx('Profil · Level {level}', { level: uebersicht.level.level }) : undefined}
            className="profilziel inline-flex size-12 shrink-0 items-center justify-center"
          >
            <DuennRing anteil={uebersicht.level.fortschritt} kinder={<ProfilBild klasse={uebersicht.klasse} groesse="size-8" />} />
          </Link>
        )}
      </div>
    </header>
  );
}
