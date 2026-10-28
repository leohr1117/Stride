import type { HinweisStand } from '../../../shared/api/hinweise.ts';
import { anfrage } from './kern.ts';

export interface HinweisAboKoerper {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface HinweisWahl {
  ruheVon?: string;
  ruheBis?: string;
  streak?: boolean;
  rueckkehr?: boolean;
  boss?: boolean;
}

export const hinweiseApi = {
  hinweise: () => anfrage<HinweisStand>('/hinweise'),
  hinweisAbo: (koerper: HinweisAboKoerper) => anfrage<HinweisStand>('/hinweise/abo', 'POST', koerper),
  hinweisAboWeg: (endpoint: string) => anfrage<HinweisStand>('/hinweise/abo', 'DELETE', { endpoint }),
  hinweisWahl: (teil: HinweisWahl) => anfrage<HinweisStand>('/hinweise', 'PATCH', teil),
  hinweisAngebot: () => anfrage<{ gesehen: true }>('/hinweise/angebot', 'POST', { nie: true }),
};

export const hinweiseSchluessel = {
  hinweise: ['hinweise'] as const,
  angebot: ['hinweis-angebot'] as const,
};
