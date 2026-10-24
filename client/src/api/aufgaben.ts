import type { Aufgabe, AufgabeDaten } from '../../../shared/api/aufgaben.ts';
import type { EintragErgebnis } from '../../../shared/api/eintraege.ts';
import { abfrageText, anfrage, type MitArchiv } from './kern.ts';

export const aufgabenApi = {
  aufgaben: (archiv = false) =>
    anfrage<Aufgabe[]>(`/aufgaben${abfrageText({ archiv: archiv ? '1' : undefined })}`),
  erstelleAufgabe: (daten: AufgabeDaten) => anfrage<Aufgabe>('/aufgaben', 'POST', daten),
  aendereAufgabe: (id: number, daten: MitArchiv<AufgabeDaten>) =>
    anfrage<Aufgabe>(`/aufgaben/${id}`, 'PATCH', daten),
  loescheAufgabe: (id: number) => anfrage<void>(`/aufgaben/${id}`, 'DELETE'),
  erledigeAufgabe: (id: number) => anfrage<EintragErgebnis>(`/aufgaben/${id}/erledigen`, 'POST', {}),
};

export const aufgabenSchluessel = {
  aufgaben: ['aufgaben'],
} as const;
