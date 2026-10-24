import type { Bestwert } from '../../../../shared/api/training.ts';
import { anzeigeAusGramm, type GewichtEinheit, type UebungsArt } from '../../../../shared/spiel/training.ts';
import { eineNachkommastelle, kurzesDatum } from '../../format.ts';
import { tx } from '../../text.ts';
import { minutenText } from './zieltext.ts';

export type KreisStand = 'leer' | 'halb' | 'an';

interface SatzZahlen {
  gewichtG: number | null;
  wiederholungen: number | null;
  sekunden: number | null;
}

interface StatusQuelle {
  status: 'offen' | 'fertig';
  begonnenAm: string;
  beendetAm: string | null;
  aenderbar: boolean;
}

export function kreisStand(saetze: readonly { erledigt: boolean }[]): KreisStand {
  if (saetze.length === 0) {
    return 'leer';
  }
  const an = saetze.filter((satz) => satz.erledigt).length;
  if (an === 0) {
    return 'leer';
  }
  if (an === saetze.length) {
    return 'an';
  }
  return 'halb';
}

export function satzText(satz: SatzZahlen, art: UebungsArt, gewicht: GewichtEinheit): string {
  if (art === 'dauer') {
    return satz.sekunden === null ? '' : tx('{sekunden} s', { sekunden: satz.sekunden });
  }
  if (satz.wiederholungen === null) {
    return '';
  }
  if (satz.gewichtG === null) {
    return tx('{wiederholungen} Wiederholungen', { wiederholungen: satz.wiederholungen });
  }
  const zahl = eineNachkommastelle(anzeigeAusGramm(satz.gewichtG, gewicht));
  const einheit = gewicht === 'lb' ? tx('lb') : tx('kg');
  return `${zahl} ${einheit} × ${satz.wiederholungen}`;
}

export function zuletztText(werte: readonly Bestwert[], art: UebungsArt, gewicht: GewichtEinheit): string | null {
  if (art === 'dauer') {
    const treffer = werte.find((wert) => wert.art === 'dauer');
    return treffer ? tx('{sekunden} s', { sekunden: treffer.wert }) : null;
  }
  const treffer = werte.find((wert) => wert.art === 'gewicht' && wert.wiederholungen !== null);
  if (!treffer || treffer.wiederholungen === null) {
    return null;
  }
  const text = satzText(
    { gewichtG: treffer.wert, wiederholungen: treffer.wiederholungen, sekunden: null },
    'kraft',
    gewicht,
  );
  return text === '' ? null : text;
}

export function statusText(quelle: StatusQuelle, gewicht: GewichtEinheit, jetzt: Date): string {
  const ende = quelle.beendetAm === null ? jetzt : new Date(quelle.beendetAm);
  const dauer = minutenText(quelle.begonnenAm, ende);
  if (quelle.status === 'fertig' && !quelle.aenderbar) {
    return tx('{datum} · {dauer} · fertig', {
      datum: kurzesDatum(quelle.beendetAm ?? quelle.begonnenAm),
      dauer,
    });
  }
  if (gewicht === 'lb') {
    const vorlage = quelle.status === 'fertig' ? 'Fertig · {dauer} · lb' : 'Offen · {dauer} · lb';
    return tx(vorlage, { dauer });
  }
  const vorlage = quelle.status === 'fertig' ? 'Fertig · {dauer}' : 'Offen · {dauer}';
  return tx(vorlage, { dauer });
}
