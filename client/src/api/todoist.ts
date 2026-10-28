import type { TodoistLabelDaten, TodoistOhne, TodoistStatus, TodoistZuordnungDaten } from '../../../shared/api/todoist.ts';
import { anfrage } from './kern.ts';

export const todoistApi = {
  verbindeTodoist: (token: string) => anfrage<TodoistStatus>('/verbindungen/todoist', 'PUT', { token }),
  trenneTodoist: () => anfrage<void>('/verbindungen/todoist', 'DELETE'),
  ordneTodoistZu: (todoistId: string, daten: TodoistZuordnungDaten) =>
    anfrage<TodoistStatus>(`/verbindungen/todoist/projekte/${encodeURIComponent(todoistId)}`, 'PATCH', daten),
  ordneTodoistLabel: (todoistId: string, daten: TodoistLabelDaten) =>
    anfrage<TodoistStatus>(`/verbindungen/todoist/labels/${encodeURIComponent(todoistId)}`, 'PATCH', daten),
  ordneTodoistLabelReihenfolge: (ids: string[]) =>
    anfrage<TodoistStatus>('/verbindungen/todoist/label-reihenfolge', 'PUT', { ids }),
  setzeTodoistOhne: (art: TodoistOhne, vorlageId: number | null) =>
    anfrage<TodoistStatus>('/verbindungen/todoist/ohne', 'PATCH', { art, vorlageId }),
};
