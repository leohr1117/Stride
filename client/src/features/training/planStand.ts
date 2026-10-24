import type { PlanEintragDaten, TrainingsplanDaten } from '../../../../shared/api/training.ts';
import { taetigkeitenFuerProjekt } from '../../../../shared/spiel/taetigkeit.ts';
import {
  AUFWAERM_BRAUCHT_SAETZE,
  AUFWAERM_BRAUCHT_SEKUNDEN,
  AUFWAERM_BRAUCHT_WIEDERHOLUNGEN,
  DAUER_BRAUCHT_SEKUNDEN,
  GEWICHT_MINDEST,
  KRAFT_BRAUCHT_WIEDERHOLUNGEN,
  SAETZE_BIS,
  SAETZE_HINWEIS,
  SEKUNDEN_MINDEST,
  WIEDERHOLUNGEN_MINDEST,
  anzeigeAusGramm,
  grammBeimSpeichern,
  type GewichtEinheit,
  type UebungsArt,
} from '../../../../shared/spiel/training.ts';
import { hoechstensEineStelle } from '../../format.ts';

export const NAME_LEER = 'Der Name darf nicht leer sein.';
export const OHNE_TAETIGKEIT = 'Wähle eine Tätigkeit.';

export interface GewichtsFeld {
  text: string;
  gramm: number | null;
  beruehrt: boolean;
}

export interface EintragStand {
  schluessel: string;
  name: string;
  art: UebungsArt;
  saetze: string;
  wiederholungen: string;
  sekunden: string;
  gewicht: GewichtsFeld;
  aufwaermen: boolean;
  aufwaermSaetze: string;
  aufwaermWiederholungen: string;
  aufwaermSekunden: string;
  aufwaermGewicht: GewichtsFeld;
  nameFehler: string | null;
  vorgabeFehler: string | null;
  aufwaermFehler: string | null;
}

export interface PlanEingabe {
  name: string;
  wochentage: number[];
  projektId: number | null;
  vorlageId: number | null;
  eintraege: EintragStand[];
  einheit: GewichtEinheit;
}

export interface PlanPruefung {
  nameFehler: string | null;
  vorlageFehler: string | null;
  eintraege: EintragStand[];
  daten: TrainingsplanDaten | null;
}

export interface EintragQuelle {
  name: string;
  art: UebungsArt;
  zielSaetze: number | null;
  zielWiederholungen: number | null;
  zielGewichtG: number | null;
  zielSekunden: number | null;
  aufwaermSaetze: number | null;
  aufwaermWiederholungen: number | null;
  aufwaermGewichtG: number | null;
  aufwaermSekunden: number | null;
}

export function leeresGewicht(): GewichtsFeld {
  return { text: '', gramm: null, beruehrt: false };
}

export function gewichtAusGramm(gramm: number | null, einheit: GewichtEinheit): GewichtsFeld {
  if (gramm === null) {
    return leeresGewicht();
  }
  return { text: hoechstensEineStelle(anzeigeAusGramm(gramm, einheit)), gramm, beruehrt: false };
}

function zahlText(wert: number | null): string {
  return wert === null ? '' : String(wert);
}

export function leererEintrag(): EintragStand {
  return {
    schluessel: crypto.randomUUID(),
    name: '',
    art: 'kraft',
    saetze: '',
    wiederholungen: '',
    sekunden: '',
    gewicht: leeresGewicht(),
    aufwaermen: false,
    aufwaermSaetze: '',
    aufwaermWiederholungen: '',
    aufwaermSekunden: '',
    aufwaermGewicht: leeresGewicht(),
    nameFehler: null,
    vorgabeFehler: null,
    aufwaermFehler: null,
  };
}

export function eintragAus(quelle: EintragQuelle, einheit: GewichtEinheit): EintragStand {
  const aufwaermen =
    quelle.aufwaermSaetze !== null ||
    quelle.aufwaermWiederholungen !== null ||
    quelle.aufwaermGewichtG !== null ||
    quelle.aufwaermSekunden !== null;
  return {
    schluessel: crypto.randomUUID(),
    name: quelle.name,
    art: quelle.art,
    saetze: zahlText(quelle.zielSaetze),
    wiederholungen: zahlText(quelle.zielWiederholungen),
    sekunden: zahlText(quelle.zielSekunden),
    gewicht: gewichtAusGramm(quelle.zielGewichtG, einheit),
    aufwaermen,
    aufwaermSaetze: zahlText(quelle.aufwaermSaetze),
    aufwaermWiederholungen: zahlText(quelle.aufwaermWiederholungen),
    aufwaermSekunden: zahlText(quelle.aufwaermSekunden),
    aufwaermGewicht: gewichtAusGramm(quelle.aufwaermGewichtG, einheit),
    nameFehler: null,
    vorgabeFehler: null,
    aufwaermFehler: null,
  };
}

export function wechselEinheit(eintrag: EintragStand, einheit: GewichtEinheit): EintragStand {
  return {
    ...eintrag,
    gewicht: schreibeGewicht(eintrag.gewicht, einheit),
    aufwaermGewicht: schreibeGewicht(eintrag.aufwaermGewicht, einheit),
  };
}

function schreibeGewicht(feld: GewichtsFeld, einheit: GewichtEinheit): GewichtsFeld {
  if (feld.beruehrt || feld.gramm === null) {
    return feld;
  }
  return { ...feld, text: hoechstensEineStelle(anzeigeAusGramm(feld.gramm, einheit)) };
}

export function liesZahl(text: string): number | null {
  const sauber = text.trim().replace(',', '.');
  if (sauber === '') {
    return null;
  }
  const zahl = Number(sauber);
  return Number.isFinite(zahl) ? zahl : null;
}

function liesGanz(text: string): { wert: number | null; ungueltig: boolean } {
  const roh = text.trim();
  if (roh === '') {
    return { wert: null, ungueltig: false };
  }
  const zahl = liesZahl(roh);
  if (zahl === null || !Number.isInteger(zahl)) {
    return { wert: null, ungueltig: true };
  }
  return { wert: zahl, ungueltig: false };
}

function saetzeVon(text: string, pflicht: boolean): { wert: number | null; fehler: string | null } {
  const gelesen = liesGanz(text);
  if (gelesen.ungueltig || (gelesen.wert !== null && (gelesen.wert < 1 || gelesen.wert > SAETZE_BIS))) {
    return { wert: null, fehler: SAETZE_HINWEIS };
  }
  if (gelesen.wert === null && pflicht) {
    return { wert: null, fehler: AUFWAERM_BRAUCHT_SAETZE };
  }
  return { wert: gelesen.wert, fehler: null };
}

function mengeVon(text: string, pflicht: string | null, ungueltigSatz: string): { wert: number | null; fehler: string | null } {
  const gelesen = liesGanz(text);
  if (gelesen.ungueltig || (gelesen.wert !== null && gelesen.wert < 1)) {
    return { wert: null, fehler: ungueltigSatz };
  }
  if (gelesen.wert === null && pflicht !== null) {
    return { wert: null, fehler: pflicht };
  }
  return { wert: gelesen.wert, fehler: null };
}

function gewichtVon(feld: GewichtsFeld, einheit: GewichtEinheit, aktiv: boolean): { gramm: number | null; fehler: string | null } {
  if (!aktiv) {
    return { gramm: null, fehler: null };
  }
  if (feld.text.trim() === '') {
    return { gramm: null, fehler: null };
  }
  const zahl = liesZahl(feld.text);
  if (zahl === null || zahl <= 0) {
    return { gramm: null, fehler: GEWICHT_MINDEST };
  }
  const gramm = grammBeimSpeichern(feld.gramm, zahl, einheit);
  if (gramm === null || gramm < 1) {
    return { gramm: null, fehler: GEWICHT_MINDEST };
  }
  return { gramm, fehler: null };
}

interface Seite {
  wiederholungen: number | null;
  sekunden: number | null;
  gewichtG: number | null;
  fehler: string | null;
}

function seiteVon(
  art: UebungsArt,
  wiederholungenText: string,
  sekundenText: string,
  gewicht: GewichtsFeld,
  einheit: GewichtEinheit,
  aufwaermen: boolean,
): Seite {
  const kraft = art === 'kraft';
  const reps = mengeVon(
    wiederholungenText,
    kraft ? (aufwaermen ? AUFWAERM_BRAUCHT_WIEDERHOLUNGEN : KRAFT_BRAUCHT_WIEDERHOLUNGEN) : null,
    WIEDERHOLUNGEN_MINDEST,
  );
  const sekunden = mengeVon(
    sekundenText,
    kraft ? null : aufwaermen ? AUFWAERM_BRAUCHT_SEKUNDEN : DAUER_BRAUCHT_SEKUNDEN,
    SEKUNDEN_MINDEST,
  );
  const gewichtErgebnis = gewichtVon(gewicht, einheit, kraft);
  if (!kraft) {
    return { wiederholungen: null, sekunden: sekunden.wert, gewichtG: null, fehler: sekunden.fehler };
  }
  return {
    wiederholungen: reps.wert,
    sekunden: null,
    gewichtG: gewichtErgebnis.gramm,
    fehler: reps.fehler ?? gewichtErgebnis.fehler,
  };
}

function blockVon(
  art: UebungsArt,
  saetzeText: string,
  wiederholungenText: string,
  sekundenText: string,
  gewicht: GewichtsFeld,
  einheit: GewichtEinheit,
  aufwaermen: boolean,
): { saetze: number | null; seite: Seite; fehler: string | null } {
  const saetze = saetzeVon(saetzeText, aufwaermen);
  const seite = seiteVon(art, wiederholungenText, sekundenText, gewicht, einheit, aufwaermen);
  return { saetze: saetze.wert, seite, fehler: saetze.fehler ?? seite.fehler };
}

function eintragDaten(eintrag: EintragStand, einheit: GewichtEinheit): { stand: EintragStand; daten: PlanEintragDaten | null } {
  const name = eintrag.name.trim();
  const nameFehler = name.length === 0 ? NAME_LEER : null;
  const arbeit = blockVon(eintrag.art, eintrag.saetze, eintrag.wiederholungen, eintrag.sekunden, eintrag.gewicht, einheit, false);
  const aufwaerm = eintrag.aufwaermen
    ? blockVon(
        eintrag.art,
        eintrag.aufwaermSaetze,
        eintrag.aufwaermWiederholungen,
        eintrag.aufwaermSekunden,
        eintrag.aufwaermGewicht,
        einheit,
        true,
      )
    : null;
  const stand: EintragStand = {
    ...eintrag,
    nameFehler,
    vorgabeFehler: arbeit.fehler,
    aufwaermFehler: aufwaerm?.fehler ?? null,
  };
  if (nameFehler !== null || arbeit.fehler !== null || (aufwaerm?.fehler ?? null) !== null) {
    return { stand, daten: null };
  }
  return {
    stand,
    daten: {
      name,
      art: eintrag.art,
      zielSaetze: arbeit.saetze,
      zielWiederholungen: arbeit.seite.wiederholungen,
      zielGewichtG: arbeit.seite.gewichtG,
      zielSekunden: arbeit.seite.sekunden,
      aufwaermSaetze: aufwaerm?.saetze ?? null,
      aufwaermWiederholungen: aufwaerm?.seite.wiederholungen ?? null,
      aufwaermGewichtG: aufwaerm?.seite.gewichtG ?? null,
      aufwaermSekunden: aufwaerm?.seite.sekunden ?? null,
    },
  };
}

export function pruefePlan(eingabe: PlanEingabe): PlanPruefung {
  const name = eingabe.name.trim();
  const nameFehler = name.length === 0 ? NAME_LEER : null;
  const vorlageFehler = eingabe.vorlageId === null ? OHNE_TAETIGKEIT : null;
  const geprueft = eingabe.eintraege.map((eintrag) => eintragDaten(eintrag, eingabe.einheit));
  const eintraege = geprueft.map((eintrag) => eintrag.stand);
  const zeilen = geprueft.map((eintrag) => eintrag.daten);
  const wochentage = [...new Set(eingabe.wochentage.filter((tag) => tag >= 1 && tag <= 7))].sort((links, rechts) => links - rechts);
  const kaputt =
    nameFehler !== null ||
    vorlageFehler !== null ||
    zeilen.some((zeile) => zeile === null) ||
    eintraege.some((eintrag) => eintrag.nameFehler !== null || eintrag.vorgabeFehler !== null || eintrag.aufwaermFehler !== null);
  if (kaputt) {
    return { nameFehler, vorlageFehler, eintraege, daten: null };
  }
  return {
    nameFehler: null,
    vorlageFehler: null,
    eintraege,
    daten: {
      name,
      wochentage,
      projektId: eingabe.projektId,
      vorlageId: eingabe.vorlageId,
      uebungen: zeilen.filter((zeile): zeile is PlanEintragDaten => zeile !== null),
    },
  };
}

export function standardVorlageId(
  vorlagen: readonly { id: number; name: string; projektId: number | null; archiviert?: boolean }[],
): number | null {
  return taetigkeitenFuerProjekt(vorlagen, null).find((vorlage) => vorlage.name === 'Training')?.id ?? null;
}
