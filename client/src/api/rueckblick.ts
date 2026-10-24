import type { Rueckblick, RueckblickAntworten, RueckblickErgebnis } from '../../../shared/api/rueckblick.ts';
import { abfrageText, anfrage } from './kern.ts';

export const rueckblickApi = {
  rueckblick: (woche: string) => anfrage<Rueckblick>(`/rueckblick${abfrageText({ woche })}`),
  speichereRueckblick: (woche: string, antworten: RueckblickAntworten) =>
    anfrage<RueckblickErgebnis>(`/rueckblick/${woche}`, 'PUT', antworten),
};

export const rueckblickSchluessel = {
  rueckblick: (woche: string) => ['rueckblick', woche] as const,
};
