import {
  Activity,
  BookMarked,
  CalendarCheck,
  ChartColumn,
  Compass,
  House,
  Layers,
  ListChecks,
  Route,
  Settings,
  Star,
  User,
  type LucideIcon,
} from 'lucide-react';
import { standardEbenen, type Ebenen } from '../../shared/spiel/ebenen.ts';
import type { Funktion, Funktionen } from '../../shared/spiel/funktionen.ts';
import { LEISTEN_SEITEN } from '../../shared/spiel/leiste.ts';
import { SEITEN, type Seite, type SeitenSchalter, type SeitenSymbol } from '../../shared/spiel/navigation.ts';
import { pfadAktiv } from '../../shared/spiel/sichtbarkeit.ts';

export interface NavEintrag {
  pfad: string;
  label: string;
  icon: LucideIcon;
  funktion?: Funktion;
}

export interface NavGruppe {
  titel: string | null;
  eintraege: NavEintrag[];
}

const SYMBOL: Record<SeitenSymbol, LucideIcon> = {
  haus: House,
  kompass: Compass,
  laufend: Activity,
  schichten: Layers,
  liste: ListChecks,
  weg: Route,
  kalender: CalendarCheck,
  diagramm: ChartColumn,
  stern: Star,
  person: User,
  buch: BookMarked,
  zahnrad: Settings,
};

function istFunktion(schalter: SeitenSchalter | null): schalter is Funktion {
  return schalter !== null && schalter !== 'ziele' && schalter !== 'laufend';
}

function alsEintrag(seite: Seite): NavEintrag {
  const funktion = istFunktion(seite.schalter) ? seite.schalter : undefined;
  return {
    pfad: seite.pfad,
    label: seite.name,
    icon: SYMBOL[seite.symbol],
    ...(funktion ? { funktion } : {}),
  };
}

function mussSeite(pfad: string): Seite {
  const fund = SEITEN.find((seite) => seite.pfad === pfad);
  if (!fund) {
    throw new Error(`Seite fehlt in der Tabelle: ${pfad}`);
  }
  return fund;
}

/**
 * Bis U15 bleibt die bisherige Gruppierung. Die vier Blöcke zeigt erst die neue Seitenleiste.
 * Namen und Symbole kommen aus der Seitentabelle.
 */
const GRUPPEN_BIS_U15: { titel: string | null; pfade: readonly string[] }[] = [
  { titel: null, pfade: ['/', '/laufend', '/basis', '/ziele'] },
  { titel: 'Reise', pfade: ['/chronik', '/rueckblick', '/statistiken', '/vorbilder'] },
];

export const NAVIGATION: NavGruppe[] = GRUPPEN_BIS_U15.map((gruppe) => ({
  titel: gruppe.titel,
  eintraege: gruppe.pfade.map((pfad) => alsEintrag(mussSeite(pfad))),
}));

export const EINSTELLUNGEN: NavEintrag = alsEintrag(mussSeite('/mehr'));
export const HANDBUCH: NavEintrag = alsEintrag(mussSeite('/handbuch'));

export function navAusLeiste(pfad: string): NavEintrag | undefined {
  if (!LEISTEN_SEITEN.some((seite) => seite.pfad === pfad)) {
    return undefined;
  }
  const fund = SEITEN.find((seite) => seite.pfad === pfad);
  return fund ? alsEintrag(fund) : undefined;
}

export function sichtbareGruppen(funktionen: Funktionen, ebenen: Ebenen = standardEbenen()): NavGruppe[] {
  const sichtbarkeit = { funktionen, ebenen };
  return NAVIGATION.map((gruppe) => ({
    titel: gruppe.titel,
    eintraege: gruppe.eintraege.filter((eintrag) => pfadAktiv(eintrag.pfad, sichtbarkeit)),
  })).filter((gruppe) => gruppe.eintraege.length > 0);
}

/**
 * Pfade, die am PC als Leistenplatz gelten.
 * Tätigkeiten zählt mit, obwohl der sichtbare Eintrag erst mit der neuen Seitenleiste kommt.
 */
export function seitenleistenPfade(funktionen: Funktionen, ebenen: Ebenen = standardEbenen()): string[] {
  const sichtbarkeit = { funktionen, ebenen };
  const pfade = sichtbareGruppen(funktionen, ebenen).flatMap((gruppe) => gruppe.eintraege.map((eintrag) => eintrag.pfad));
  pfade.push(mussSeite('/mehr/inhalte').pfad);
  if (pfadAktiv(HANDBUCH.pfad, sichtbarkeit)) {
    pfade.push(HANDBUCH.pfad);
  }
  pfade.push(EINSTELLUNGEN.pfad, mussSeite('/charakter').pfad);
  return pfade;
}
