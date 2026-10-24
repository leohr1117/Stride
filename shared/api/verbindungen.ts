import type { Kalender } from './kalender.ts';
import type { TodoistStatus } from './todoist.ts';

export const ABGLEICH_MINUTEN = 15;

export interface AbgleichErgebnis {
  neu: number;
  fehler: string[];
}

export interface Verbindungen {
  todoist: TodoistStatus;
  kalender: Kalender[];
}
