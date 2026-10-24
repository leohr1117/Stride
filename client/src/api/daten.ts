import type { ImportErgebnis } from '../../../shared/api/daten.ts';
import { anfrage } from './kern.ts';

export const datenApi = {
  importiere: (daten: unknown) => anfrage<ImportErgebnis>('/import', 'POST', daten),
};

export const EXPORT_ADRESSE = '/api/export';
