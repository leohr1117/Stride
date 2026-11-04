import { DAUER_OPTIONEN } from '../../shared/spiel/begriffe.ts';
import { ausTagesSchluessel, lokalesDatum, MS_PRO_TAG, TAGE_PRO_WOCHE, wochenbeginn } from '../../shared/spiel/datum.ts';
import type { Multiplikator, MultiplikatorArt } from '../../shared/spiel/xp.ts';
import { localeFuer } from '../../shared/sprache/kern.ts';
import { mengenKategorie } from '../../shared/sprache/menge.ts';
import { aktiveSprache, zeige } from '../../shared/sprache/index.ts';

export { ausTagesSchluessel, lokalesDatum, wochenbeginn };

interface Formate {
  zahl: Intl.NumberFormat;
  komma: Intl.NumberFormat;
  fest: Intl.NumberFormat;
  uhrzeit: Intl.DateTimeFormat;
  tagKurz: Intl.DateTimeFormat;
  tagMitJahr: Intl.DateTimeFormat;
  datumKurz: Intl.DateTimeFormat;
  monatKurz: Intl.DateTimeFormat;
  faktor: Intl.NumberFormat;
}

const formateNachSprache = new Map<string, Formate>();

function formate(): Formate {
  const sprache = aktiveSprache();
  const vorhanden = formateNachSprache.get(sprache);
  if (vorhanden) {
    return vorhanden;
  }
  const locale = localeFuer(sprache);
  const neu: Formate = {
    zahl: new Intl.NumberFormat(locale),
    komma: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    fest: new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    uhrzeit: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }),
    tagKurz: new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }),
    tagMitJahr: new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    datumKurz: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }),
    monatKurz: new Intl.DateTimeFormat(locale, { month: 'short' }),
    faktor: new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  };
  formateNachSprache.set(sprache, neu);
  return neu;
}

export function zahl(wert: number): string {
  return formate().zahl.format(wert);
}

/** Ganzes Level. Der Anteil im Level bleibt in Balken und Radar, nicht in der Zahl. */
export function levelZahl(wert: number): string {
  const ganz = Number.isFinite(wert) ? Math.floor(wert) : 0;
  return formate().zahl.format(Math.max(0, ganz));
}

export function hoechstensEineStelle(wert: number): string {
  return formate().komma.format(wert);
}

export function eineNachkommastelle(wert: number): string {
  return formate().fest.format(wert);
}

export function stunden(wert: number): string {
  return `${formate().komma.format(wert)} ${zeige('Std')}`;
}

export function dauerText(wert: number): string {
  const label = DAUER_OPTIONEN.find((option) => option.stunden === wert)?.label;
  return label ? zeige(label) : stunden(wert);
}

export function mitVorzeichen(wert: number): string {
  return `${wert < 0 ? '−' : '+'}${formate().zahl.format(Math.abs(wert))}`;
}

function prozentZeichen(text: string): string {
  const sprache = aktiveSprache();
  return sprache === 'en' || sprache === 'zh' || sprache === 'ja' ? `${text}%` : `${text} %`;
}

export function bonusProzent(anteil: number): string {
  return prozentZeichen(`+${Math.round(anteil * 100)}`);
}

export function prozentText(anteil: number): string {
  return prozentZeichen(String(Math.round(anteil * 100)));
}

/** Schon berechnete Prozentpunkte, mit dem Abstand der Sprache. */
export function prozentPunkte(prozent: number): string {
  return prozentZeichen(String(prozent));
}

export function faktorText(faktor: number): string {
  return `×${formate().faktor.format(faktor)}`;
}

const MULTIPLIKATOR_LABEL: Record<MultiplikatorArt, string> = {
  ausruestung: 'Investitionen',
  momentum: 'Momentum',
  erschoepfung: 'Erschöpfung',
};

export function multiplikatorText(multiplikator: Multiplikator): { label: string; wert: string } {
  const wert =
    multiplikator.art === 'momentum' || multiplikator.faktor < 1
      ? faktorText(multiplikator.faktor)
      : bonusProzent(multiplikator.faktor - 1);
  return { label: zeige(multiplikator.label ?? MULTIPLIKATOR_LABEL[multiplikator.art]), wert };
}

export function uhrzeit(iso: string): string {
  return formate().uhrzeit.format(new Date(iso));
}

export function kurzesDatum(iso: string): string {
  return formate().datumKurz.format(new Date(iso));
}

export function monatKurz(datum: Date): string {
  return formate().monatKurz.format(datum).replace('.', '');
}

export function tagesUeberschrift(tagesSchluessel: string, heute = new Date()): string {
  const gestern = new Date(heute);
  gestern.setDate(gestern.getDate() - 1);

  if (tagesSchluessel === lokalesDatum(heute)) {
    return zeige('Heute');
  }
  if (tagesSchluessel === lokalesDatum(gestern)) {
    return zeige('Gestern');
  }
  const datum = ausTagesSchluessel(tagesSchluessel);
  return datum.getFullYear() === heute.getFullYear() ? formate().tagKurz.format(datum) : formate().tagMitJahr.format(datum);
}

export function kalenderwoche(datum: Date): { jahr: number; woche: number } {
  const ziel = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()));
  const wochentag = ziel.getUTCDay() || TAGE_PRO_WOCHE;
  ziel.setUTCDate(ziel.getUTCDate() + 4 - wochentag);
  const jahresbeginn = new Date(Date.UTC(ziel.getUTCFullYear(), 0, 1));
  const woche = Math.ceil(((ziel.getTime() - jahresbeginn.getTime()) / MS_PRO_TAG + 1) / TAGE_PRO_WOCHE);
  return { jahr: ziel.getUTCFullYear(), woche };
}

export function verschiebeTag(tagesSchluessel: string, tage: number): string {
  const datum = ausTagesSchluessel(tagesSchluessel);
  datum.setDate(datum.getDate() + tage);
  return lokalesDatum(datum);
}

export function kompakt(wert: number): string {
  return Math.abs(wert) >= 1000 ? `${formate().komma.format(wert / 1000)}k` : formate().zahl.format(wert);
}

export function datumLang(tagesSchluessel: string): string {
  return formate().tagKurz.format(ausTagesSchluessel(tagesSchluessel));
}

const TAGE_PRO_MONAT = 30;
const TAGE_PRO_JAHR = 365;
const MONATE_AB_TAGEN = 60;
const JAHRE_AB_TAGEN = 730;

type MengeArt = 'tag' | 'monat' | 'jahr';

const EINZAHL: Record<MengeArt, string> = { tag: 'Tag', monat: 'Monat', jahr: 'Jahr' };
const MEHRZAHL: Record<MengeArt, string> = { tag: 'Tage', monat: 'Monate', jahr: 'Jahre' };
const RU_PAUCAL: Record<MengeArt, string> = { tag: 'дня', monat: 'месяца', jahr: 'года' };

export type MengeEinheit = MengeArt;

export function menge(n: number, einheit: MengeEinheit): string {
  const kat = mengenKategorie(aktiveSprache(), n);
  if (kat === 'wenige') return RU_PAUCAL[einheit];
  return zeige(kat === 'einzahl' ? EINZAHL[einheit] : MEHRZAHL[einheit]);
}

function zeitText(anzahl: number, art: MengeArt): string {
  const sprache = aktiveSprache();
  const abstand = sprache === 'zh' || sprache === 'ja' ? '' : ' ';
  return `${zahl(anzahl)}${abstand}${menge(anzahl, art)}`;
}

export function zeitspanne(tage: number): string {
  if (tage < MONATE_AB_TAGEN) {
    return zeitText(Math.max(1, Math.round(tage)), 'tag');
  }
  if (tage < JAHRE_AB_TAGEN) {
    return zeitText(Math.round(tage / TAGE_PRO_MONAT), 'monat');
  }
  return zeitText(Math.round(tage / TAGE_PRO_JAHR), 'jahr');
}
