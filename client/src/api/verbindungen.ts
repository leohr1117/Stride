import type { AbgleichErgebnis, Verbindungen } from '../../../shared/api/verbindungen.ts';
import { anfrage } from './kern.ts';

export const verbindungenApi = {
  verbindungen: () => anfrage<Verbindungen>('/verbindungen'),
  gleicheAb: () => anfrage<AbgleichErgebnis>('/verbindungen/abgleichen', 'POST', {}),
};

export const verbindungenSchluessel = {
  verbindungen: ['verbindungen'],
} as const;
