import type { AdminKonto, Konto, ZugangStatus } from '../../../shared/api/zugang.ts';
import { anfrage } from './kern.ts';

export const zugangApi = {
  zugang: () => anfrage<ZugangStatus>('/zugang'),
  anmelden: (daten: { benutzername?: string; passwort: string }) => anfrage<ZugangStatus>('/zugang', 'POST', daten),
  registrieren: (daten: { benutzername: string; passwort: string }) =>
    anfrage<ZugangStatus>('/zugang/registrieren', 'POST', daten),
  abmelden: () => anfrage<void>('/zugang/abmelden', 'POST', {}),
  loeseGoogle: () => anfrage<void>('/zugang/google', 'DELETE'),
  aenderePasswort: (bisher: string, neu: string) => anfrage<ZugangStatus>('/zugang/passwort', 'POST', { bisher, neu }),
  setzeBenutzername: (benutzername: string) => anfrage<ZugangStatus>('/zugang/benutzername', 'POST', { benutzername }),
  konten: () => anfrage<Konto[]>('/zugang/konten'),
  erstelleKonto: (daten: { benutzername: string; passwort: string; profilname?: string }) =>
    anfrage<Konto>('/zugang/konten', 'POST', daten),
  loescheKonto: (id: number) => anfrage<void>(`/zugang/konten/${id}`, 'DELETE'),
  loescheEigenesKonto: (passwort: string) => anfrage<void>('/zugang/konto/loeschen', 'POST', { passwort }),
  adminKonten: () => anfrage<AdminKonto[]>('/zugang/admin/konten'),
  aendereAdminBenutzername: (id: number, benutzername: string) =>
    anfrage<AdminKonto>(`/zugang/admin/konten/${id}/benutzername`, 'POST', { benutzername }),
};

export const zugangSchluessel = {
  zugang: ['zugang'],
  konten: ['konten'],
  adminKonten: ['admin-konten'],
} as const;
