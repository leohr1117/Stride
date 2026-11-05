export type Rolle = 'inhaber' | 'mitglied';

export type ZugangModus = 'einrichten' | 'passwort' | 'anmelden' | 'benutzername' | 'bereit';

export interface ZugangStatus {
  modus: ZugangModus;
  benutzername: string | null;
  rolle: Rolle | null;
  /** Wahr nur, wenn der angemeldete Name STRIDE_ADMIN entspricht. */
  admin: boolean;
}

export interface Konto {
  id: number;
  benutzername: string;
  rolle: Rolle;
  /** Wahr, wenn der Benutzername der Admin aus der Umgebung ist. */
  admin: boolean;
}

/** Öffentliche Zeile der Admin-Liste. Dieselben Felder wie Konto, ohne Welt. */
export type AdminKonto = Konto;
