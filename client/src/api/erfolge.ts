import type { Erfolge } from '../../../shared/api/erfolge.ts';
import { anfrage } from './kern.ts';

export const erfolgeApi = {
  erfolge: () => anfrage<Erfolge>('/erfolge'),
  setzeTitel: (schluessel: string | null) => anfrage<Erfolge>('/titel', 'PUT', { schluessel }),
};

export const erfolgeSchluessel = {
  erfolge: ['erfolge'],
} as const;
