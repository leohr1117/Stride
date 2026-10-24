import { TAGE_PRO_WOCHE } from '../../shared/spiel/datum.ts';

export interface Termin {
  id: string;
  titel: string;
  beginn: Date;
  ende: Date;
  ganztags: boolean;
}

interface Eigenschaft {
  name: string;
  parameter: Map<string, string>;
  wert: string;
}

interface WandZeit {
  jahr: number;
  monat: number;
  tag: number;
  stunde: number;
  minute: number;
  sekunde: number;
}

interface Zeitpunkt {
  wand: WandZeit;
  zone: string | null;
  utc: boolean;
  ganztags: boolean;
}

interface Regel {
  frequenz: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  intervall: number;
  anzahl: number | null;
  bis: Date | null;
  wochentage: { tag: number; ordnung: number | null }[];
  monatstage: number[];
  monate: number[];
}

interface Ereignis {
  uid: string;
  titel: string;
  beginn: Zeitpunkt;
  dauerMs: number;
  regel: Regel | null;
  ausnahmen: Set<number>;
  ersetzt: number | null;
  abgesagt: boolean;
}

const MS_PRO_SEKUNDE = 1000;
const MS_PRO_MINUTE = 60 * MS_PRO_SEKUNDE;
const MS_PRO_STUNDE = 60 * MS_PRO_MINUTE;
const MS_PRO_TAG = 24 * MS_PRO_STUNDE;
const MONATE_PRO_JAHR = 12;
const MAX_PERIODEN = 5000;
const LAENGSTE_PERIODE_TAGE: Record<Regel['frequenz'], number> = {
  DAILY: 1,
  WEEKLY: TAGE_PRO_WOCHE,
  MONTHLY: 31,
  YEARLY: 366,
};
const WOCHENTAGE: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const MONTAG = 1;
const FREQUENZEN = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
const DATUM_ZEIT = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/;
const DAUER = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;
const WOCHENTAG_REGEL = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/;
const WINDOWS_ZONEN: Record<string, string> = {
  'W. Europe Standard Time': 'Europe/Berlin',
  'Central Europe Standard Time': 'Europe/Budapest',
  'Central European Standard Time': 'Europe/Warsaw',
  'Romance Standard Time': 'Europe/Paris',
  'GMT Standard Time': 'Europe/London',
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'Pacific Standard Time': 'America/Los_Angeles',
  UTC: 'UTC',
};

function entfalte(text: string): string[] {
  const zeilen: string[] = [];
  for (const zeile of text.split(/\r?\n/)) {
    if ((zeile.startsWith(' ') || zeile.startsWith('\t')) && zeilen.length > 0) {
      zeilen[zeilen.length - 1] += zeile.slice(1);
    } else if (zeile.length > 0) {
      zeilen.push(zeile);
    }
  }
  return zeilen;
}

function zerlege(zeile: string): Eigenschaft | null {
  let inAnfuehrung = false;
  let trenner = -1;
  for (let index = 0; index < zeile.length; index++) {
    const zeichen = zeile[index];
    if (zeichen === '"') {
      inAnfuehrung = !inAnfuehrung;
    } else if (zeichen === ':' && !inAnfuehrung) {
      trenner = index;
      break;
    }
  }
  if (trenner < 0) {
    return null;
  }
  const [name, ...teile] = zeile.slice(0, trenner).split(';');
  const parameter = new Map<string, string>();
  for (const teil of teile) {
    const gleich = teil.indexOf('=');
    if (gleich > 0) {
      parameter.set(teil.slice(0, gleich).toUpperCase(), teil.slice(gleich + 1).replace(/^"|"$/g, ''));
    }
  }
  return { name: name.toUpperCase(), parameter, wert: zeile.slice(trenner + 1) };
}

function entschluessele(wert: string): string {
  return wert.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
}

const formatierer = new Map<string, Intl.DateTimeFormat | null>();

function formatiererFuer(zone: string): Intl.DateTimeFormat | null {
  if (!formatierer.has(zone)) {
    try {
      formatierer.set(
        zone,
        new Intl.DateTimeFormat('en-US', {
          timeZone: zone,
          hourCycle: 'h23',
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric',
        }),
      );
    } catch {
      formatierer.set(zone, null);
    }
  }
  return formatierer.get(zone) ?? null;
}

function zonenVersatz(zeit: number, format: Intl.DateTimeFormat): number {
  const werte: Record<string, number> = {};
  for (const teil of format.formatToParts(new Date(zeit))) {
    werte[teil.type] = Number(teil.value);
  }
  const wand = Date.UTC(werte.year, werte.month - 1, werte.day, werte.hour, werte.minute, werte.second);
  return wand - Math.floor(zeit / MS_PRO_SEKUNDE) * MS_PRO_SEKUNDE;
}

function zoneVon(name: string | null): Intl.DateTimeFormat | null {
  if (name === null) {
    return null;
  }
  return formatiererFuer(WINDOWS_ZONEN[name] ?? name);
}

function wandZuDatum(wand: WandZeit, zone: string | null, utc: boolean): Date {
  if (utc) {
    return new Date(Date.UTC(wand.jahr, wand.monat - 1, wand.tag, wand.stunde, wand.minute, wand.sekunde));
  }
  const format = zoneVon(zone);
  if (format === null) {
    return new Date(wand.jahr, wand.monat - 1, wand.tag, wand.stunde, wand.minute, wand.sekunde);
  }
  const schaetzung = Date.UTC(wand.jahr, wand.monat - 1, wand.tag, wand.stunde, wand.minute, wand.sekunde);
  const ersterVersatz = zonenVersatz(schaetzung, format);
  const ergebnis = schaetzung - ersterVersatz;
  const zweiterVersatz = zonenVersatz(ergebnis, format);
  return new Date(zweiterVersatz === ersterVersatz ? ergebnis : schaetzung - zweiterVersatz);
}

function liesZeitwert(wert: string, zone: string | null, alsDatum: boolean): Zeitpunkt | null {
  const treffer = DATUM_ZEIT.exec(wert.trim());
  if (!treffer) {
    return null;
  }
  const ganztags = alsDatum || treffer[4] === undefined;
  return {
    wand: {
      jahr: Number(treffer[1]),
      monat: Number(treffer[2]),
      tag: Number(treffer[3]),
      stunde: ganztags ? 0 : Number(treffer[4]),
      minute: ganztags ? 0 : Number(treffer[5]),
      sekunde: ganztags ? 0 : Number(treffer[6]),
    },
    zone,
    utc: treffer[7] === 'Z',
    ganztags,
  };
}

function liesZeit(eigenschaft: Eigenschaft): Zeitpunkt | null {
  return liesZeitwert(
    eigenschaft.wert,
    eigenschaft.parameter.get('TZID') ?? null,
    eigenschaft.parameter.get('VALUE') === 'DATE',
  );
}

function alsDatum(zeit: Zeitpunkt): Date {
  return wandZuDatum(zeit.wand, zeit.zone, zeit.utc);
}

function liesDauer(wert: string): number | null {
  const treffer = DAUER.exec(wert.trim());
  if (!treffer) {
    return null;
  }
  const [, vorzeichen, wochen, tage, stunden, minuten, sekunden] = treffer;
  const summe =
    Number(wochen ?? 0) * TAGE_PRO_WOCHE * MS_PRO_TAG +
    Number(tage ?? 0) * MS_PRO_TAG +
    Number(stunden ?? 0) * MS_PRO_STUNDE +
    Number(minuten ?? 0) * MS_PRO_MINUTE +
    Number(sekunden ?? 0) * MS_PRO_SEKUNDE;
  return vorzeichen === '-' ? -summe : summe;
}

function zahlenliste(wert: string | undefined): number[] {
  if (!wert) {
    return [];
  }
  return wert
    .split(',')
    .map(Number)
    .filter((zahl) => Number.isInteger(zahl) && zahl !== 0);
}

function liesRegel(wert: string, zone: string | null): Regel | null {
  const teile = new Map<string, string>();
  for (const teil of wert.split(';')) {
    const gleich = teil.indexOf('=');
    if (gleich > 0) {
      teile.set(teil.slice(0, gleich).toUpperCase(), teil.slice(gleich + 1).toUpperCase());
    }
  }
  const frequenz = FREQUENZEN.find((eintrag) => eintrag === teile.get('FREQ'));
  if (!frequenz) {
    return null;
  }
  const wochentage: Regel['wochentage'] = [];
  for (const eintrag of (teile.get('BYDAY') ?? '').split(',')) {
    const treffer = WOCHENTAG_REGEL.exec(eintrag.trim());
    if (treffer) {
      wochentage.push({ tag: WOCHENTAGE[treffer[2]], ordnung: treffer[1] ? Number(treffer[1]) : null });
    }
  }
  const bisWert = teile.get('UNTIL');
  const bisZeit = bisWert ? liesZeitwert(bisWert, zone, false) : null;
  const bis = bisZeit ? new Date(alsDatum(bisZeit).getTime() + (bisZeit.ganztags ? MS_PRO_TAG - 1 : 0)) : null;
  const intervall = Number(teile.get('INTERVAL') ?? 1);
  const anzahl = teile.has('COUNT') ? Number(teile.get('COUNT')) : null;
  return {
    frequenz,
    intervall: Number.isInteger(intervall) && intervall > 0 ? intervall : 1,
    anzahl: anzahl !== null && Number.isInteger(anzahl) && anzahl > 0 ? anzahl : null,
    bis,
    wochentage,
    monatstage: zahlenliste(teile.get('BYMONTHDAY')),
    monate: zahlenliste(teile.get('BYMONTH')),
  };
}

function liesEreignis(eigenschaften: Eigenschaft[]): Ereignis | null {
  const finde = (name: string) => eigenschaften.find((eigenschaft) => eigenschaft.name === name);
  const uid = finde('UID')?.wert.trim();
  const startEigenschaft = finde('DTSTART');
  const beginn = startEigenschaft ? liesZeit(startEigenschaft) : null;
  if (!uid || !beginn) {
    return null;
  }
  const endeEigenschaft = finde('DTEND');
  const ende = endeEigenschaft ? liesZeit(endeEigenschaft) : null;
  const dauerEigenschaft = finde('DURATION');
  let dauerMs = beginn.ganztags ? MS_PRO_TAG : 0;
  if (ende) {
    dauerMs = alsDatum(ende).getTime() - alsDatum(beginn).getTime();
  } else if (dauerEigenschaft) {
    dauerMs = liesDauer(dauerEigenschaft.wert) ?? dauerMs;
  }

  const ausnahmen = new Set<number>();
  for (const eigenschaft of eigenschaften.filter((eintrag) => eintrag.name === 'EXDATE')) {
    for (const wert of eigenschaft.wert.split(',')) {
      const zeit = liesZeitwert(wert, eigenschaft.parameter.get('TZID') ?? beginn.zone, eigenschaft.parameter.get('VALUE') === 'DATE');
      if (zeit) {
        ausnahmen.add(alsDatum(zeit).getTime());
      }
    }
  }
  const ersetztEigenschaft = finde('RECURRENCE-ID');
  const ersetzt = ersetztEigenschaft ? liesZeit(ersetztEigenschaft) : null;
  const regelEigenschaft = finde('RRULE');

  return {
    uid,
    titel: entschluessele(finde('SUMMARY')?.wert ?? ''),
    beginn,
    dauerMs: Math.max(0, dauerMs),
    regel: regelEigenschaft && !ersetzt ? liesRegel(regelEigenschaft.wert, beginn.zone) : null,
    ausnahmen,
    ersetzt: ersetzt ? alsDatum(ersetzt).getTime() : null,
    abgesagt: finde('STATUS')?.wert.trim().toUpperCase() === 'CANCELLED',
  };
}

export function liesEreignisse(text: string): Ereignis[] {
  const ereignisse: Ereignis[] = [];
  let aktuell: Eigenschaft[] | null = null;
  for (const zeile of entfalte(text)) {
    const eigenschaft = zerlege(zeile);
    if (!eigenschaft) {
      continue;
    }
    if (eigenschaft.name === 'BEGIN' && eigenschaft.wert.toUpperCase() === 'VEVENT') {
      aktuell = [];
    } else if (eigenschaft.name === 'END' && eigenschaft.wert.toUpperCase() === 'VEVENT') {
      const ereignis = aktuell ? liesEreignis(aktuell) : null;
      if (ereignis) {
        ereignisse.push(ereignis);
      }
      aktuell = null;
    } else if (aktuell) {
      aktuell.push(eigenschaft);
    }
  }
  return ereignisse;
}

function wandTag(jahr: number, monat: number, tag: number): Date {
  return new Date(Date.UTC(jahr, monat - 1, tag));
}

function tageImMonat(jahr: number, monat: number): number {
  return new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
}

function mitUhrzeit(tag: Date, vorlage: WandZeit): WandZeit {
  return {
    jahr: tag.getUTCFullYear(),
    monat: tag.getUTCMonth() + 1,
    tag: tag.getUTCDate(),
    stunde: vorlage.stunde,
    minute: vorlage.minute,
    sekunde: vorlage.sekunde,
  };
}

function passtZurRegel(tag: Date, regel: Regel): boolean {
  if (regel.monate.length > 0 && !regel.monate.includes(tag.getUTCMonth() + 1)) {
    return false;
  }
  if (regel.monatstage.length > 0) {
    const tage = tageImMonat(tag.getUTCFullYear(), tag.getUTCMonth() + 1);
    const passt = regel.monatstage.some((wert) => (wert > 0 ? wert : tage + wert + 1) === tag.getUTCDate());
    if (!passt) {
      return false;
    }
  }
  return true;
}

function tageInMonat(jahr: number, monat: number, regel: Regel, starttag: number): Date[] {
  const anzahl = tageImMonat(jahr, monat);
  if (regel.monatstage.length > 0) {
    return regel.monatstage
      .map((wert) => (wert > 0 ? wert : anzahl + wert + 1))
      .filter((tag) => tag >= 1 && tag <= anzahl)
      .sort((a, b) => a - b)
      .map((tag) => wandTag(jahr, monat, tag));
  }
  if (regel.wochentage.length > 0) {
    const ergebnis: Date[] = [];
    for (const { tag: wochentag, ordnung } of regel.wochentage) {
      const passende: Date[] = [];
      for (let tag = 1; tag <= anzahl; tag++) {
        const datum = wandTag(jahr, monat, tag);
        if (datum.getUTCDay() === wochentag) {
          passende.push(datum);
        }
      }
      if (ordnung === null) {
        ergebnis.push(...passende);
      } else {
        const gewaehlt = ordnung > 0 ? passende[ordnung - 1] : passende[passende.length + ordnung];
        if (gewaehlt) {
          ergebnis.push(gewaehlt);
        }
      }
    }
    return ergebnis.sort((a, b) => a.getTime() - b.getTime());
  }
  return starttag <= anzahl ? [wandTag(jahr, monat, starttag)] : [];
}

function kandidatenDerPeriode(periode: number, start: WandZeit, regel: Regel): Date[] {
  const schritt = periode * regel.intervall;
  if (regel.frequenz === 'DAILY') {
    const tag = wandTag(start.jahr, start.monat, start.tag + schritt);
    const wochentagPasst =
      regel.wochentage.length === 0 || regel.wochentage.some((eintrag) => eintrag.tag === tag.getUTCDay());
    return wochentagPasst && passtZurRegel(tag, regel) ? [tag] : [];
  }
  if (regel.frequenz === 'WEEKLY') {
    const starttag = wandTag(start.jahr, start.monat, start.tag);
    const abstandZuMontag = (starttag.getUTCDay() - MONTAG + TAGE_PRO_WOCHE) % TAGE_PRO_WOCHE;
    const wochenbeginn = wandTag(start.jahr, start.monat, start.tag - abstandZuMontag + schritt * TAGE_PRO_WOCHE);
    const tage = regel.wochentage.length > 0 ? regel.wochentage.map((eintrag) => eintrag.tag) : [starttag.getUTCDay()];
    return tage
      .map((wochentag) => (wochentag - MONTAG + TAGE_PRO_WOCHE) % TAGE_PRO_WOCHE)
      .sort((a, b) => a - b)
      .map((versatz) => wandTag(wochenbeginn.getUTCFullYear(), wochenbeginn.getUTCMonth() + 1, wochenbeginn.getUTCDate() + versatz))
      .filter((tag) => passtZurRegel(tag, regel));
  }
  if (regel.frequenz === 'MONTHLY') {
    const monatsIndex = start.monat - 1 + schritt;
    const jahr = start.jahr + Math.floor(monatsIndex / MONATE_PRO_JAHR);
    const monat = (monatsIndex % MONATE_PRO_JAHR) + 1;
    if (regel.monate.length > 0 && !regel.monate.includes(monat)) {
      return [];
    }
    return tageInMonat(jahr, monat, regel, start.tag);
  }
  const jahr = start.jahr + schritt;
  const monate = regel.monate.length > 0 ? regel.monate : [start.monat];
  const ergebnis: Date[] = [];
  for (const monat of monate) {
    ergebnis.push(...tageInMonat(jahr, monat, { ...regel, wochentage: [] }, start.tag));
  }
  return ergebnis;
}

function erstePeriode(ereignis: Ereignis, regel: Regel, von: Date): number {
  if (regel.anzahl !== null) {
    return 0;
  }
  const abstand = von.getTime() - alsDatum(ereignis.beginn).getTime();
  const periodenlaenge = LAENGSTE_PERIODE_TAGE[regel.frequenz] * regel.intervall * MS_PRO_TAG;
  return Math.max(0, Math.floor(abstand / periodenlaenge) - 1);
}

function* vorkommen(ereignis: Ereignis, von: Date, bis: Date): Generator<Date> {
  const start = alsDatum(ereignis.beginn);
  if (!ereignis.regel) {
    yield start;
    return;
  }
  const regel = ereignis.regel;
  const startTag = wandTag(ereignis.beginn.wand.jahr, ereignis.beginn.wand.monat, ereignis.beginn.wand.tag);
  let gezaehlt = 0;
  const erste = erstePeriode(ereignis, regel, von);
  for (let periode = erste; periode < erste + MAX_PERIODEN; periode++) {
    for (const tag of kandidatenDerPeriode(periode, ereignis.beginn.wand, regel)) {
      if (tag < startTag) {
        continue;
      }
      const zeitpunkt = wandZuDatum(mitUhrzeit(tag, ereignis.beginn.wand), ereignis.beginn.zone, ereignis.beginn.utc);
      if ((regel.bis && zeitpunkt > regel.bis) || zeitpunkt > bis) {
        return;
      }
      gezaehlt++;
      yield zeitpunkt;
      if (regel.anzahl !== null && gezaehlt >= regel.anzahl) {
        return;
      }
    }
  }
}

export function termineZwischen(text: string, von: Date, bis: Date): Termin[] {
  const ereignisse = liesEreignisse(text);
  const ersetzte = new Map<string, Set<number>>();
  for (const ereignis of ereignisse) {
    if (ereignis.ersetzt !== null) {
      const liste = ersetzte.get(ereignis.uid) ?? new Set<number>();
      liste.add(ereignis.ersetzt);
      ersetzte.set(ereignis.uid, liste);
    }
  }

  const termine: Termin[] = [];
  for (const ereignis of ereignisse) {
    if (ereignis.abgesagt) {
      continue;
    }
    const ueberspringen = ereignis.ersetzt === null ? (ersetzte.get(ereignis.uid) ?? new Set<number>()) : new Set<number>();
    for (const beginn of vorkommen(ereignis, von, bis)) {
      const zeit = beginn.getTime();
      if (ereignis.ausnahmen.has(zeit) || ueberspringen.has(zeit)) {
        continue;
      }
      const ende = new Date(zeit + ereignis.dauerMs);
      if (beginn >= von && ende <= bis) {
        termine.push({
          id: `${ereignis.uid}|${beginn.toISOString()}`,
          titel: ereignis.titel,
          beginn,
          ende,
          ganztags: ereignis.beginn.ganztags,
        });
      }
    }
  }
  return termine.sort((a, b) => a.beginn.getTime() - b.beginn.getTime());
}
