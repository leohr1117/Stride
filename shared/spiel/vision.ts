export interface WoopFelder {
  ergebnis: string;
  hindernis: string;
  plan: string;
}

export function istWoopVollstaendig(woop: WoopFelder): boolean {
  return woop.ergebnis.trim() !== '' && woop.hindernis.trim() !== '' && woop.plan.trim() !== '';
}
