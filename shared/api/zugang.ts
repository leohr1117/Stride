export type Rolle = 'inhaber' | 'mitglied';

export type ZugangModus = 'einrichten' | 'passwort' | 'anmelden' | 'benutzername' | 'bereit';

export interface ZugangStatus {
  modus: ZugangModus;
  benutzername: string | null;
  rolle: Rolle | null;
  /** Wahr nur, wenn der angemeldete Name STRIDE_ADMIN entspricht. */
  admin: boolean;
  /** Wahr, wenn STRIDE_REGISTRIERUNG auf 1 steht. */
  registrierung: boolean;
  /** Wahr, wenn die Anmeldung über Google erlaubt ist. */
  google: boolean;
  /** Gespeicherte Adresse der Verknüpfung. Null, wenn keine besteht. */
  googleEmail: string | null;
  /** Adresse aus einem offenen Google-Vorgang zum Anlegen. */
  googleAnlage: string | null;
  /** Wahr, wenn die Verknüpfung gelöst werden darf. */
  googleLoesen: boolean;
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
