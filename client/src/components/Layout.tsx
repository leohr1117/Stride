import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Plus, Settings } from 'lucide-react';
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { api, SCHLUESSEL } from '../api/index.ts';
import { useEbenen, useFunktionen } from '../funktionen.ts';
import { seiteZeigtEigenenZurueck } from '../../../shared/spiel/herkunft.ts';
import { LEISTE_STANDARD, leistenMitte, sichtbareLeiste, zurueckFuerSeite } from '../../../shared/spiel/leiste.ts';
import { istAn, pfadAktiv } from '../../../shared/spiel/sichtbarkeit.ts';
import { EINSTELLUNGEN, HANDBUCH, navAusLeiste, sichtbareGruppen, type NavEintrag } from '../navigation.ts';
import { AbgleichBeimOeffnen } from '../abgleichBeimOeffnen.tsx';
import { useStilAbgleich } from '../features/darstellung/stil.ts';
import type { EintragVorgabe } from '../features/eintraege/EintragDialog.tsx';

const EintragDialog = lazy(() => import('../features/eintraege/EintragDialog.tsx').then((modul) => ({ default: modul.EintragDialog })));
import { KlassenBild } from './KlassenBild.tsx';
import { einfuehrungZurueck, profilFragenOffen } from '../../../shared/spiel/profil.ts';
import { klickeHauptseite, useVerlauf, useZurueck } from '../herkunft.tsx';
import { leseSitzung, merkeSitzung, vergiss } from '../speicher.ts';
import { Einfuehrung, SprachStart } from './Einfuehrung.tsx';
import { ProfilErstellung } from './ProfilErstellung.tsx';
import { klassenText, tx } from '../text.ts';
import { Fehlermeldung, Fortschrittsbalken, Ladeanzeige } from '../ui/index.ts';
import { ZurueckZumMehr } from './ZurueckZumMehr.tsx';

const EintragOeffnenKontext = createContext<((vorgabe?: EintragVorgabe) => void) | null>(null);

export function useEintragOeffnen(): (vorgabe?: EintragVorgabe) => void {
  const oeffnen = useContext(EintragOeffnenKontext);
  if (!oeffnen) {
    throw new Error('useEintragOeffnen muss innerhalb von <Layout> verwendet werden.');
  }
  return oeffnen;
}

function navKlasse({ isActive }: { isActive: boolean }): string {
  return isActive ? 'text-haupt' : 'text-leise hover:text-haupt';
}

function vorgabeAusPfad(pathname: string): EintragVorgabe {
  const projekt = /^\/projekte\/(\d+)$/.exec(pathname);
  if (projekt) {
    return { projektId: Number(projekt[1]) };
  }
  const faehigkeit = /^\/faehigkeiten\/(\d+)$/.exec(pathname);
  if (faehigkeit) {
    return { faehigkeitId: Number(faehigkeit[1]) };
  }
  return {};
}

function EintragRahmen({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigiere = useNavigate();
  const [dialog, setDialog] = useState<{ offen: boolean; vorgabe: EintragVorgabe }>({ offen: false, vorgabe: {} });
  const oeffnen = useCallback(
    (vorgabe: EintragVorgabe = {}) => setDialog({ offen: true, vorgabe: { ...vorgabeAusPfad(pathname), ...vorgabe } }),
    [pathname],
  );
  const schliessen = useCallback(() => setDialog((aktuell) => ({ ...aktuell, offen: false })), []);

  return (
    <EintragOeffnenKontext.Provider value={oeffnen}>
      <div onClickCapture={(ereignis) => klickeHauptseite(ereignis, navigiere)}>
        {children}
        <Suspense fallback={null}>
          <EintragDialog offen={dialog.offen} vorgabe={dialog.vorgabe} onSchliessen={schliessen} />
        </Suspense>
      </div>
    </EintragOeffnenKontext.Provider>
  );
}

export function Layout() {
  return (
    <EintragRahmen>
      <AppGeruest />
    </EintragRahmen>
  );
}

const EINFUEHRUNG_ALT = 'ascend.einfuehrung';
const FRAGEN_OFFEN = 'ascend.fragen.offen';
const EINFUEHRUNG_WEG = 'ascend.einfuehrung.weg';
const SPRACHE_WEG = 'ascend.sprache.weg';

function AppGeruest() {
  useStilAbgleich();
  useVerlauf();
  const { pathname } = useLocation();
  const einstellungen = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const client = useQueryClient();
  const zoneGemeldet = useRef<string | null>(null);
  const seiteBleibt = useRef(false);
  const [runde, setRunde] = useState(() => ({
    offen: leseSitzung(FRAGEN_OFFEN),
    weg: leseSitzung(EINFUEHRUNG_WEG),
    spracheWeg: leseSitzung(SPRACHE_WEG),
  }));

  useEffect(() => {
    vergiss(EINFUEHRUNG_ALT);
    const beiSeiteWeg = () => {
      seiteBleibt.current = true;
    };
    window.addEventListener('pagehide', beiSeiteWeg);
    return () => {
      window.removeEventListener('pagehide', beiSeiteWeg);
      if (seiteBleibt.current) {
        return;
      }
      merkeSitzung(FRAGEN_OFFEN, false);
      merkeSitzung(EINFUEHRUNG_WEG, false);
    };
  }, []);

  const daten = einstellungen.data;
  const offen = daten ? profilFragenOffen(daten) : null;
  const neu = offen !== null && einfuehrungZurueck(runde.offen, offen);
  const weg = neu ? false : runde.weg;
  const spracheWeg = neu ? false : runde.spracheWeg;
  if (offen !== null && offen !== runde.offen) {
    merkeSitzung(FRAGEN_OFFEN, offen);
    merkeSitzung(EINFUEHRUNG_WEG, weg);
    merkeSitzung(SPRACHE_WEG, spracheWeg);
    setRunde({ offen, weg, spracheWeg });
  }

  useEffect(() => {
    if (!daten) {
      return;
    }
    let aktuell = '';
    try {
      aktuell = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!aktuell || daten.zeitzone === aktuell || zoneGemeldet.current === aktuell) {
      return;
    }
    zoneGemeldet.current = aktuell;
    void api
      .aendereEinstellungen({ zeitzone: aktuell })
      .then((neu) => {
        client.setQueryData(SCHLUESSEL.einstellungen, neu);
      })
      .catch(() => {
        zoneGemeldet.current = null;
      });
  }, [daten, client]);

  if (einstellungen.isPending) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Ladeanzeige />
      </main>
    );
  }
  if (einstellungen.error || !daten) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16">
        <Fehlermeldung fehler={einstellungen.error} />
      </main>
    );
  }
  if (offen && daten) {
    if (!spracheWeg) {
      return (
        <SprachStart
          onFertig={() => {
            merkeSitzung(SPRACHE_WEG, true);
            setRunde((aktuell) => ({ ...aktuell, spracheWeg: true }));
          }}
        />
      );
    }
    if (!weg) {
      return (
        <Einfuehrung
          onFertig={() => {
            merkeSitzung(EINFUEHRUNG_WEG, true);
            setRunde((aktuell) => ({ ...aktuell, weg: true }));
          }}
        />
      );
    }
    return <ProfilErstellung start={daten} />;
  }

  return (
      <div className="min-h-dvh md:flex">
        <AbgleichBeimOeffnen />
        <Seitenleiste />

        <div className="min-w-0 flex-1">
          <MobilKopf />
          <main className="mx-auto w-full max-w-4xl px-4 pt-4 pb-28 md:px-8 md:pt-10 md:pb-12">
            <ZurueckLeiste pathname={pathname} />
            <Suspense fallback={<Ladeanzeige />}>
              <div key={pathname} className="seite-einblenden">
                {pfadAktiv(pathname, { funktionen: daten.funktionen, ebenen: daten.ebenen }) ? (
                  <Outlet />
                ) : (
                  <Navigate to="/" replace />
                )}
              </div>
            </Suspense>
          </main>
        </div>

        <MobilNavigation />
      </div>
  );
}

function Logo() {
  return (
    <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
      <img src="/logo-v2.svg" alt="" className="logo-bild size-7" />
      Stride
    </span>
  );
}

function useCharakterKurz() {
  const { data } = useQuery({ queryKey: SCHLUESSEL.uebersicht, queryFn: api.uebersicht });
  return data ? { name: data.name, klasse: data.klasse, level: data.level } : null;
}

function NavPunkt({ eintrag }: { eintrag: NavEintrag }) {
  const NavIcon = eintrag.icon;
  return (
    <NavLink
      to={eintrag.pfad}
      end={eintrag.pfad === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
          isActive ? 'bg-flaeche-2 text-haupt' : 'text-leise hover:text-haupt'
        }`
      }
    >
      <NavIcon className="size-4 shrink-0" />
      <span className="min-w-0 break-words">{tx(eintrag.label)}</span>
    </NavLink>
  );
}

function Seitenleiste() {
  const oeffnen = useEintragOeffnen();
  const charakter = useCharakterKurz();
  const funktionen = useFunktionen();
  const ebenen = useEbenen();

  return (
    <aside className="seitenleiste sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-rand bg-flaeche px-4 py-6 md:flex">
      <div className="px-2">
        <Logo />
      </div>

      <button
        type="button"
        onClick={() => oeffnen()}
        className="knopf knopf-primaer mt-8 flex items-center justify-center gap-2 rounded-xl bg-akzent px-4 py-3 text-sm font-semibold text-akzent-text transition hover:brightness-110"
      >
        <Plus className="size-4" strokeWidth={2.5} />
        {tx("Eintrag loggen")}
      </button>

      <nav className="mt-6 min-h-0 flex-1 space-y-5 overflow-y-auto">
        {sichtbareGruppen(funktionen, ebenen).map((gruppe) => (
          <div key={gruppe.titel ?? 'start'} className="space-y-0.5">
            {gruppe.titel && (
              <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-leise uppercase">{tx(gruppe.titel)}</p>
            )}
            {gruppe.eintraege.map((eintrag) => (
              <NavPunkt key={eintrag.pfad} eintrag={eintrag} />
            ))}
          </div>
        ))}
      </nav>

      <div className="mt-4 space-y-2">
        <div>
          {istAn('handbuch', { funktionen, ebenen }) && <NavPunkt eintrag={HANDBUCH} />}
          <NavPunkt eintrag={EINSTELLUNGEN} />
        </div>
        {charakter && (
          <NavLink to="/charakter" className="block rounded-xl bg-flaeche-2 p-3">
            <div className="flex items-center gap-2">
              <KlassenBild klasse={charakter.klasse} groesse="size-9" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{charakter.name}</span>
                  <span className="zahl shrink-0 whitespace-nowrap text-leise">{tx('Lvl {level}', { level: charakter.level.level })}</span>
                </div>
                <p className="text-xs text-leise break-words">{klassenText(charakter.klasse)}</p>
              </div>
            </div>
            <div className="mt-2">
              <Fortschrittsbalken anteil={charakter.level.fortschritt} hoehe="h-1.5" />
            </div>
          </NavLink>
        )}
      </div>
    </aside>
  );
}

function ZurueckLeiste({ pathname }: { pathname: string }) {
  const funktionen = useFunktionen();
  const ebenen = useEbenen();
  const { data } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const leiste = sichtbareLeiste(data?.mobilLeiste ?? LEISTE_STANDARD, funktionen, ebenen);
  const ziel = useZurueck(zurueckFuerSeite(pathname, leiste));
  if (seiteZeigtEigenenZurueck(pathname) || !ziel) {
    return null;
  }
  return (
    <div className="mb-6">
      <ZurueckZumMehr pfad={ziel.pfad} label={ziel.label} />
    </div>
  );
}

function MobilKopf() {
  const charakter = useCharakterKurz();
  const { pathname } = useLocation();
  const kopf = useRef<HTMLElement>(null);
  const name = charakter?.name ?? '';
  const mehrAktiv = pathname === '/mehr' || pathname.startsWith('/mehr/');

  useEffect(() => {
    const knoten = kopf.current;
    if (!knoten) {
      return;
    }
    const setzen = () => {
      const hoehe = getComputedStyle(knoten).display === 'none' ? 0 : knoten.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--mobilkopf-hoehe', `${hoehe}px`);
    };
    setzen();
    const beobachter = new ResizeObserver(setzen);
    beobachter.observe(knoten);
    return () => {
      beobachter.disconnect();
      document.documentElement.style.removeProperty('--mobilkopf-hoehe');
    };
  }, []);

  return (
    <header
      ref={kopf}
      className="mobilkopf sticky top-0 z-30 flex items-center gap-2 border-b border-rand bg-grund/90 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur md:hidden"
    >
      <NavLink
        to="/charakter"
        aria-label={
          name
            ? tx('{name}, Level {level}, Profil öffnen', { name, level: charakter?.level.level ?? '' })
            : tx('Profil öffnen')
        }
        className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-flaeche py-1 pr-2.5 pl-1 active:scale-[0.99]"
      >
        <KlassenBild klasse={charakter?.klasse ?? 'Neuling'} groesse="size-8" />
        <span className="min-w-0 flex-1 truncate font-semibold">{name}</span>
        <ChevronRight className="size-4 shrink-0 text-leise" />
      </NavLink>
      <NavLink
        to="/mehr"
        aria-current={mehrAktiv ? 'page' : undefined}
        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold ${mehrAktiv ? 'bg-akzent text-akzent-text' : 'bg-flaeche text-haupt'}`}
      >
        <Settings className="size-3.5" />
        {tx("Mehr")}
      </NavLink>
      {charakter && (
        <div className="shrink-0">
          <span className="zahl block whitespace-nowrap text-right text-xs text-leise">{tx('Level {level}', { level: charakter.level.level })}</span>
          <Fortschrittsbalken anteil={charakter.level.fortschritt} hoehe="h-1" />
        </div>
      )}
    </header>
  );
}

function MobilNavigation() {
  const oeffnen = useEintragOeffnen();
  const funktionen = useFunktionen();
  const ebenen = useEbenen();
  const { data } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const eintraege = sichtbareLeiste(data?.mobilLeiste ?? LEISTE_STANDARD, funktionen, ebenen).flatMap((pfad) => {
    const eintrag = navAusLeiste(pfad);
    return eintrag ? [eintrag] : [];
  });
  const mitte = leistenMitte(eintraege.length);
  const link = ({ pfad, label, icon: NavIcon }: NavEintrag) => (
    <NavLink
      key={pfad}
      to={pfad}
      end={pfad === '/'}
      className={({ isActive }) =>
        `flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 py-2 text-center text-[11px] font-medium leading-tight ${navKlasse({ isActive })}`
      }
    >
      <NavIcon className="size-5" />
      <span className="max-w-full break-words">{tx(label)}</span>
    </NavLink>
  );

  return (
    <nav className="mobilleiste fixed inset-x-0 bottom-0 z-40 flex items-end border-t border-rand bg-flaeche/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {eintraege.slice(0, mitte).map(link)}
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={() => oeffnen()}
          aria-label={tx('Eintrag loggen')}
          className="knopf-rund -mt-6 mb-2 flex size-14 items-center justify-center rounded-full bg-akzent text-akzent-text shadow-lg shadow-akzent/30 transition active:scale-95"
        >
          <Plus className="size-7" strokeWidth={2.5} />
        </button>
      </div>
      {eintraege.slice(mitte).map(link)}
    </nav>
  );
}
