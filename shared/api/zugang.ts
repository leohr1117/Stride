export type Rolle = 'inhaber' | 'mitglied';

export type ZugangModus = 'einrichten' | 'passwort' | 'anmelden' | 'benutzername' | 'bereit';

export interface ZugangStatus {
  modus: ZugangModus;
  benutzername: string | null;
  rolle: Rolle | null;
  /** Wahr nur, wenn der angemeldete Name ASCEND_ADMIN entspricht. */
  admin: boolean;
}

export interface Konto {
  id: number;
  benutzername: string;
  rolle: Rolle;
}

/** Konto in der Admin-Liste. Ohne Rolle und ohne Welt, nur zum Umbenennen. */
export interface AdminKonto {
  id: number;
  benutzername: string;
}
