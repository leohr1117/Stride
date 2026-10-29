import {
  Activity,
  BookMarked,
  Brain,
  CalendarCheck,
  ChartColumn,
  Compass,
  Gem,
  House,
  Layers,
  ListChecks,
  Route,
  Settings,
  Sparkles,
  Star,
  User,
  Wallet,
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
  hirn: Brain,
  boerse: Wallet,
  funken: Sparkles,
  juwel: Gem,
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

const BLOECKE = [1, 2, 3, 4] as const;

export const EINSTELLUNGEN: NavEintrag = alsEintrag(mussSeite('/mehr'));
export const HANDBUCH: NavEintrag = alsEintrag(mussSeite('/handbuch'));

export function navAusLeiste(pfad: string): NavEintrag | undefined {
  if (!LEISTEN_SEITEN.some((seite) => seite.pfad === pfad)) {
    return undefined;
  }
  const fund = SEITEN.find((seite) => seite.pfad === pfad);
  return fund ? alsEintrag(fund) : undefined;
}

/**
 * Vier Blöcke aus der Seitentabelle, ohne Überschrift. Leere Blöcke fehlen.
 * Mehr steht nicht darin, es bleibt unten an der Seitenleiste.
 */
export function sichtbareGruppen(funktionen: Funktionen, ebenen: Ebenen = standardEbenen()): NavGruppe[] {
  const sichtbarkeit = { funktionen, ebenen };
  return BLOECKE.flatMap((block) => {
    const eintraege = SEITEN.filter((seite) => seite.block === block && pfadAktiv(seite.pfad, sichtbarkeit)).map(alsEintrag);
    return eintraege.length > 0 ? [{ titel: null, eintraege }] : [];
  });
}

/** Pfade, die am PC als Leistenplatz gelten. Dieselbe Reihe wie die Seitenleiste, Mehr am Ende. */
export function seitenleistenPfade(funktionen: Funktionen, ebenen: Ebenen = standardEbenen()): string[] {
  const pfade = sichtbareGruppen(funktionen, ebenen).flatMap((gruppe) => gruppe.eintraege.map((eintrag) => eintrag.pfad));
  pfade.push(EINSTELLUNGEN.pfad);
  return pfade;
}

