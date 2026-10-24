import type { Charakter, Uebersicht } from '../../../shared/api/uebersicht.ts';
import { anfrage } from './kern.ts';

export const uebersichtApi = {
  uebersicht: () => anfrage<Uebersicht>('/uebersicht'),
  charakter: () => anfrage<Charakter>('/charakter'),
};

export const uebersichtSchluessel = {
  uebersicht: ['uebersicht'],
  charakter: ['charakter'],
} as const;
