import type { KetteHeute, SchutzErgebnis } from '../../../shared/api/kette.ts';
import { anfrage } from './kern.ts';

export const ketteApi = {
  ketteHeute: () => anfrage<KetteHeute>('/kette/heute'),
  schutzEinsetzen: () => anfrage<SchutzErgebnis>('/kette/schutz', 'POST', {}),
};

export const ketteSchluessel = {
  ketteHeute: ['kette', 'heute'] as const,
};
