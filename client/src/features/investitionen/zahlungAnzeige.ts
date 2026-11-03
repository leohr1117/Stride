import type { AttributTyp } from '../../../../shared/spiel/begriffe.ts';
import { berechneLevel, LEVEL_KURVEN, type LevelKurve } from '../../../../shared/spiel/level.ts';

export type BetragProblem = 'leer' | 'zuwenig';

export function kurveFuerTyp(typ: AttributTyp): LevelKurve {
  return typ === 'status' ? LEVEL_KURVEN.status : LEVEL_KURVEN.attribut;
}

/** XP, das für eine neue Zahlung dieses Attributs da ist. Bereits gezahltes XP kommt vorher zurück. */
export function verfuegbaresXp(xpGesamt: number, bisherBetrag: number): number {
  return Math.max(0, Math.floor(xpGesamt)) + Math.max(0, bisherBetrag);
}

export function betragAusText(text: string): number | null {
  if (text === '') {
    return null;
  }
  if (!/^\d{1,15}$/.test(text)) {
    return null;
  }
  const wert = Number(text);
  return Number.isSafeInteger(wert) ? wert : null;
}

export function betragProblem(bezahlt: boolean, text: string, verfuegbar: number): BetragProblem | null {
  if (!bezahlt) {
    return null;
  }
  const betrag = betragAusText(text);
  if (betrag === null) {
    return 'leer';
  }
  if (betrag > verfuegbar) {
    return 'zuwenig';
  }
  return null;
}

export function bisherigerBetrag(bezahltAttributId: number | null, betrag: number, gewaehlt: number | null): number {
  if (gewaehlt === null || bezahltAttributId !== gewaehlt || betrag <= 0) {
    return 0;
  }
  return betrag;
}

/** Level nach der Zahlung, wenn es unter das aktuelle fällt. Sonst null. */
export function levelDanach(xpGesamt: number, xpNeu: number, kurve: LevelKurve): number | null {
  if (xpNeu < 0) {
    return null;
  }
  const jetzt = berechneLevel(Math.max(0, Math.floor(xpGesamt)), kurve).level;
  const danach = berechneLevel(xpNeu, kurve).level;
  return danach < jetzt ? danach : null;
}

export function zahlungVon(bezahltId: number | null, text: string): { bezahltAttributId: number | null; betrag: number } {
  const betrag = betragAusText(text);
  if (bezahltId === null || betrag === null || betrag === 0) {
    return { bezahltAttributId: null, betrag: 0 };
  }
  return { bezahltAttributId: bezahltId, betrag };
}

/** Deutscher Satz. Die Oberfläche übersetzt ihn über die Vorlage mit den Platzhaltern. */
export function loeschHinweis(betrag: number, name: string): string | null {
  if (!Number.isInteger(betrag) || betrag <= 0 || name.trim() === '') {
    return null;
  }
  return `Die ${betrag} XP gehen zurück an ${name}.`;
}
