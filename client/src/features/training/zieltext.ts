import { anzeigeAusGramm, type GewichtEinheit, type UebungsArt } from '../../../../shared/spiel/training.ts';
import { eineNachkommastelle } from '../../format.ts';
import { tx } from '../../text.ts';

export const WOCHENTAGE = [
  { tag: 1, label: 'Mo' },
  { tag: 2, label: 'Di' },
  { tag: 3, label: 'Mi' },
  { tag: 4, label: 'Do' },
  { tag: 5, label: 'Fr' },
  { tag: 6, label: 'Sa' },
  { tag: 7, label: 'So' },
] as const;

const MS_PRO_MINUTE = 60 * 1000;

export function tageText(tage: readonly number[]): string | null {
  const sortiert = [...new Set(tage.filter((tag) => tag >= 1 && tag <= 7))].sort((links, rechts) => links - rechts);
  if (sortiert.length === 0) {
    return null;
  }
  return sortiert
    .map((tag) => WOCHENTAGE.find((kandidat) => kandidat.tag === tag)?.label ?? '')
    .filter((label) => label !== '')
    .map((label) => tx(label))
    .join(' · ');
}

interface ZielQuelle {
  art: UebungsArt;
  saetze: number | null;
  wiederholungen: number | null;
  sekunden: number | null;
  gewichtG: number | null;
}

export function zielText(quelle: ZielQuelle, einheit: GewichtEinheit): string {
  if (quelle.art === 'dauer') {
    if (quelle.sekunden === null) {
      return '';
    }
    const dauer = tx('{sekunden} s', { sekunden: quelle.sekunden });
    return quelle.saetze === null ? dauer : `${quelle.saetze} × ${dauer}`;
  }
  if (quelle.wiederholungen === null) {
    return '';
  }
  const kern = quelle.saetze === null ? String(quelle.wiederholungen) : `${quelle.saetze} × ${quelle.wiederholungen}`;
  if (quelle.gewichtG === null) {
    return kern;
  }
  const einheitText = einheit === 'lb' ? tx('lb') : tx('kg');
  return `${kern} · ${eineNachkommastelle(anzeigeAusGramm(quelle.gewichtG, einheit))} ${einheitText}`;
}

export function warmupText(
  quelle: {
    art: UebungsArt;
    aufwaermSaetze: number | null;
    aufwaermWiederholungen: number | null;
    aufwaermSekunden: number | null;
    aufwaermGewichtG: number | null;
  },
  einheit: GewichtEinheit,
): string | null {
  const ziel = zielText(
    {
      art: quelle.art,
      saetze: quelle.aufwaermSaetze,
      wiederholungen: quelle.aufwaermWiederholungen,
      sekunden: quelle.aufwaermSekunden,
      gewichtG: quelle.aufwaermGewichtG,
    },
    einheit,
  );
  if (ziel === '') {
    return null;
  }
  return `${tx('Aufwärmen')} · ${ziel}`;
}

export function minutenText(vonIso: string, bis: Date): string {
  const start = Date.parse(vonIso);
  const differenz = bis.getTime() - start;
  if (!Number.isFinite(differenz) || differenz < MS_PRO_MINUTE) {
    return tx('gerade gestartet');
  }
  return tx('{minuten} Min', { minuten: Math.floor(differenz / MS_PRO_MINUTE) });
}
