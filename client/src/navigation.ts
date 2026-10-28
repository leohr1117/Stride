import {
  Activity,
  BookMarked,
  CalendarCheck,
  ChartColumn,
  Compass,
  House,
  Layers,
  Route,
  Settings,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { standardEbenen, type Ebenen } from '../../shared/spiel/ebenen.ts';
import type { Funktion, Funktionen } from '../../shared/spiel/funktionen.ts';
import { LEISTEN_SEITEN } from '../../shared/spiel/leiste.ts';
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

const UEBERSICHT: NavEintrag = { pfad: '/', label: 'Übersicht', icon: House };
const LAUFEND: NavEintrag = { pfad: '/laufend', label: 'Laufend', icon: Activity };
const ZIELE: NavEintrag = { pfad: '/ziele', label: 'Ziele', icon: Compass };

export const NAVIGATION: NavGruppe[] = [
  {
    titel: null,
    eintraege: [
      UEBERSICHT,
      LAUFEND,
      { pfad: '/basis', label: 'Basis', icon: Layers, funktion: 'basis' },
      ZIELE,
    ],
  },
  {
    titel: 'Reise',
    eintraege: [
      { pfad: '/chronik', label: 'Chronik', icon: Route, funktion: 'chronik' },
      { pfad: '/rueckblick', label: 'Rückblick', icon: CalendarCheck, funktion: 'rueckblick' },
      { pfad: '/statistiken', label: 'Statistiken', icon: ChartColumn, funktion: 'statistiken' },
      { pfad: '/vorbilder', label: 'Vorbilder', icon: Star, funktion: 'vorbilder' },
    ],
  },
];

export const EINSTELLUNGEN: NavEintrag = { pfad: '/mehr', label: 'Mehr', icon: Settings };
export const HANDBUCH: NavEintrag = { pfad: '/handbuch', label: 'Handbuch', icon: BookMarked, funktion: 'handbuch' };

const LEISTEN_ICONS: Record<string, LucideIcon> = {
  '/': House,
  '/laufend': Activity,
  '/basis': Layers,
  '/ziele': Compass,
  '/chronik': Route,
  '/rueckblick': CalendarCheck,
  '/statistiken': ChartColumn,
  '/vorbilder': Star,
  '/handbuch': BookMarked,
  '/mehr': Settings,
};

export function navAusLeiste(pfad: string): NavEintrag | undefined {
  const seite = LEISTEN_SEITEN.find((eintrag) => eintrag.pfad === pfad);
  const icon = LEISTEN_ICONS[pfad];
  if (!seite || !icon) {
    return undefined;
  }
  return { pfad: seite.pfad, label: seite.label, icon, funktion: seite.funktion };
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
  pfade.push('/mehr/inhalte');
  if (pfadAktiv(HANDBUCH.pfad, sichtbarkeit)) {
    pfade.push(HANDBUCH.pfad);
  }
  pfade.push(EINSTELLUNGEN.pfad, '/charakter');
  return pfade;
}

