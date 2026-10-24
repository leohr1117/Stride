import type { ChronikSeite, EintragDaten, EintragErgebnis, EintragFilter } from '../../../shared/api/eintraege.ts';
import { abfrageText, anfrage } from './kern.ts';

export const eintraegeApi = {
  eintraege: (filter: EintragFilter, cursor?: string) =>
    anfrage<ChronikSeite>(`/eintraege${abfrageText({ ...filter, cursor })}`),
  erstelleEintrag: (daten: EintragDaten) => anfrage<EintragErgebnis>('/eintraege', 'POST', daten),
  loescheEintrag: (id: number) => anfrage<void>(`/eintraege/${id}`, 'DELETE'),
};

export const eintraegeSchluessel = {
  eintraege: (filter: EintragFilter) => ['eintraege', filter] as const,
};
