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
  koennen: { icon: Brain, pfad: '/charakter' },
  status: { icon: Wallet, pfad: '/charakter' },
  faehigkeiten: { icon: Sparkles, pfad: '/charakter' },
  ausruestung: { icon: Gem, pfad: '/charakter' },
  verfallKoennen: { icon: TrendingDown },
  verfallHaben: { icon: TrendingDown },
  bossAngriffe: { icon: Swords, pfad: '/laufend' },
};
