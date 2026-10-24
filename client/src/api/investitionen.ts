import type { Investition, InvestitionAenderung, InvestitionDaten } from '../../../shared/api/investitionen.ts';
import { anfrage } from './kern.ts';

export const investitionenApi = {
  investitionen: () => anfrage<Investition[]>('/investitionen'),
  erstelleInvestition: (daten: InvestitionDaten) => anfrage<Investition>('/investitionen', 'POST', daten),
  aendereInvestition: (id: number, daten: InvestitionAenderung) => anfrage<Investition>(`/investitionen/${id}`, 'PATCH', daten),
  loescheInvestition: (id: number) => anfrage<void>(`/investitionen/${id}`, 'DELETE'),
};

export const investitionenSchluessel = {
  investitionen: ['investitionen'],
} as const;
