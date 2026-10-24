import type { Einstellungen } from '../../../shared/api/einstellungen.ts';
import { anfrage } from './kern.ts';

export const einstellungenApi = {
  einstellungen: () => anfrage<Einstellungen>('/einstellungen'),
  aendereEinstellungen: (daten: Partial<Einstellungen>) => anfrage<Einstellungen>('/einstellungen', 'PATCH', daten),
  setzeProfilZurueck: () => anfrage<Einstellungen>('/profil/zuruecksetzen', 'POST', {}),
};

export const einstellungenSchluessel = {
  einstellungen: ['einstellungen'],
} as const;
