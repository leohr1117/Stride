export type Rolle = 'inhaber' | 'mitglied';

export type ZugangModus = 'einrichten' | 'passwort' | 'anmelden' | 'benutzername' | 'bereit';

export interface ZugangStatus {
  modus: ZugangModus;
  benutzername: string | null;
  rolle: Rolle | null;
}

export interface Konto {
  id: number;
  benutzername: string;
  rolle: Rolle;
}
