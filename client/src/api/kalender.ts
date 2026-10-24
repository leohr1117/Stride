import type { Kalender, KalenderAenderung, KalenderDaten } from '../../../shared/api/kalender.ts';
import { anfrage } from './kern.ts';

export const kalenderApi = {
  erstelleKalender: (daten: KalenderDaten) => anfrage<Kalender>('/verbindungen/kalender', 'POST', daten),
  aendereKalender: (id: number, daten: KalenderAenderung) =>
    anfrage<Kalender>(`/verbindungen/kalender/${id}`, 'PATCH', daten),
  loescheKalender: (id: number) => anfrage<void>(`/verbindungen/kalender/${id}`, 'DELETE'),
};
