import type { AttributKennung } from '../../shared/spiel/begriffe.ts';
import { FUNKTIONEN, type Funktionen } from '../../shared/spiel/funktionen.ts';
import type { FokusId, Zielstrebigkeit } from '../../shared/spiel/profil.ts';
import { eine } from '../../server/db.ts';
import { ladeAttribute } from '../../server/features/attribute/attribute.ts';
import { aendereEinstellungen } from '../../server/features/einstellungen/einstellungen.ts';
import { erstelleKnoten } from '../../server/features/faehigkeiten/faehigkeiten.ts';
import { ladeVorlagen } from '../../server/features/taetigkeiten/vorlagen.ts';
import { lokalesDatum, tagesbeginn } from '../../server/services/zeit.ts';

export const JETZT = new Date();
export const TAGE_VOLL = 35;
export const TAGE_TEIL = 14;
export const ZUFALL_VOLL = 20261022;
export const ZUFALL_TEIL = 20261023;

let zustandZufall = 0;

export function setzeZufall(start: number): void {
  zustandZufall = start;
}

export function zufall(): number {
  zustandZufall = (zustandZufall + 0x6d2b79f5) | 0;
  let t = Math.imul(zustandZufall ^ (zustandZufall >>> 15), 1 | zustandZufall);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | zustandZufall)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function waehle<T>(liste: T[]): T {
  if (liste.length === 0) {
    throw new Error('Die Liste ist leer.');
  }
  return liste[Math.floor(zufall() * liste.length)] as T;
}

export function alleFunktionenAn(): Funktionen {
  const funktionen = {} as Funktionen;
  for (const funktion of FUNKTIONEN) {
    funktionen[funktion] = true;
  }
  return funktionen;
}

export function legeProfilAn(daten: {
  profilname: string;
  geburtsjahr: number;
  zielstrebigkeit: Zielstrebigkeit;
  fokus: readonly FokusId[];
}): void {
  aendereEinstellungen({
    sprache: 'de',
    geburtsjahr: daten.geburtsjahr,
    charakterName: daten.profilname,
    zielstrebigkeit: daten.zielstrebigkeit,
    fokus: [...daten.fokus],
    profilAngelegt: true,
  });
}

export function baum(faehigkeitId: number, knoten: [string, string | null][]): Map<string, number> {
  const ids = new Map<string, number>();
  for (const [titel, eltern] of knoten) {
    const faehigkeit = erstelleKnoten(faehigkeitId, {
      titel,
      beschreibung: '',
      elternId: eltern === null ? null : (ids.get(eltern) ?? null),
    });
    const neu = faehigkeit.knoten.find((eintrag) => eintrag.titel === titel);
    if (neu) {
      ids.set(titel, neu.id);
    }
  }
  return ids;
}

export function attributId(kennung: AttributKennung): number {
  const attribut = ladeAttribute(false).find((eintrag) => eintrag.kennung === kennung);
  if (attribut === undefined) {
    throw new Error(`Attribut "${kennung}" ist nicht aktiv.`);
  }
  return attribut.id;
}

export function vorlageId(name: string): number {
  const vorlage = ladeVorlagen().find((eintrag) => eintrag.name === name);
  if (vorlage === undefined) {
    throw new Error(`Tätigkeit "${name}" fehlt.`);
  }
  return vorlage.id;
}

export function zaehle(tabelle: string, extra = ''): number {
  return eine<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tabelle} ${extra}`)?.n ?? 0;
}

export function versuche(aktion: () => void): void {
  try {
    aktion();
  } catch (fehler) {
    if (!(fehler instanceof Error) || !fehler.message.includes('schon')) {
      throw fehler;
    }
  }
}

export function tagVor(tage: number): string {
  return lokalesDatum(tagesbeginn(JETZT, tage));
}

export function zeitpunktVor(tage: number, stunde: number): Date {
  const zeitpunkt = tagesbeginn(JETZT, tage);
  zeitpunkt.setHours(stunde);
  return zeitpunkt;
}

export function datumVor(tage: number): string | null {
  return tage === 0 ? null : tagVor(tage);
}
