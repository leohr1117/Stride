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
const kontakte = new Map<string, number[]>();

function stundenMaximum(): number {
  if (process.env.STRIDE_TEST === '1') {
    return REGISTRIERUNG_GRENZE.testJeStunde;
  }
  return REGISTRIERUNG_GRENZE.jeStunde;
}

function imFenster(buch: Map<string, number[]>, adresse: string, jetzt: number): boolean {
  const ab = jetzt - REGISTRIERUNG_GRENZE.fensterMs;
  const bisher = (buch.get(adresse) ?? []).filter((zeit) => zeit > ab);
  if (bisher.length >= stundenMaximum()) {
    buch.set(adresse, bisher);
    return false;
  }
  bisher.push(jetzt);
  buch.set(adresse, bisher);
  return true;
}

export function registrierungErlaubt(adresse: string, jetzt = Date.now()): boolean {
  return imFenster(registrierungen, adresse, jetzt);
}

export function kontaktErlaubt(adresse: string, jetzt = Date.now()): boolean {
  return imFenster(kontakte, adresse, jetzt);
}

export function setzeRegistrierungenZurueck(): void {
  registrierungen.clear();
}

export function setzeKontakteZurueck(): void {
  kontakte.clear();
}
