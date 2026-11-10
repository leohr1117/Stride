import type { Verbindungen } from '../../../../shared/api/index.ts';
import { tx, txMenge } from '../../text.ts';

export function fehlerAnzeige(fehler: string): string {
  return fehler
    .split('\n')
    .map((zeile) => zeile.trim())
    .filter((zeile) => zeile !== '')
    .map((zeile) => {
      const trenn = zeile.indexOf(': ');
      if (trenn > 0) {
        const name = zeile.slice(0, trenn);
        const rest = zeile.slice(trenn + 2);
        const satz = tx(rest);
        if (satz !== rest) {
          return `${name}: ${satz}`;
        }
      }
      return tx(zeile);
    })
    .join('\n');
}

export type VerbindungsLage = 'verbunden' | 'fehler' | 'aus';

export function todoistLage(status: { verbunden: boolean; fehler: string | null }): VerbindungsLage {
  if (status.fehler) {
    return 'fehler';
  }
  if (status.verbunden) {
    return 'verbunden';
  }
  return 'aus';
}

export function kalenderLage(kalender: readonly { fehler: string | null }[]): VerbindungsLage {
  if (kalender.some((eintrag) => eintrag.fehler)) {
    return 'fehler';
  }
  if (kalender.length > 0) {
    return 'verbunden';
  }
  return 'aus';
}

export function verbindungsStand(daten: Verbindungen): { text: string; fehler: boolean } | null {
  const fehler = daten.todoist.fehler ?? daten.kalender.find((kalender) => kalender.fehler)?.fehler ?? null;
  if (fehler) {
    return { text: fehlerAnzeige(fehler).split('\n')[0] ?? fehler, fehler: true };
  }
  const teile: string[] = [];
  if (daten.todoist.verbunden) {
    teile.push(tx('Todoist verbunden'));
  }
  if (daten.kalender.length === 1) {
    teile.push(daten.kalender[0].name);
  } else if (daten.kalender.length > 1) {
    teile.push(txMenge(daten.kalender.length, '{anzahl} Kalender', { anzahl: daten.kalender.length }));
  }
  return teile.length > 0 ? { text: teile.join(' · '), fehler: false } : null;
}
