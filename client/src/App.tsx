import { lazy, useEffect, type ComponentType } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router';
import { Layout } from './components/Layout.tsx';

const VORLADEN_VERZOEGERUNG_MS = 1500;
const SEITEN_LADER: (() => Promise<unknown>)[] = [];

function seite<Modul>(laden: () => Promise<Modul>, auswahl: (modul: Modul) => ComponentType) {
  if (!SEITEN_LADER.includes(laden)) {
    SEITEN_LADER.push(laden);
  }
  return lazy(() => laden().then((modul) => ({ default: auswahl(modul) })));
}

const ladeUebersicht = () => import('./features/uebersicht/Uebersicht.tsx');
const ladeLaufend = () => import('./features/ziele/Laufend.tsx');
const ladeZiele = () => import('./features/ziele/Ziele.tsx');
const ladeMehr = () => import('./features/mehr/Mehr.tsx');
const ladeCharakter = () => import('./features/attribute/Charakter.tsx');
const ladeAttributSeite = () => import('./features/attribute/AttributSeite.tsx');
const ladeFaehigkeiten = () => import('./features/faehigkeiten/FaehigkeitenSeite.tsx');
const ladeInvestitionen = () => import('./features/investitionen/Investitionen.tsx');
const ladeMehrBereiche = () => import('./features/mehr/bereiche.ts');
const ladeBasis = () => import('./features/basis/BasisSeite.tsx');
const ladeChronik = () => import('./features/eintraege/Chronik.tsx');
const ladeFaehigkeit = () => import('./features/faehigkeiten/Faehigkeit.tsx');
const ladeHandbuch = () => import('./features/handbuch/Handbuch.tsx');
const ladeProjekt = () => import('./features/ziele/Projekt.tsx');
const ladeRueckblick = () => import('./features/rueckblick/Rueckblick.tsx');
const ladeStatistiken = () => import('./features/statistiken/Statistiken.tsx');
const ladeVorbildProfil = () => import('./features/vorbilder/VorbildProfil.tsx');
const ladeVorbilder = () => import('./features/vorbilder/Vorbilder.tsx');

const UebersichtSeite = seite(ladeUebersicht, (modul) => modul.UebersichtSeite);
const LaufendSeite = seite(ladeLaufend, (modul) => modul.LaufendSeite);
const ZieleSeite = seite(ladeZiele, (modul) => modul.ZieleSeite);
const MehrSeite = seite(ladeMehr, (modul) => modul.MehrSeite);
const CharakterSeite = seite(ladeCharakter, (modul) => modul.CharakterSeite);
const KoennenSeite = seite(ladeAttributSeite, (modul) => modul.KoennenSeite);
const HabenSeite = seite(ladeAttributSeite, (modul) => modul.HabenSeite);
const FaehigkeitenSeite = seite(ladeFaehigkeiten, (modul) => modul.FaehigkeitenSeite);
const InvestitionenSeite = seite(ladeInvestitionen, (modul) => modul.InvestitionenSeite);
const MehrProfilSeite = seite(ladeMehrBereiche, (modul) => modul.MehrProfilSeite);
const MehrInhalteSeite = seite(ladeMehrBereiche, (modul) => modul.MehrInhalteSeite);
const MehrDarstellungSeite = seite(ladeMehrBereiche, (modul) => modul.MehrDarstellungSeite);
const MehrUebersichtSeite = seite(ladeMehrBereiche, (modul) => modul.MehrUebersichtSeite);
const MehrFunktionenSeite = seite(ladeMehrBereiche, (modul) => modul.MehrFunktionenSeite);
const MehrDatenSeite = seite(ladeMehrBereiche, (modul) => modul.MehrDatenSeite);
const MehrBenachrichtigungenSeite = seite(ladeMehrBereiche, (modul) => modul.MehrBenachrichtigungenSeite);
const BasisSeite = seite(ladeBasis, (modul) => modul.BasisSeite);
const ChronikSeite = seite(ladeChronik, (modul) => modul.ChronikSeite);
const FaehigkeitSeite = seite(ladeFaehigkeit, (modul) => modul.FaehigkeitSeite);
const HandbuchSeite = seite(ladeHandbuch, (modul) => modul.HandbuchSeite);
const ProjektSeite = seite(ladeProjekt, (modul) => modul.ProjektSeite);
const RueckblickSeite = seite(ladeRueckblick, (modul) => modul.RueckblickSeite);
const StatistikenSeite = seite(ladeStatistiken, (modul) => modul.StatistikenSeite);
const VorbildProfilSeite = seite(ladeVorbildProfil, (modul) => modul.VorbildProfilSeite);
const VorbilderSeite = seite(ladeVorbilder, (modul) => modul.VorbilderSeite);

function Weiter({ nach }: { nach: string }) {
  const ort = useLocation();
  return <Navigate to={`${nach}${ort.search}${ort.hash}`} replace />;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <UebersichtSeite /> },
      { path: 'laufend', element: <LaufendSeite /> },
      { path: 'chronik', element: <ChronikSeite /> },
      { path: 'rueckblick', element: <RueckblickSeite /> },
      { path: 'statistiken', element: <StatistikenSeite /> },
      { path: 'ziele', element: <ZieleSeite /> },
      { path: 'projekte/:id', element: <ProjektSeite /> },
      { path: 'koennen', element: <KoennenSeite /> },
      { path: 'haben', element: <HabenSeite /> },
      { path: 'faehigkeiten', element: <FaehigkeitenSeite /> },
      { path: 'faehigkeiten/:id', element: <FaehigkeitSeite /> },
      { path: 'investitionen', element: <InvestitionenSeite /> },
      { path: 'charakter', element: <CharakterSeite /> },
      { path: 'vorbilder', element: <VorbilderSeite /> },
      { path: 'vorbilder/:schluessel', element: <VorbildProfilSeite /> },
      { path: 'basis', element: <BasisSeite /> },
      { path: 'aufgaben', element: <Navigate to="/" replace /> },
      { path: 'training', element: <Navigate to="/" replace /> },
      { path: 'training/*', element: <Navigate to="/" replace /> },
      { path: 'mehr', element: <MehrSeite /> },
      { path: 'mehr/profil', element: <MehrProfilSeite /> },
      { path: 'mehr/profil/benutzernamen/:kontoId', element: <MehrProfilSeite /> },
      { path: 'mehr/profil/benutzernamen', element: <MehrProfilSeite /> },
      { path: 'mehr/profil/:teil', element: <MehrProfilSeite /> },
      { path: 'mehr/inhalte', element: <MehrInhalteSeite /> },
      { path: 'mehr/inhalte/:teil', element: <MehrInhalteSeite /> },
      { path: 'mehr/darstellung', element: <MehrDarstellungSeite /> },
      { path: 'mehr/darstellung/:teil', element: <MehrDarstellungSeite /> },
      { path: 'mehr/uebersicht', element: <MehrUebersichtSeite /> },
      { path: 'mehr/funktionen', element: <MehrFunktionenSeite /> },
      { path: 'mehr/benachrichtigungen', element: <MehrBenachrichtigungenSeite /> },
      { path: 'mehr/daten', element: <MehrDatenSeite /> },
      { path: 'mehr/konto', element: <Weiter nach="/mehr/profil" /> },
      { path: 'mehr/accounts', element: <Navigate to="/mehr/profil/accounts" replace /> },
      { path: 'mehr/leiste', element: <Navigate to="/mehr/darstellung/leiste" replace /> },
      { path: 'mehr/taetigkeiten', element: <Navigate to="/mehr/inhalte" replace /> },
      { path: 'mehr/sonstiges', element: <Weiter nach="/mehr/funktionen" /> },
      { path: 'handbuch', element: <HandbuchSeite /> },
      { path: 'demnaechst', element: <Navigate to="/mehr/funktionen" replace /> },
      { path: 'verbindungen', element: <Navigate to="/mehr/inhalte/verbindungen" replace /> },
      { path: '*', element: <UebersichtSeite /> },
    ],
  },
]);

function beiLeerlauf(aufgabe: () => void): () => void {
  if ('requestIdleCallback' in window) {
    const kennung = window.requestIdleCallback(aufgabe);
    return () => window.cancelIdleCallback(kennung);
  }
  const kennung = setTimeout(aufgabe, VORLADEN_VERZOEGERUNG_MS);
  return () => clearTimeout(kennung);
}

export function App() {
  useEffect(() => {
    let abgebrochen = false;
    let abbrechen = () => {};
    let index = 0;
    const schritt = () => {
      if (abgebrochen || index >= SEITEN_LADER.length) {
        return;
      }
      const laden = SEITEN_LADER[index];
      index += 1;
      void laden().finally(() => {
        if (!abgebrochen) {
          abbrechen = beiLeerlauf(schritt);
        }
      });
    };
    abbrechen = beiLeerlauf(schritt);
    return () => {
      abgebrochen = true;
      abbrechen();
    };
  }, []);
  return <RouterProvider router={router} />;
}
