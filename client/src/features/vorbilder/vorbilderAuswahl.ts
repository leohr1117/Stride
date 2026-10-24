import { RICHTUNGEN, type Richtung } from '../../../../shared/features/vorbilder/index.ts';

const SPEICHER = 'ascend.vorbilder.richtung';
const ALLE = 'alle';

export type VorbildAuswahl = typeof ALLE | Richtung;

export function istRichtung(wert: string | null): wert is Richtung {
  return wert !== null && (RICHTUNGEN as readonly string[]).includes(wert);
}

export function auswahlAus(parameter: string | null, gespeichert: string | null): VorbildAuswahl {
  if (istRichtung(parameter)) {
    return parameter;
  }
  if (parameter) {
    return ALLE;
  }
  return istRichtung(gespeichert) ? gespeichert : ALLE;
}

export function speichereRichtung(auswahl: VorbildAuswahl): void {
  try {
    if (auswahl === ALLE) {
      sessionStorage.removeItem(SPEICHER);
      return;
    }
    sessionStorage.setItem(SPEICHER, auswahl);
  } catch {
    return;
  }
}

export function gespeicherteRichtung(): string | null {
  try {
    return sessionStorage.getItem(SPEICHER);
  } catch {
    return null;
  }
}

export function vorbilderListePfad(): string {
  const richtung = gespeicherteRichtung();
  return istRichtung(richtung) ? `/vorbilder?richtung=${encodeURIComponent(richtung)}` : '/vorbilder';
}
