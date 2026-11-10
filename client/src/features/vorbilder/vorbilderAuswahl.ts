import { RICHTUNGEN, richtungenMitPersonen, type Richtung } from '../../../../shared/features/vorbilder/index.ts';
import { leseSitzungstext, merkeSitzungstext, vergissSitzung } from '../../speicher.ts';

const SPEICHER = 'stride.vorbilder.richtung';
const ALLE = 'alle';

export type VorbildAuswahl = typeof ALLE | Richtung;

export function istRichtung(wert: string | null): wert is Richtung {
  return wert !== null && (RICHTUNGEN as readonly string[]).includes(wert);
}

function richtungMitPersonen(wert: string | null): wert is Richtung {
  return istRichtung(wert) && (richtungenMitPersonen() as readonly string[]).includes(wert);
}

export function auswahlAus(parameter: string | null, gespeichert: string | null): VorbildAuswahl {
  if (richtungMitPersonen(parameter)) {
    return parameter;
  }
  if (parameter) {
    return ALLE;
  }
  return richtungMitPersonen(gespeichert) ? gespeichert : ALLE;
}

export function speichereRichtung(auswahl: VorbildAuswahl): void {
  if (auswahl === ALLE) {
    vergissSitzung(SPEICHER);
    return;
  }
  merkeSitzungstext(SPEICHER, auswahl);
}

export function gespeicherteRichtung(): string | null {
  return leseSitzungstext(SPEICHER);
}

export function vorbilderListePfad(): string {
  const richtung = gespeicherteRichtung();
  return richtungMitPersonen(richtung) ? `/vorbilder?richtung=${encodeURIComponent(richtung)}` : '/vorbilder';
}
