import { tx, txMenge } from '../text.ts';
import { DAUER_OPTIONEN, GRENZEN } from '../../../shared/spiel/begriffe.ts';
import { localeFuer } from '../../../shared/sprache/kern.ts';
import { aktiveSprache } from '../../../shared/sprache/index.ts';

/** Kurze Dauer im Eintrag-Dialog. 4 Std und Ganzer Tag nur über das eigene Feld. */
export const SCHNELL_DAUER = [0.25, 0.5, 1, 2] as const;

export interface DauerZahl {
  stunden: number | null;
  fehler: string | null;
  unfertig: boolean;
}

export interface DauerStand {
  stunden: number | null;
  text: string;
  eigene: boolean;
}

export interface DauerOption {
  id: string;
  wert: string;
  zeile: string;
  name: string;
}

function mindestFehler(): string {
  return txMenge(GRENZEN.stundenMin, 'Die Dauer muss mindestens {min} Stunden sein.', { min: String(GRENZEN.stundenMin) });
}

function hoechstFehler(): string {
  return txMenge(GRENZEN.stundenMax, 'Die Dauer darf höchstens {max} Stunden sein.', { max: String(GRENZEN.stundenMax) });
}

/** Punkt als Trenner. Komma wird vorher in bereinigeDauer zum Punkt. */
export function dauerTextZuZahl(text: string): DauerZahl {
  const roh = text.trim();
  if (roh === '') {
    return { stunden: null, fehler: null, unfertig: false };
  }
  if (roh === '.' || /^\d+\.$/.test(roh)) {
    return { stunden: null, fehler: null, unfertig: true };
  }
  if (!/^\d+(\.\d+)?$/.test(roh)) {
    return { stunden: null, fehler: mindestFehler(), unfertig: false };
  }
  const wert = Number(roh);
  if (wert < GRENZEN.stundenMin) {
    return { stunden: null, fehler: mindestFehler(), unfertig: false };
  }
  if (wert > GRENZEN.stundenMax) {
    return { stunden: null, fehler: hoechstFehler(), unfertig: false };
  }
  return { stunden: wert, fehler: null, unfertig: false };
}

export function bereinigeDauer(roh: string): string {
  const erlaubt = roh.replace(',', '.').replace(/[^\d.]/g, '');
  const [ganz, ...rest] = erlaubt.split('.');
  const kopf = (ganz ?? '').slice(0, 2);
  if (rest.length === 0) {
    return kopf;
  }
  return `${kopf}.${rest.join('').slice(0, 2)}`;
}

export function dauerFeldFehler(ergebnis: DauerZahl, erzwungen: boolean): string | null {
  if (ergebnis.fehler) {
    return ergebnis.fehler;
  }
  if (erzwungen && ergebnis.unfertig) {
    return mindestFehler();
  }
  return null;
}

/** Keine Angabe und jede Dauer aus der gemeinsamen Liste, Schreibweise mit Punkt. */
export function dauerOptionen(): DauerOption[] {
  return [
    { id: 'keine', wert: '', zeile: tx('Keine Angabe'), name: tx('Keine Angabe') },
    ...DAUER_OPTIONEN.map((option) => ({
      id: String(option.stunden),
      wert: String(option.stunden),
      zeile: tx(option.label),
      name: tx(option.label),
    })),
  ];
}

function dezimalTrenner(): string {
  const teile = new Intl.NumberFormat(localeFuer(aktiveSprache()), {
    useGrouping: false,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).formatToParts(1.1);
  return teile.find((teil) => teil.type === 'decimal')?.value ?? '.';
}

/** Zahl in der Schreibweise der aktiven Sprache, ohne Tausenderzeichen. */
export function dauerInSchreibweise(stunden: number): string {
  return new Intl.NumberFormat(localeFuer(aktiveSprache()), {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(stunden);
}

/** Tippen mit Komma oder Punkt wird zur Schreibweise der Sprache. Intern bleibt der Punkt. */
export function schreibweiseAusRoh(roh: string): string {
  const punkt = bereinigeDauer(roh);
  const trenn = dezimalTrenner();
  if (trenn === '.') {
    return punkt;
  }
  return punkt.replace(/\./g, trenn);
}

export function istSchnellDauer(stunden: number): boolean {
  return (SCHNELL_DAUER as readonly number[]).includes(stunden);
}

/** Chip, wenn der Wert zu den kurzen Dauern passt. Sonst das eigene Feld. */
export function dauerAnfang(stunden: number | null): DauerStand {
  if (stunden === null || !Number.isFinite(stunden)) {
    return { stunden: null, text: '', eigene: false };
  }
  if (istSchnellDauer(stunden)) {
    return { stunden, text: '', eigene: false };
  }
  return { stunden, text: dauerInSchreibweise(stunden), eigene: true };
}

export function dauerPruefung(stand: DauerStand, erzwungen = false): DauerZahl {
  if (!stand.eigene) {
    return { stunden: stand.stunden, fehler: null, unfertig: false };
  }
  const ergebnis = dauerTextZuZahl(bereinigeDauer(stand.text));
  const fehler = dauerFeldFehler(ergebnis, erzwungen);
  return fehler === ergebnis.fehler ? ergebnis : { ...ergebnis, fehler };
}
