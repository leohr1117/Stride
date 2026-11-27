import { useSyncExternalStore } from 'react';
import { groessterEffekt, type EffektGroesse } from '../../../shared/spiel/effekte.ts';

let groesse: EffektGroesse | null = null;
const hoerer = new Set<() => void>();

function bescheid(): void {
  for (const eintrag of hoerer) {
    eintrag();
  }
}

export function setzeFeierGroesse(naechste: EffektGroesse | null): void {
  if (groesse === naechste) {
    return;
  }
  groesse = naechste;
  bescheid();
}

export function feierGroesseAus(groessen: readonly EffektGroesse[]): EffektGroesse | null {
  return groessterEffekt(groessen.map((groesseEintrag) => ({ groesse: groesseEintrag })))?.groesse ?? null;
}

export function leseFeierGroesse(): EffektGroesse | null {
  return groesse;
}

function abonnieren(beiAenderung: () => void): () => void {
  hoerer.add(beiAenderung);
  return () => {
    hoerer.delete(beiAenderung);
  };
}

export function useFeierGroesse(): EffektGroesse | null {
  return useSyncExternalStore(abonnieren, leseFeierGroesse, leseFeierGroesse);
}
