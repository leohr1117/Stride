import type { AttributKennung } from '../../../shared/spiel/begriffe.ts';
import type { AktivierungsModus, Attribut, AttributDaten } from '../../../shared/api/attribute.ts';
import { anfrage, type MitArchiv } from './kern.ts';

export const attributeApi = {
  attribute: () => anfrage<Attribut[]>('/attribute'),
  aktiviereAttribut: (kennung: AttributKennung, modus: AktivierungsModus, level: number | null) =>
    anfrage<Attribut>('/attribute', 'POST', { kennung, modus, level }),
  aendereAttribut: (id: number, daten: MitArchiv<AttributDaten>) => anfrage<Attribut>(`/attribute/${id}`, 'PATCH', daten),
  loescheAttribut: (id: number) => anfrage<void>(`/attribute/${id}`, 'DELETE'),
};

export const attributeSchluessel = {
  attribute: ['attribute'],
} as const;
