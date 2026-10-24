import type { Verbindungen } from '../../../../shared/api/index.ts';
import { tx } from '../../text.ts';

export function verbindungsStand(daten: Verbindungen): { text: string; fehler: boolean } | null {
  const fehler = daten.todoist.fehler ?? daten.kalender.find((kalender) => kalender.fehler)?.fehler ?? null;
  if (fehler) {
    return { text: fehler, fehler: true };
  }
  const teile: string[] = [];
  if (daten.todoist.verbunden) {
    teile.push(tx('Todoist verbunden'));
  }
  if (daten.kalender.length === 1) {
    teile.push(daten.kalender[0].name);
  } else if (daten.kalender.length > 1) {
    teile.push(tx('{anzahl} Kalender', { anzahl: daten.kalender.length }));
  }
  return teile.length > 0 ? { text: teile.join(' · '), fehler: false } : null;
}
