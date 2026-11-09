export const ANFRAGE_GRENZE = {
  jeMinuteAdresse: 300,
  jeMinuteKonto: 600,
  testJeMinute: 1_000_000,
  fensterMs: 60_000,
} as const;

export const REGISTRIERUNG_GRENZE = {
  jeStunde: 5,
  testJeStunde: 1_000_000,
  fensterMs: 60 * 60 * 1000,
} as const;

export const ZU_VIELE = 'Zu viele Anfragen. Bitte warte kurz und versuch es noch einmal.';

const registrierungen = new Map<string, number[]>();

function registrierMaximum(): number {
  if (process.env.STRIDE_TEST === '1') {
    return REGISTRIERUNG_GRENZE.testJeStunde;
  }
  return REGISTRIERUNG_GRENZE.jeStunde;
}

export function registrierungErlaubt(adresse: string, jetzt = Date.now()): boolean {
  const ab = jetzt - REGISTRIERUNG_GRENZE.fensterMs;
  const bisher = (registrierungen.get(adresse) ?? []).filter((zeit) => zeit > ab);
  if (bisher.length >= registrierMaximum()) {
    registrierungen.set(adresse, bisher);
    return false;
  }
  bisher.push(jetzt);
  registrierungen.set(adresse, bisher);
  return true;
}

export function setzeRegistrierungenZurueck(): void {
  registrierungen.clear();
}
