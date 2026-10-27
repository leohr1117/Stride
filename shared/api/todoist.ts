export type TodoistZielArt = 'vision' | 'projekt' | 'vorhaben';
export type TodoistAbschluss = 'geschafft' | 'gescheitert' | 'offen';

export interface TodoistZuordnung {
  todoistId: string;
  name: string;
  zielArt: TodoistZielArt | null;
  zielId: number | null;
  projektId: number | null;
  vorlageId: number | null;
  stunden: number | null;
  faehigkeitId: number | null;
  abschluss: 'geschafft' | 'gescheitert' | null;
  erkenntnis: string;
  notiz: string;
  meilenstein: boolean;
}

export interface TodoistZuordnungDaten {
  projektId: number | null;
  vorlageId: number | null;
  stunden: number | null;
  zielArt?: TodoistZielArt | null;
  zielId?: number | null;
  faehigkeitId?: number | null;
  abschluss?: 'geschafft' | 'gescheitert' | null;
  erkenntnis?: string;
  notiz?: string;
  meilenstein?: boolean;
}

export interface TodoistLabel {
  todoistId: string;
  name: string;
  aktiv: boolean;
  rang: number;
  zielArt: TodoistZielArt | null;
  zielId: number | null;
  projektId: number | null;
  vorlageId: number | null;
  stunden: number | null;
  faehigkeitId: number | null;
  abschluss: TodoistAbschluss | null;
  erkenntnis: string;
  notiz: string;
  meilenstein: boolean | null;
}

export interface TodoistLabelDaten {
  aktiv: boolean;
  zielArt: TodoistZielArt | null;
  zielId: number | null;
  projektId: number | null;
  vorlageId: number | null;
  stunden: number | null;
  faehigkeitId: number | null;
  abschluss: TodoistAbschluss | null;
  erkenntnis: string;
  notiz: string;
  meilenstein: boolean | null;
}

export type TodoistOhne = 'keine' | 'standard';

export interface TodoistVorschau {
  xp: number;
  anzahl: number;
}

export interface TodoistStatus {
  verbunden: boolean;
  nutzer: string | null;
  seit: string | null;
  letzterAbgleich: string | null;
  fehler: string | null;
  /** Erledigte Aufgaben ohne Projekt- oder Label-Zuordnung. */
  ohneZuordnung: TodoistOhne;
  standardVorlageId: number | null;
  projekte: TodoistZuordnung[];
  labels: TodoistLabel[];
}
