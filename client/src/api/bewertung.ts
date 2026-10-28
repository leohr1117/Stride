import type { BewertungStand } from '../../../shared/api/bewertung.ts';
import { anfrage } from './kern.ts';

export const bewertungApi = {
  bewerte: (eingabe: { wert: number } | { nie: true }) => anfrage<BewertungStand>('/bewertung', 'POST', eingabe),
};

export const bewertungSchluessel = {
  bewertung: ['bewertung'] as const,
};
