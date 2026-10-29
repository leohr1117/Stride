import {
  BookMarked,
  Brain,
  CalendarCheck,
  ChartColumn,
  Gem,
  Layers,
  Route,
  Sparkles,
  Star,
  Swords,
  TrendingDown,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Funktion } from '../../shared/spiel/funktionen.ts';

export const FUNKTION_BILD: Record<Funktion, { icon: LucideIcon; pfad?: string }> = {
  basis: { icon: Layers, pfad: '/basis' },
  chronik: { icon: Route, pfad: '/chronik' },
  rueckblick: { icon: CalendarCheck, pfad: '/rueckblick' },
  statistiken: { icon: ChartColumn, pfad: '/statistiken' },
  vorbilder: { icon: Star, pfad: '/vorbilder' },
  handbuch: { icon: BookMarked, pfad: '/handbuch' },
  koennen: { icon: Brain, pfad: '/koennen' },
  status: { icon: Wallet, pfad: '/haben' },
  faehigkeiten: { icon: Sparkles, pfad: '/faehigkeiten' },
  ausruestung: { icon: Gem, pfad: '/investitionen' },
  verfallKoennen: { icon: TrendingDown },
  verfallHaben: { icon: TrendingDown },
  bossAngriffe: { icon: Swords, pfad: '/laufend' },
};
