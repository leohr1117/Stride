import type { Konto, ZugangStatus } from '../../../shared/api/zugang.ts';
import { anfrage } from './kern.ts';

export const zugangApi = {
  zugang: () => anfrage<ZugangStatus>('/zugang'),
  anmelden: (daten: { benutzername?: string; passwort: string }) => anfrage<ZugangStatus>('/zugang', 'POST', daten),
  abmelden: () => anfrage<void>('/zugang/abmelden', 'POST', {}),
  aenderePasswort: (bisher: string, neu: string) => anfrage<ZugangStatus>('/zugang/passwort', 'POST', { bisher, neu }),
  setzeBenutzername: (benutzername: string) => anfrage<ZugangStatus>('/zugang/benutzername', 'POST', { benutzername }),
  konten: () => anfrage<Konto[]>('/zugang/konten'),
  erstelleKonto: (daten: { benutzername: string; passwort: string; profilname?: string }) =>
    anfrage<Konto>('/zugang/konten', 'POST', daten),
  loescheKonto: (id: number) => anfrage<void>(`/zugang/konten/${id}`, 'DELETE'),
};

export const zugangSchluessel = {
  zugang: ['zugang'],
  konten: ['konten'],
} as const;
