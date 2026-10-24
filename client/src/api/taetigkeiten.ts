import type { Vorlage, VorlageDaten } from '../../../shared/api/taetigkeiten.ts';
import { anfrage, type MitArchiv } from './kern.ts';

export const taetigkeitenApi = {
  vorlagen: () => anfrage<Vorlage[]>('/vorlagen'),
  erstelleVorlage: (daten: VorlageDaten) => anfrage<Vorlage>('/vorlagen', 'POST', daten),
  aendereVorlage: (id: number, daten: MitArchiv<VorlageDaten>) => anfrage<Vorlage>(`/vorlagen/${id}`, 'PATCH', daten),
  loescheVorlage: (id: number) => anfrage<void>(`/vorlagen/${id}`, 'DELETE'),
};

export const taetigkeitenSchluessel = {
  vorlagen: ['vorlagen'],
} as const;
