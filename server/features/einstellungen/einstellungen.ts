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
import { standardVorlage } from '../../../shared/features/darstellung/paletten.ts';
import {
  leseZielstrebigkeit,
  normalisiereFokus,
  PROFILNAME_PLATZHALTER,
  type FokusId,
  type Zielstrebigkeit,
} from '../../../shared/spiel/profil.ts';
import { istStil, STANDARD_STIL, type Stil } from '../../../shared/features/darstellung/stile.ts';
import { istSprache, type Sprache } from '../../../shared/sprache/kern.ts';
import { anfrageSprache } from '../../anfrageSprache.ts';
import { alle, ausfuehren, eine, inTransaktion } from '../../db.ts';
import { ungueltig } from '../../fehler.ts';
import { istWeltLeer, wendeFokusAn } from '../../services/profilStart.ts';

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
  const wert = parse(roh);
  return istStil(wert) ? wert : STANDARD.stil;
}

function leseFarbe(roh: string | undefined): string | undefined {
  const wert = parse(roh);
  return istHexFarbe(wert) ? normaleHex(wert) : undefined;
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
  const gespeichert = new Map<string, string>();
  for (const zeile of alle<{ schluessel: string; wert: string }>('SELECT schluessel, wert FROM einstellungen')) {
    gespeichert.set(zeile.schluessel, zeile.wert);
  }
  const stil = leseStil(gespeichert.get('stil'));
  const vorlage = standardVorlage(stil, false);
  const primaer = leseFarbe(gespeichert.get('primaer'));
  const akzent = leseFarbe(gespeichert.get('akzent'));
  const hintergrund = leseFarbe(gespeichert.get('hintergrund'));
  const eigeneFarben = primaer !== undefined && akzent !== undefined && hintergrund !== undefined;
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
    primaer: primaer ?? vorlage.primaer,
    akzent: akzent ?? vorlage.akzent,
    hintergrund: hintergrund ?? vorlage.hintergrund,
    glimmen: leseGlimmen(gespeichert.get('glimmen')),
    eigeneFarben,
    funktionen,
    mobilLeiste: leseLeiste(gespeichert.get('mobilLeiste')),
    ebenen: leseEbenen(parse(gespeichert.get('ebenen'))),
    ebenenZahlen: zaehleEbenen(),
    attribute: funktionsAttribute(funktionen),
    sprache: leseSprache(gespeichert.get('sprache')),
    zeitzone: leseZone(gespeichert.get('zeitzone')),
  };
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

export function aendereEinstellungen(
  aenderung: Partial<Grundeinstellungen> & {
    funktionen?: Partial<Funktionen>;
    ebenen?: Partial<Ebenen>;
    sprache?: Sprache;
    zeitzone?: string;
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
    if (stufe && stufeWechselt) {
      speichere('ebenen', ebenenFuerStufe(stufe));
    } else if (aenderung.ebenen !== undefined) {
      speichere('ebenen', wendeEbenenAn(bisher.ebenen, aenderung.ebenen));
    }
    let funktionen = { ...bisher.funktionen, ...aenderung.funktionen };
    if (aenderung.fokus !== undefined) {
      const fokus = normalisiereFokus(aenderung.fokus);
      const sprache = aenderung.sprache ?? bisher.sprache ?? anfrageSprache();
      funktionen = { ...funktionen, ...wendeFokusAn(fokus, new Date(), sprache, ersteAnlage) };
      if (ersteAnlage && fokus.includes('sport')) {
        funktionen = { ...funktionen, training: true };
      }
      speichere('fokus', fokus);
    }
    const stufeFunktionen = stufe && stufeWechselt ? funktionenFuerStufe(stufe) : {};
    funktionen = { ...funktionen, ...stufeFunktionen };
    if (!funktionen.koennen && !funktionen.status) {
      throw ungueltig('Können oder Haben muss aktiv bleiben.');
    }
    if (aenderung.funktionen !== undefined || aenderung.fokus !== undefined || Object.keys(stufeFunktionen).length > 0) {
      speichere(FUNKTIONEN_SCHLUESSEL, funktionen);
    }
    if (aenderung.profilAngelegt !== undefined) {
      speichere('profilAngelegt', aenderung.profilAngelegt);
    }
    if (aenderung.stil !== undefined) {
      speichere('stil', aenderung.stil);
    }
    if (aenderung.primaer !== undefined) {
      speichere('primaer', normaleHex(aenderung.primaer));
    }
    if (aenderung.akzent !== undefined) {
      speichere('akzent', normaleHex(aenderung.akzent));
    }
    if (aenderung.hintergrund !== undefined) {
      speichere('hintergrund', normaleHex(aenderung.hintergrund));
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
  });
  return ladeEinstellungen();
}
