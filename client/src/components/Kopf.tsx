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
import { Link, useLocation, useNavigate } from 'react-router';
import { pfadname } from '../../../shared/spiel/herkunft.ts';
import { LEISTE_STANDARD, sichtbareLeiste } from '../../../shared/spiel/leiste.ts';
import { ZIEL_FRAGE } from '../../../shared/spiel/profil.ts';
import { api, SCHLUESSEL } from '../api/index.ts';
import { useEbenen, useFunktionen } from '../funktionen.ts';
import { geheZurueck, useZurueck } from '../herkunft.tsx';
import { tx } from '../text.ts';
import { InfoHinweis } from '../ui/index.ts';
import { KlassenBild } from './KlassenBild.tsx';

export interface KopfAngabe {
  /** Deutscher Schlüssel, außer `roh`. */
  titel: string;
  info?: string;
  /** Nutzertext, nicht übersetzen. */
  roh?: boolean;
}

const KopfSetzen = createContext<(wert: KopfAngabe | null) => void>(() => {});
const KopfLesen = createContext<KopfAngabe | null>(null);

const SEITENTITEL: Record<string, string> = {
  '/': 'Übersicht',
  '/ziele': 'Ziele',
  '/laufend': 'Laufend',
  '/chronik': 'Chronik',
  '/rueckblick': 'Rückblick',
  '/statistiken': 'Statistiken',
  '/basis': 'Basis',
  '/vorbilder': 'Vorbilder',
  '/handbuch': 'Handbuch',
  '/mehr': 'Mehr',
  '/charakter': 'Profil',
  '/mehr/profil': 'Profil',
  '/mehr/profil/name': 'Profilname',
  '/mehr/profil/titel': 'Titel',
  '/mehr/profil/jahr': 'Geburtsjahr',
  '/mehr/profil/ziel': ZIEL_FRAGE,
  '/mehr/profil/fokus': 'Fokus',
  '/mehr/profil/passwort': 'Passwort',
  '/mehr/profil/accounts': 'Accounts',
  '/mehr/profil/benutzernamen': 'Benutzernamen',
  '/mehr/profil/stufen': 'Ziel-Stufen',
  '/mehr/inhalte': 'Tätigkeiten',
  '/mehr/inhalte/verbindungen': 'Verbindungen',
  '/mehr/darstellung': 'Darstellung',
  '/mehr/darstellung/leiste': 'Leiste',
  '/mehr/darstellung/paletten': 'Paletten',
  '/mehr/uebersicht': 'Übersicht',
  '/mehr/funktionen': 'App & Verbindungen',
  '/mehr/benachrichtigungen': 'Benachrichtigungen',
  '/mehr/daten': 'Daten',
};

function standardTitel(pfad: string): string {
  const rein = pfadname(pfad);
  const fest = SEITENTITEL[rein];
  if (fest) {
    return fest;
  }
  if (/^\/projekte\/[^/]+$/.test(rein)) {
    return 'Projekt';
  }
  if (/^\/faehigkeiten\/[^/]+$/.test(rein)) {
    return 'Fähigkeit';
  }
  if (/^\/vorbilder\/[^/]+$/.test(rein)) {
    return 'Vorbild';
  }
  if (/^\/mehr\/profil\/benutzernamen\/[^/]+$/.test(rein)) {
    return 'Benutzername';
  }
  return '';
}

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
  const setze = useCallback((wert: KopfAngabe | null) => {
    setAngabe((bisher) => (gleicheAngabe(bisher, wert) ? bisher : wert));
  }, []);
  return (
    <KopfSetzen.Provider value={setze}>
      <KopfLesen.Provider value={angabe}>{children}</KopfLesen.Provider>
    </KopfSetzen.Provider>
  );
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

function ringFarbe(anteil: number): string {
  const begrenzt = Math.min(1, Math.max(0, anteil));
  const mischung = Math.round(18 + begrenzt * 82);
  // Bis U8 dieselbe Mischfarbe wie der große Levelring, noch nicht --fortschritt.
  return `color-mix(in srgb, var(--akzent) ${mischung}%, var(--haupt))`;
}

function DuennRing({ anteil, kinder }: { anteil: number; kinder: ReactNode }) {
  const begrenzt = Math.min(1, Math.max(0, anteil));
  const radius = 17;
  const umfang = 2 * Math.PI * radius;
  return (
    <span className="relative flex size-9 items-center justify-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 size-9" aria-hidden="true">
        <circle cx="18" cy="18" r={radius} fill="none" stroke="var(--flaeche-2)" strokeWidth="2" />
        {begrenzt > 0 && (
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke={ringFarbe(begrenzt)}
            strokeWidth="2"
            strokeDasharray={`${umfang * begrenzt} ${umfang}`}
            transform="rotate(-90 18 18)"
          />
        )}
      </svg>
      {kinder}
    </span>
  );
}

export function Kopf() {
  const { pathname } = useLocation();
  const navigiere = useNavigate();
  const ziel = useZurueck(null);
  const angabe = useContext(KopfLesen);
  const funktionen = useFunktionen();
  const ebenen = useEbenen();
  const kopf = useRef<HTMLElement>(null);
  const einstellungen = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const { data: uebersicht } = useQuery({ queryKey: SCHLUESSEL.uebersicht, queryFn: api.uebersicht });
  const leiste = sichtbareLeiste(einstellungen.data?.mobilLeiste ?? LEISTE_STANDARD, funktionen, ebenen);
  const profilInLeiste = leiste.includes('/charakter');
  const titel = angabe?.roh ? (angabe.titel ?? '') : tx(angabe?.titel ?? standardTitel(pathname));

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
      <div className="flex h-14 min-w-0 items-center gap-1 px-4 md:px-8">
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
          {angabe?.info ? <InfoHinweis text={angabe.info} /> : null}
        </div>
        {!ziel && !profilInLeiste && uebersicht && (
          <Link
            to="/charakter"
            aria-label={tx('Profil, Level {level}', { level: uebersicht.level.level })}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full"
          >
            <DuennRing anteil={uebersicht.level.fortschritt} kinder={<KlassenBild klasse={uebersicht.klasse} groesse="size-8" />} />
          </Link>
        )}
      </div>
    </header>
  );
}
