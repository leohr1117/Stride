import { strideVariable } from '../../umgebung.ts';
import { randomUUID } from 'node:crypto';
import type { Einstellungen } from '../../../shared/api/index.ts';
import type { AttributTyp } from '../../../shared/spiel/begriffe.ts';
import { istTypAktiv } from '../../../shared/spiel/funktionen.ts';
import type { FunktionsAttribute } from '../../../shared/spiel/sichtbarkeit.ts';
import {
  ebenenFuerStufe,
  leereEbenenZahlen,
  leseEbenen,
  sperrtext,
  wendeEbenenAn,
  type Ebene,
  type Ebenen,
  type EbenenZahlen,
} from '../../../shared/spiel/ebenen.ts';
import { istAn } from '../../../shared/spiel/sichtbarkeit.ts';
import {
  FUNKTION_BLOECKE,
  funktionenAusSpeicher,
  funktionenFuerStufe,
  type Funktion,
  type Funktionen,
} from '../../../shared/spiel/funktionen.ts';
import { bereinigteLeiste, LEISTE_STANDARD } from '../../../shared/spiel/leiste.ts';
import { istHexFarbe, normaleHex } from '../../../shared/spiel/farben.ts';
import {
  PALETTEN_SCHLUESSEL,
  PalettenFehler,
  lesePaletten,
  paletteAendern,
  paletteAnlegen,
  paletteLoeschen,
  type PaletteEingabe,
} from '../../../shared/features/darstellung/eigenePaletten.ts';
import { standardVorlage, type Farbtrio } from '../../../shared/features/darstellung/paletten.ts';
import { gelesenerStil, STANDARD_STIL, STILE, type Stil } from '../../../shared/features/darstellung/stile.ts';
import {
  leseZielstrebigkeit,
  normalisiereFokus,
  PROFILNAME_PLATZHALTER,
  type FokusId,
  type Zielstrebigkeit,
} from '../../../shared/spiel/profil.ts';
import { istSprache, type Sprache } from '../../../shared/sprache/kern.ts';
import { anfrageSprache } from '../../anfrageSprache.ts';
import { alle, ausfuehren, eine, inTransaktion } from '../../db.ts';
import { ungueltig } from '../../fehler.ts';
import { istWeltLeer, wendeFokusAn } from '../../services/profilStart.ts';
import { wendeStartZielAn, type StartZielArt } from '../../services/startAnlage.ts';
import { istGewichtEinheit, STANDARD_GEWICHT_EINHEIT, type GewichtEinheit } from '../../../shared/spiel/training.ts';
import { kartenWahl, type UebersichtKartenWahl } from '../../../shared/spiel/uebersichtKarten.ts';
import {
  VORBILD_FAVORITEN,
  bereinigeFavoriten,
  favoritDazu,
  favoritWeg,
  istFavoritenSchluessel,
} from '../../../shared/features/vorbilder/favoriten.ts';
import { schreibeHinweisAngebotTesten, setzeHinweisNichtVorWennFehlt } from './hinweisSchluessel.ts';
import { leseVersionsstand, setzeVersionsstandWennLeer } from './versionHinweis.ts';
import { AKTUELLE_VERSION } from '../../../shared/versionen.ts';

interface Grundeinstellungen {
  charakterName: string;
  sound: boolean;
  geburtsjahr: number | null;
  zielstrebigkeit: Zielstrebigkeit | null;
  fokus: FokusId[];
  profilAngelegt: boolean;
  stil: Stil;
  primaer: string;
  akzent: string;
  hintergrund: string;
  glimmen: boolean;
  mobilLeiste: string[];
}

const STANDARD_PALETTE = standardVorlage(STANDARD_STIL, false);

const STANDARD: Grundeinstellungen = {
  charakterName: PROFILNAME_PLATZHALTER,
  sound: true,
  geburtsjahr: null,
  zielstrebigkeit: null,
  fokus: [],
  profilAngelegt: false,
  stil: STANDARD_STIL,
  primaer: STANDARD_PALETTE.primaer,
  akzent: STANDARD_PALETTE.akzent,
  hintergrund: STANDARD_PALETTE.hintergrund,
  glimmen: true,
  mobilLeiste: [...LEISTE_STANDARD],
};

const FUNKTIONEN_SCHLUESSEL = 'funktionen';
const ANSICHT_FARBEN = 'ansichtFarben';
const UEBERSICHT_KARTEN_SCHLUESSEL = 'uebersichtKarten';
const SCHUTZ_VORRAT = 'schutz_vorrat';
const SCHUTZ_SCHWELLE = 'schutz_schwelle_verbraucht';
const RUECKKEHR_AB = 'rueckkehr_ab';
const BEWERTUNG_WERT = 'bewertung_wert';
const BEWERTUNG_AM = 'bewertung_am';
const BEWERTUNG_NIE = 'bewertung_nie';
const BEWERTUNG_TESTEN = 'bewertung_testen';
const TAGES_SCHLUESSEL = /^\d{4}-\d{2}-\d{2}$/;

function istGleicherTyp<T>(wert: unknown, vorlage: T): wert is T {
  return typeof wert === typeof vorlage;
}

function parse(roh: string | undefined): unknown {
  if (roh === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(roh);
  } catch {
    return undefined;
  }
}

function leseWert<T>(roh: string | undefined, standard: T): T {
  const wert = parse(roh);
  return wert !== undefined && istGleicherTyp(wert, standard) ? wert : standard;
}

function leseJahr(roh: string | undefined): number | null {
  const wert = parse(roh);
  return typeof wert === 'number' && Number.isInteger(wert) ? wert : null;
}

function leseGespeicherteZielstrebigkeit(roh: string | undefined): Zielstrebigkeit | null {
  return leseZielstrebigkeit(parse(roh));
}

function leseFokus(roh: string | undefined): FokusId[] {
  return normalisiereFokus(parse(roh));
}

function leseAngelegt(roh: string | undefined): boolean {
  const wert = parse(roh);
  return typeof wert === 'boolean' ? wert : false;
}

function leseStil(roh: string | undefined): Stil {
  return gelesenerStil(parse(roh)) ?? STANDARD.stil;
}

function leseFarbe(roh: string | undefined): string | undefined {
  const wert = parse(roh);
  return istHexFarbe(wert) ? normaleHex(wert) : undefined;
}

function alsTrio(wert: unknown): Farbtrio | undefined {
  if (wert === null || typeof wert !== 'object') {
    return undefined;
  }
  const eintrag = wert as Record<string, unknown>;
  if (!istHexFarbe(eintrag.primaer) || !istHexFarbe(eintrag.akzent) || !istHexFarbe(eintrag.hintergrund)) {
    return undefined;
  }
  return {
    primaer: normaleHex(eintrag.primaer),
    akzent: normaleHex(eintrag.akzent),
    hintergrund: normaleHex(eintrag.hintergrund),
  };
}

/**
 * Fehlt der Schlüssel, gehört ein vorhandenes Tripel zur aktuellen Ansicht.
 * Ein gespeichertes Objekt, auch ein leeres, gilt allein.
 */
function leseAnsichtFarben(
  roh: string | undefined,
  stil: Stil,
  alt: { primaer?: string; akzent?: string; hintergrund?: string },
): Partial<Record<Stil, Farbtrio>> {
  if (roh !== undefined) {
    const wert = parse(roh);
    const ergebnis: Partial<Record<Stil, Farbtrio>> = {};
    if (wert !== null && typeof wert === 'object' && !Array.isArray(wert)) {
      const eintrag = wert as Record<string, unknown>;
      for (const name of STILE) {
        const trio = alsTrio(eintrag[name]);
        if (trio) {
          ergebnis[name] = trio;
        }
      }
      if (!ergebnis.standard) {
        const alt = alsTrio(eintrag.schlicht);
        if (alt) {
          ergebnis.standard = alt;
        }
      }
    }
    return ergebnis;
  }
  if (alt.primaer && alt.akzent && alt.hintergrund) {
    return { [stil]: { primaer: alt.primaer, akzent: alt.akzent, hintergrund: alt.hintergrund } };
  }
  return {};
}

function liesSchluessel(): Map<string, string> {
  const gespeichert = new Map<string, string>();
  for (const zeile of alle<{ schluessel: string; wert: string }>('SELECT schluessel, wert FROM einstellungen')) {
    gespeichert.set(zeile.schluessel, zeile.wert);
  }
  return gespeichert;
}

function loescheSchluessel(schluessel: string): void {
  ausfuehren('DELETE FROM einstellungen WHERE schluessel = ?', schluessel);
}

function schreibeAktiveFarben(trio: Farbtrio | undefined): void {
  if (!trio) {
    loescheSchluessel('primaer');
    loescheSchluessel('akzent');
    loescheSchluessel('hintergrund');
    return;
  }
  speichere('primaer', trio.primaer);
  speichere('akzent', trio.akzent);
  speichere('hintergrund', trio.hintergrund);
}

function leseGlimmen(roh: string | undefined): boolean {
  const wert = parse(roh);
  return typeof wert === 'boolean' ? wert : STANDARD.glimmen;
}

function leseLeiste(roh: string | undefined): string[] {
  return bereinigteLeiste(parse(roh)) ?? [...STANDARD.mobilLeiste];
}

function leseSprache(roh: string | undefined): Sprache | null {
  const wert = parse(roh);
  return istSprache(wert) ? wert : null;
}

function leseFunktionen(roh: string | undefined): Funktionen {
  return funktionenAusSpeicher(parse(roh));
}

function leseUebersichtKarten(roh: string | undefined): UebersichtKartenWahl {
  return kartenWahl(parse(roh));
}

function funktionsAttribute(funktionen: Funktionen): FunktionsAttribute {
  const attribute: FunktionsAttribute = { disziplin: false, ressourcen: false };
  const zeilen = alle<{ kennung: string; typ: AttributTyp }>(
    `SELECT kennung, typ FROM attribute WHERE archiviert = 0 AND kennung IN ('disziplin', 'ressourcen')`,
  );
  for (const zeile of zeilen) {
    if (!istTypAktiv(funktionen, zeile.typ)) {
      continue;
    }
    if (zeile.kennung === 'disziplin') {
      attribute.disziplin = true;
    }
    if (zeile.kennung === 'ressourcen') {
      attribute.ressourcen = true;
    }
  }
  return attribute;
}

export function ladeEinstellungen(): Einstellungen {
  const gespeichert = liesSchluessel();
  const stil = leseStil(gespeichert.get('stil'));
  const vorlage = standardVorlage(stil, false);
  const ansichtFarben = leseAnsichtFarben(gespeichert.get(ANSICHT_FARBEN), stil, {
    primaer: leseFarbe(gespeichert.get('primaer')),
    akzent: leseFarbe(gespeichert.get('akzent')),
    hintergrund: leseFarbe(gespeichert.get('hintergrund')),
  });
  const eigene = ansichtFarben[stil];
  const funktionen = leseFunktionen(gespeichert.get(FUNKTIONEN_SCHLUESSEL));
  return {
    charakterName: leseWert(gespeichert.get('charakterName'), STANDARD.charakterName),
    sound: leseWert(gespeichert.get('sound'), STANDARD.sound),
    geburtsjahr: leseJahr(gespeichert.get('geburtsjahr')),
    zielstrebigkeit: leseGespeicherteZielstrebigkeit(gespeichert.get('zielstrebigkeit')),
    fokus: leseFokus(gespeichert.get('fokus')),
    profilAngelegt: leseAngelegt(gespeichert.get('profilAngelegt')),
    weltLeer: istWeltLeer(),
    stil,
    primaer: eigene?.primaer ?? vorlage.primaer,
    akzent: eigene?.akzent ?? vorlage.akzent,
    hintergrund: eigene?.hintergrund ?? vorlage.hintergrund,
    glimmen: leseGlimmen(gespeichert.get('glimmen')),
    eigeneFarben: eigene !== undefined,
    ansichtFarben,
    funktionen,
    mobilLeiste: leseLeiste(gespeichert.get('mobilLeiste')),
    ebenen: leseEbenen(parse(gespeichert.get('ebenen'))),
    ebenenZahlen: zaehleEbenen(),
    attribute: funktionsAttribute(funktionen),
    sprache: leseSprache(gespeichert.get('sprache')),
    zeitzone: leseZone(gespeichert.get('zeitzone')),
    gewichtEinheit: leseGewichtEinheit(gespeichert.get('gewicht_einheit')),
    uebersichtKarten: leseUebersichtKarten(gespeichert.get(UEBERSICHT_KARTEN_SCHLUESSEL)),
    paletten: lesePaletten(parse(gespeichert.get(PALETTEN_SCHLUESSEL))),
    versionHinweis: leseVersionsstand(),
    vorbildFavoriten: leseFavoriten(gespeichert.get(VORBILD_FAVORITEN)),
  };
}

function leseFavoriten(roh: string | undefined): string[] {
  if (roh === undefined) {
    return [];
  }
  const wert = parse(roh);
  const sauber = Array.isArray(wert) ? bereinigeFavoriten(wert) : [];
  if (!Array.isArray(wert) || JSON.stringify(wert) !== JSON.stringify(sauber)) {
    speichere(VORBILD_FAVORITEN, sauber);
  }
  return sauber;
}

function pruefeFavorit(schluessel: string): void {
  if (!istFavoritenSchluessel(schluessel)) {
    throw ungueltig('Das Vorbild ist unbekannt.');
  }
}

function wendeFavoriten(aenderung: {
  vorbildFavoritDazu?: string;
  vorbildFavoritWeg?: string;
  vorbildFavoritIndex?: number;
}): void {
  if (aenderung.vorbildFavoritDazu === undefined && aenderung.vorbildFavoritWeg === undefined) {
    return;
  }
  if (aenderung.vorbildFavoritWeg !== undefined) {
    pruefeFavorit(aenderung.vorbildFavoritWeg);
  }
  if (aenderung.vorbildFavoritDazu !== undefined) {
    pruefeFavorit(aenderung.vorbildFavoritDazu);
  }
  let liste = leseFavoriten(eine<{ wert: string }>('SELECT wert FROM einstellungen WHERE schluessel = ?', VORBILD_FAVORITEN)?.wert);
  if (aenderung.vorbildFavoritWeg !== undefined) {
    liste = favoritWeg(liste, aenderung.vorbildFavoritWeg);
  }
  if (aenderung.vorbildFavoritDazu !== undefined) {
    liste = favoritDazu(liste, aenderung.vorbildFavoritDazu, aenderung.vorbildFavoritIndex);
  }
  speichere(VORBILD_FAVORITEN, liste);
}

function leseGewichtEinheit(roh: string | undefined): GewichtEinheit {
  const wert = parse(roh);
  return istGewichtEinheit(wert) ? wert : STANDARD_GEWICHT_EINHEIT;
}

function leseZone(roh: string | undefined): string | null {
  const wert = parse(roh);
  return typeof wert === 'string' && wert.trim() !== '' ? wert : null;
}

function zaehleEbenen(): EbenenZahlen {
  const zahlen = leereEbenenZahlen();
  const tabellen: Record<keyof EbenenZahlen, string> = {
    visionen: 'visionen',
    organisationen: 'organisationen',
    projekte: 'projekte',
    vorhaben: 'vorhaben',
  };
  for (const ebene of Object.keys(tabellen) as (keyof EbenenZahlen)[]) {
    zahlen[ebene] =
      eine<{ anzahl: number }>(`SELECT COUNT(*) AS anzahl FROM ${tabellen[ebene]}`)?.anzahl ?? 0;
  }
  return zahlen;
}

export function funktionAktiv(funktion: Funktion): boolean {
  return istAn(funktion, ladeEinstellungen());
}

function funktionsLabel(funktion: Funktion): string {
  for (const block of FUNKTION_BLOECKE) {
    const eintrag = block.eintraege.find((zeile) => zeile.funktion === funktion);
    if (eintrag) {
      return eintrag.label;
    }
  }
  return funktion;
}

export function pruefeFunktion(funktion: Funktion): void {
  const einstellungen = ladeEinstellungen();
  if (!istAn(funktion, einstellungen)) {
    throw ungueltig(`${funktionsLabel(funktion)} ist ausgeschaltet.`);
  }
}

export function pruefeEbene(ebene: Ebene): void {
  const einstellungen = ladeEinstellungen();
  if (!istAn(ebene, einstellungen)) {
    throw ungueltig(sperrtext(ebene));
  }
}

function speichere(schluessel: string, wert: unknown): void {
  ausfuehren(
    `INSERT INTO einstellungen (schluessel, wert) VALUES (?, ?)
     ON CONFLICT (schluessel) DO UPDATE SET wert = excluded.wert`,
    schluessel,
    JSON.stringify(wert),
  );
}

function leseGanzeZahl(schluessel: string): number | null {
  const roh = eine<{ wert: string }>('SELECT wert FROM einstellungen WHERE schluessel = ?', schluessel)?.wert;
  if (roh === undefined) {
    return null;
  }
  try {
    const wert: unknown = JSON.parse(roh);
    return typeof wert === 'number' && Number.isInteger(wert) && wert >= 0 ? wert : null;
  } catch {
    return null;
  }
}

/** Fehlender Schlüssel ist 0. Steht nicht in der Einstellungen-Antwort. */
export function leseSchutzVorrat(): number {
  return leseGanzeZahl(SCHUTZ_VORRAT) ?? 0;
}

/** Null heißt, der Schlüssel fehlt. 0 ist eine gespeicherte Schwelle. */
export function leseSchutzSchwelle(): number | null {
  return leseGanzeZahl(SCHUTZ_SCHWELLE);
}

export function schreibeSchutzVorrat(vorrat: 0 | 1): void {
  speichere(SCHUTZ_VORRAT, vorrat);
}

export function schreibeSchutzSchwelle(schwelle: number): void {
  speichere(SCHUTZ_SCHWELLE, Math.max(0, Math.floor(schwelle)));
}

/** Null heißt, der Schlüssel fehlt. Steht nicht in der Einstellungen-Antwort. Einmal geschrieben. */
export function leseRueckkehrAb(): string | null {
  const roh = eine<{ wert: string }>('SELECT wert FROM einstellungen WHERE schluessel = ?', RUECKKEHR_AB)?.wert;
  if (roh === undefined) {
    return null;
  }
  try {
    const wert: unknown = JSON.parse(roh);
    return typeof wert === 'string' && TAGES_SCHLUESSEL.test(wert) ? wert : null;
  } catch {
    return null;
  }
}

export function schreibeRueckkehrAb(tag: string): void {
  if (!TAGES_SCHLUESSEL.test(tag) || leseRueckkehrAb() !== null) {
    return;
  }
  speichere(RUECKKEHR_AB, tag);
}

function leseRoh(schluessel: string): unknown {
  return parse(eine<{ wert: string }>('SELECT wert FROM einstellungen WHERE schluessel = ?', schluessel)?.wert);
}

/** Steht nicht in der Einstellungen-Antwort. */
export function leseBewertungNie(): boolean {
  return leseRoh(BEWERTUNG_NIE) === true;
}

/** 1 bis 5, sonst null. Steht nicht in der Einstellungen-Antwort. */
export function leseBewertungWert(): number | null {
  const wert = leseRoh(BEWERTUNG_WERT);
  return typeof wert === 'number' && Number.isInteger(wert) && wert >= 1 && wert <= 5 ? wert : null;
}

export function leseBewertungAm(): string | null {
  const wert = leseRoh(BEWERTUNG_AM);
  return typeof wert === 'string' && TAGES_SCHLUESSEL.test(wert) ? wert : null;
}

/** Nur unter STRIDE_TEST wirksam. Steht nicht in der Einstellungen-Antwort. */
export function leseBewertungTesten(): boolean {
  return leseRoh(BEWERTUNG_TESTEN) === true;
}

export function schreibeBewertungNie(): void {
  speichere(BEWERTUNG_NIE, true);
}

export function schreibeBewertungWert(wert: number, am: string): void {
  speichere(BEWERTUNG_WERT, wert);
  speichere(BEWERTUNG_AM, am);
}

export function schreibeBewertungTesten(an: boolean): void {
  if (an) {
    speichere(BEWERTUNG_TESTEN, true);
    return;
  }
  loescheSchluessel(BEWERTUNG_TESTEN);
}

function neuePaletteId(liste: readonly { id: string }[]): string {
  for (let versuch = 0; versuch < 4; versuch += 1) {
    const id = randomUUID();
    if (!liste.some((palette) => palette.id === id)) {
      return id;
    }
  }
  throw new PalettenFehler('Die Palette wurde nicht gefunden.');
}

function wendePaletten(
  aenderung: {
    paletteNeu?: PaletteEingabe;
    paletteAendern?: PaletteEingabe & { id: string };
    paletteLoeschen?: string;
  },
  stil: Stil,
): void {
  if (
    aenderung.paletteNeu === undefined &&
    aenderung.paletteAendern === undefined &&
    aenderung.paletteLoeschen === undefined
  ) {
    return;
  }
  try {
    let liste = lesePaletten(parse(liesSchluessel().get(PALETTEN_SCHLUESSEL)));
    if (aenderung.paletteLoeschen !== undefined) {
      liste = paletteLoeschen(liste, aenderung.paletteLoeschen);
    }
    if (aenderung.paletteAendern !== undefined) {
      const { id, name, primaer, akzent, hintergrund } = aenderung.paletteAendern;
      liste = paletteAendern(liste, id, { name, primaer, akzent, hintergrund });
    }
    if (aenderung.paletteNeu !== undefined) {
      const eingabe = aenderung.paletteNeu.stil ? aenderung.paletteNeu : { ...aenderung.paletteNeu, stil };
      liste = paletteAnlegen(liste, eingabe, neuePaletteId(liste));
    }
    speichere(PALETTEN_SCHLUESSEL, liste);
  } catch (fehler) {
    if (fehler instanceof PalettenFehler) {
      throw ungueltig(fehler.message);
    }
    throw fehler;
  }
}

export function aendereEinstellungen(
  aenderung: Partial<Grundeinstellungen> & {
    funktionen?: Partial<Funktionen>;
    ebenen?: Partial<Ebenen>;
    sprache?: Sprache;
    zeitzone?: string;
    gewichtEinheit?: GewichtEinheit;
    uebersichtKarten?: Partial<UebersichtKartenWahl>;
    farbenZuruecksetzen?: boolean;
    paletteNeu?: PaletteEingabe;
    paletteAendern?: PaletteEingabe & { id: string };
    paletteLoeschen?: string;
    vorbildFavoritDazu?: string;
    vorbildFavoritWeg?: string;
    vorbildFavoritIndex?: number;
    startZiel?: { art: StartZielArt; name: string };
    bewertungTesten?: boolean;
    angebotTesten?: boolean;
  },
): Einstellungen {
  const bisher = ladeEinstellungen();
  inTransaktion(() => {
    if (aenderung.charakterName !== undefined) {
      speichere('charakterName', aenderung.charakterName);
    }
    if (aenderung.sound !== undefined) {
      speichere('sound', aenderung.sound);
    }
    if (aenderung.geburtsjahr !== undefined) {
      speichere('geburtsjahr', aenderung.geburtsjahr);
    }
    if (aenderung.zielstrebigkeit !== undefined) {
      speichere('zielstrebigkeit', aenderung.zielstrebigkeit);
    }
    const ersteAnlage = aenderung.profilAngelegt === true && !bisher.profilAngelegt;
    const stufe = aenderung.zielstrebigkeit;
    const stufeWechselt = Boolean(stufe && (stufe !== bisher.zielstrebigkeit || ersteAnlage));
    let ebenen = bisher.ebenen;
    if (stufe && stufeWechselt) {
      ebenen = ebenenFuerStufe(stufe);
      speichere('ebenen', ebenen);
    } else if (aenderung.ebenen !== undefined) {
      ebenen = wendeEbenenAn(bisher.ebenen, aenderung.ebenen);
      speichere('ebenen', ebenen);
    }
    let funktionen = funktionenAusSpeicher({ ...bisher.funktionen, ...aenderung.funktionen });
    let fokus = bisher.fokus;
    let sprache = aenderung.sprache ?? bisher.sprache ?? anfrageSprache();
    if (aenderung.fokus !== undefined) {
      fokus = normalisiereFokus(aenderung.fokus);
      if (fokus.length > 0) {
        funktionen = { ...funktionen, ...wendeFokusAn(fokus, new Date(), sprache, ersteAnlage) };
      }
      speichere('fokus', fokus);
    }
    const stufeFunktionen = stufe && stufeWechselt ? funktionenFuerStufe(stufe) : {};
    funktionen = { ...funktionen, ...stufeFunktionen };
    if (!funktionen.koennen && !funktionen.status) {
      throw ungueltig('Können oder Haben muss aktiv bleiben.');
    }
    if (aenderung.funktionen !== undefined || aenderung.fokus !== undefined || Object.keys(stufeFunktionen).length > 0) {
      speichere(FUNKTIONEN_SCHLUESSEL, funktionenAusSpeicher(funktionen));
    }
    if (aenderung.profilAngelegt !== undefined) {
      speichere('profilAngelegt', aenderung.profilAngelegt);
    }
    const farbenBeruehrt =
      aenderung.stil !== undefined ||
      aenderung.primaer !== undefined ||
      aenderung.akzent !== undefined ||
      aenderung.hintergrund !== undefined ||
      aenderung.farbenZuruecksetzen === true;
    if (farbenBeruehrt) {
      const roh = liesSchluessel();
      const map = leseAnsichtFarben(roh.get(ANSICHT_FARBEN), bisher.stil, {
        primaer: leseFarbe(roh.get('primaer')),
        akzent: leseFarbe(roh.get('akzent')),
        hintergrund: leseFarbe(roh.get('hintergrund')),
      });
      const stil = aenderung.stil ?? bisher.stil;
      if (aenderung.stil !== undefined) {
        speichere('stil', aenderung.stil);
      }
      const setztFarben =
        aenderung.primaer !== undefined || aenderung.akzent !== undefined || aenderung.hintergrund !== undefined;
      if (setztFarben && aenderung.farbenZuruecksetzen !== true) {
        const basis = map[stil] ?? {
          primaer: bisher.primaer,
          akzent: bisher.akzent,
          hintergrund: bisher.hintergrund,
        };
        const trio = {
          primaer: normaleHex(aenderung.primaer ?? basis.primaer),
          akzent: normaleHex(aenderung.akzent ?? basis.akzent),
          hintergrund: normaleHex(aenderung.hintergrund ?? basis.hintergrund),
        };
        map[stil] = trio;
        schreibeAktiveFarben(trio);
      } else if (aenderung.farbenZuruecksetzen === true) {
        delete map[stil];
        schreibeAktiveFarben(undefined);
      } else {
        schreibeAktiveFarben(map[stil]);
      }
      speichere(ANSICHT_FARBEN, map);
    }
    if (aenderung.glimmen !== undefined) {
      speichere('glimmen', aenderung.glimmen);
    }
    if (aenderung.mobilLeiste !== undefined) {
      speichere('mobilLeiste', aenderung.mobilLeiste);
    }
    if (aenderung.sprache !== undefined) {
      speichere('sprache', aenderung.sprache);
    }
    if (aenderung.zeitzone !== undefined) {
      try {
        Intl.DateTimeFormat('en-US', { timeZone: aenderung.zeitzone });
      } catch {
        throw ungueltig('Die Zeitzone ist ungültig.');
      }
      speichere('zeitzone', aenderung.zeitzone);
    }
    if (aenderung.gewichtEinheit !== undefined) {
      speichere('gewicht_einheit', aenderung.gewichtEinheit);
    }
    if (aenderung.uebersichtKarten !== undefined) {
      speichere(
        UEBERSICHT_KARTEN_SCHLUESSEL,
        kartenWahl({ ...bisher.uebersichtKarten, ...aenderung.uebersichtKarten }),
      );
    }
    wendeFavoriten(aenderung);
    wendePaletten(aenderung, aenderung.stil ?? bisher.stil);
    if (aenderung.bewertungTesten !== undefined && strideVariable('TEST') === '1') {
      schreibeBewertungTesten(aenderung.bewertungTesten);
    }
    if (aenderung.angebotTesten !== undefined && strideVariable('TEST') === '1') {
      schreibeHinweisAngebotTesten(aenderung.angebotTesten);
    }
    wendeStartZielAn({
      startZiel: aenderung.startZiel,
      stufe: aenderung.zielstrebigkeit ?? bisher.zielstrebigkeit,
      ersteAnlage,
    });
    if (ersteAnlage) {
      setzeHinweisNichtVorWennFehlt(new Date());
      setzeVersionsstandWennLeer(AKTUELLE_VERSION);
    }
  });
  return ladeEinstellungen();
}
