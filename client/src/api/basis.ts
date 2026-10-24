import type { BasisAufgabe, BasisAufgabeDaten } from '../../../shared/api/basis.ts';
import type { EintragErgebnis } from '../../../shared/api/eintraege.ts';
import { anfrage, type MitArchiv } from './kern.ts';

export const basisApi = {
  basis: () => anfrage<BasisAufgabe[]>('/basis'),
  erstelleBasisAufgabe: (daten: BasisAufgabeDaten) => anfrage<BasisAufgabe>('/basis', 'POST', daten),
  aendereBasisAufgabe: (id: number, daten: MitArchiv<BasisAufgabeDaten>) =>
    anfrage<BasisAufgabe>(`/basis/${id}`, 'PATCH', daten),
  loescheBasisAufgabe: (id: number) => anfrage<void>(`/basis/${id}`, 'DELETE'),
  erledigeBasisAufgabe: (id: number) => anfrage<EintragErgebnis>(`/basis/${id}/erledigen`, 'POST', {}),
};

export const basisSchluessel = {
  basis: ['basis'],
} as const;
