import type { Statistiken, Zeitraum } from '../../../shared/api/statistiken.ts';
import { abfrageText, anfrage } from './kern.ts';

export const statistikenApi = {
  statistiken: (zeitraum: Zeitraum) => anfrage<Statistiken>(`/statistiken${abfrageText({ zeitraum })}`),
};

export const statistikenSchluessel = {
  statistiken: (zeitraum: Zeitraum) => ['statistiken', zeitraum] as const,
};
