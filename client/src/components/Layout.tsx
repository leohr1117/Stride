import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import type { Einstellungen } from '../../../shared/api/einstellungen.ts';
import { api, SCHLUESSEL } from '../api/index.ts';
import { useEbenen, useFunktionen } from '../funktionen.ts';
import { hatEintragFab, LEISTE_STANDARD, sichtbareLeiste } from '../../../shared/spiel/leiste.ts';
import { istAn, pfadAktiv } from '../../../shared/spiel/sichtbarkeit.ts';
import { EINSTELLUNGEN, navAusLeiste, seitenleistenPfade, sichtbareGruppen, type NavEintrag } from '../navigation.ts';
import { AbgleichBeimOeffnen } from '../abgleichBeimOeffnen.tsx';
import { useStilAbgleich } from '../features/darstellung/stil.ts';
import type { EintragVorgabe } from '../features/eintraege/EintragDialog.tsx';

const EintragDialog = lazy(() => import('../features/eintraege/EintragDialog.tsx').then((modul) => ({ default: modul.EintragDialog })));
import { UpdateHinweis, useNeuMarkierung, verbindeVersionsstand } from '../updateHinweis.tsx';
import { Kopf, KopfRahmen } from './Kopf.tsx';
import { KlassenBild } from './KlassenBild.tsx';
import { profilFragenOffen } from '../../../shared/spiel/profil.ts';
import { klickeHauptseite, useAktiverPlatz, useVerlauf } from '../herkunft.tsx';
import { setzeNavLage } from '../herkunftLauf.ts';
import { merkeSitzung, vergiss } from '../speicher.ts';
import { EinfuehrungAblauf } from './Einfuehrung.tsx';
import { tx } from '../text.ts';
import { Fehlermeldung, Ladeanzeige } from '../ui/index.ts';
const EintragOeffnenKontext = createContext<((vorgabe?: EintragVorgabe) => void) | null>(null);

export function useEintragOeffnen(): (vorgabe?: EintragVorgabe) => void {
  const oeffnen = useContext(EintragOeffnenKontext);
  if (!oeffnen) {
    throw new Error('useEintragOeffnen muss innerhalb von <Layout> verwendet werden.');
  }
  return oeffnen;
}

function platzKlasse(aktiv: boolean): string {
  return aktiv ? 'font-semibold text-haupt' : 'font-medium text-leise hover:text-haupt';
}

function FabAbstand({ an }: { an: boolean }) {
  useLayoutEffect(() => {
    if (an) {
      document.documentElement.dataset.fab = 'an';
    } else {
      delete document.documentElement.dataset.fab;
    }
    return () => {
      delete document.documentElement.dataset.fab;
    };
  }, [an]);
  return null;
}

function EintragFab() {
  const oeffnen = useEintragOeffnen();
  return (
    <button
      type="button"
      onClick={() => oeffnen()}
      aria-label={tx('Eintrag loggen')}
      className="eintrag-fab knopf-rund flex items-center justify-center rounded-full bg-akzent text-akzent-text shadow-lg shadow-akzent/30 transition active:scale-95"
    >
      <Plus className="size-7" strokeWidth={2.5} />
    </button>
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

function AppGeruest() {
  useStilAbgleich();
  const pc = useIstPc();
  const { pathname } = useLocation();
  const einstellungen = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const client = useQueryClient();
  const zoneGemeldet = useRef<string | null>(null);
  const [gehalten, setGehalten] = useState(false);

  useEffect(() => {
    vergiss('stride.einfuehrung');
    merkeSitzung('stride.einfuehrung.weg', false);
    merkeSitzung('stride.sprache.weg', false);
    merkeSitzung('stride.fragen.offen', false);
  }, []);

  const daten = einstellungen.data;
  const offen = daten ? profilFragenOffen(daten) : null;
  if (daten) {
    setzeNavLage({
      leiste: sichtbareLeiste(daten.mobilLeiste ?? LEISTE_STANDARD, daten.funktionen, daten.ebenen),
      seitenleiste: pc ? seitenleistenPfade(daten.funktionen, daten.ebenen) : [],
      verlaufAn: istAn('chronik', { funktionen: daten.funktionen, ebenen: daten.ebenen }),
    });
  }
  useVerlauf(Boolean(daten) && offen === false && !gehalten);

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
        client.setQueryData<Einstellungen>(SCHLUESSEL.einstellungen, (alt) => verbindeVersionsstand(alt, neu));
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
  if ((offen || gehalten) && daten) {
    return <EinfuehrungAblauf onHalten={() => setGehalten(true)} onLos={() => setGehalten(false)} />;
  }

  return (
      <KopfRahmen>
        <div className="min-h-dvh md:flex">
          <AbgleichBeimOeffnen />
          <Seitenleiste />

          <div className="min-w-0 flex-1">
            <FabAbstand an={!pc && hatEintragFab(pathname)} />
            <main className="mx-auto w-full max-w-4xl pb-28 md:pb-12">
              <div className="inhalt-spalte">
                <Kopf />
                <div data-inhalt="" className="pt-4 md:pt-6">
                  <Suspense fallback={<Ladeanzeige />}>
                    <div key={pathname} className="seite-einblenden">
                      {pfadAktiv(pathname, { funktionen: daten.funktionen, ebenen: daten.ebenen }) ? (
                        <Outlet />
                      ) : (
                        <Navigate to="/" replace />
                      )}
                    </div>
                  </Suspense>
                </div>
              </div>
            </main>
          </div>

          <MobilNavigation />
          <UpdateHinweis />
          {!pc && hatEintragFab(pathname) ? <EintragFab /> : null}
        </div>
      </KopfRahmen>
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
  return data ? { klasse: data.klasse } : null;
}

function NeuPunkt() {
  return <span data-neu-punkt="" className="pointer-events-none absolute -top-1 -right-1.5 size-2 rounded-full bg-fortschritt" aria-hidden="true" />;
}

function NavPunkt({ eintrag, bild }: { eintrag: NavEintrag; bild?: ReactNode }) {
  const NavIcon = eintrag.icon;
  const aktiv = useAktiverPlatz() === eintrag.pfad;
  const neu = useNeuMarkierung();
  const punkt = eintrag.pfad === '/mehr' && neu;
  return (
    <Link
      to={eintrag.pfad}
      data-platz={eintrag.pfad}
      aria-current={aktiv ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
        aktiv ? 'bg-flaeche-2 text-haupt' : 'text-leise hover:text-haupt'
      }`}
    >
      <span className="relative shrink-0">
        {bild ?? <NavIcon className="size-4" />}
        {punkt ? <NeuPunkt /> : null}
      </span>
      <span className="min-w-0 break-words">{tx(eintrag.label)}</span>
    </Link>
  );
}

function Seitenleiste() {
  const oeffnen = useEintragOeffnen();
  const charakter = useCharakterKurz();
  const funktionen = useFunktionen();
  const ebenen = useEbenen();
  const bloecke = sichtbareGruppen(funktionen, ebenen);

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

      <nav className="mt-6 flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {bloecke.map((gruppe, index) => (
            <div key={gruppe.eintraege[0]?.pfad ?? index}>
              {index > 0 && <div className="seitenleiste-trennung mx-3 my-3 border-t border-rand" role="separator" />}
              <div className="space-y-0.5">
                {gruppe.eintraege.map((eintrag) => (
                  <NavPunkt
                    key={eintrag.pfad}
                    eintrag={eintrag}
                    bild={
                      eintrag.pfad === '/charakter' && charakter ? (
                        <KlassenBild klasse={charakter.klasse} groesse="size-5" />
                      ) : undefined
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 shrink-0 border-t border-rand pt-3">
          <NavPunkt eintrag={EINSTELLUNGEN} />
        </div>
      </nav>
    </aside>
  );
}

function MobilNavigation() {
  const leiste = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = leiste.current;
    if (!element) {
      return;
    }
    const messe = () => {
      if (getComputedStyle(element).display === 'none') {
        document.documentElement.style.removeProperty('--leisten-hoehe');
        return;
      }
      const kasten = element.getBoundingClientRect();
      const hoehe = Math.max(0, Math.ceil(window.innerHeight - kasten.top));
      document.documentElement.style.setProperty('--leisten-hoehe', `${hoehe}px`);
    };
    messe();
    const beobachter = new ResizeObserver(messe);
    beobachter.observe(element);
    window.addEventListener('resize', messe);
    return () => {
      beobachter.disconnect();
      window.removeEventListener('resize', messe);
      document.documentElement.style.removeProperty('--leisten-hoehe');
    };
  }, []);
  const funktionen = useFunktionen();
  const ebenen = useEbenen();
  const aktivPlatz = useAktiverPlatz();
  const { data } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const eintraege = sichtbareLeiste(data?.mobilLeiste ?? LEISTE_STANDARD, funktionen, ebenen).flatMap((pfad) => {
    const eintrag = navAusLeiste(pfad);
    return eintrag ? [eintrag] : [];
  });
  const neu = useNeuMarkierung();
  const link = ({ pfad, label, icon: NavIcon }: NavEintrag) => {
    const aktiv = aktivPlatz === pfad;
    return (
      <Link
        key={pfad}
        to={pfad}
        data-platz={pfad}
        aria-current={aktiv ? 'page' : undefined}
        className={`flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-1 px-0.5 py-2 text-center text-[11px] leading-tight ${platzKlasse(aktiv)}`}
      >
        <span className="relative">
          <NavIcon className="size-5" strokeWidth={aktiv ? 2.25 : 1.75} />
          {pfad === '/mehr' && neu ? <NeuPunkt /> : null}
        </span>
        <span className="max-w-full break-words">{tx(label)}</span>
      </Link>
    );
  };

  return (
    <nav
      ref={leiste}
      className="mobilleiste fixed inset-x-0 bottom-0 z-40 flex min-h-[calc(64px+env(safe-area-inset-bottom))] items-center border-t border-rand bg-flaeche/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {eintraege.map(link)}
    </nav>
  );
}
