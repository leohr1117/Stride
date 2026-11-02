import type { TodoistLabel, TodoistLabelDaten, TodoistOhne, TodoistZielArt, TodoistZuordnung, TodoistZuordnungDaten } from '../../../../shared/api/index.ts';
import { taetigkeitPasst } from '../../../../shared/spiel/taetigkeit.ts';
import { tx } from '../../text.ts';
import type { ZielBlick } from '../../todoistZiel.ts';
import { projektVonZiel } from './gemeinsam.ts';

export interface ZaehlAnzeige {
  text: string;
  eigene: boolean;
}

export interface ZaehlOption {
  wert: string;
  name: string;
  ebene?: number;
  waehlbar?: boolean;
}

export interface ZuordnungsStand {
  zielArt: TodoistZielArt | null;
  zielId: number | null;
  projektId: number | null;
  vorlageId: number | null;
  stunden: number | null;
  faehigkeitId: number | null;
  abschluss: 'geschafft' | 'gescheitert' | null;
  erkenntnis: string;
  notiz: string;
  meilenstein: boolean;
}

interface VorlageKurz {
  id: number;
  name: string;
  projektId: number | null;
}

export function vorlageName(taetigkeiten: readonly { id: number; name: string }[], id: number | null): string | null {
  if (id === null) {
    return null;
  }
  return taetigkeiten.find((eintrag) => eintrag.id === id)?.name ?? null;
}

/** „Zählt nicht“ ist keine Tätigkeit. Eine gesetzte Standard-Tätigkeit ist die eigene Wahl der Standard-Zeile. */
export function standardAnzeige(ohne: TodoistOhne, vorlageId: number | null, name: string | null): ZaehlAnzeige {
  if (ohne === 'standard' && vorlageId !== null && name) {
    return { text: name, eigene: true };
  }
  return { text: tx('Zählt nicht'), eigene: false };
}

/** Ohne eigene Tätigkeit zeigt die Zeile den Standard, grau. */
export function projektAnzeige(vorlageId: number | null, name: string | null, standard: ZaehlAnzeige): ZaehlAnzeige {
  if (vorlageId !== null && name) {
    return { text: name, eigene: true };
  }
  return { text: standard.text, eigene: false };
}

export function erbeName(standard: ZaehlAnzeige): string {
  if (!standard.eigene) {
    return tx('Zählt nicht');
  }
  return tx('Standard · {name}', { name: standard.text });
}

export function labelWirkt(label: {
  aktiv: boolean;
  vorlageId: number | null;
  zielArt: TodoistZielArt | null;
  zielId: number | null;
}): boolean {
  return label.aktiv && (label.vorlageId !== null || (label.zielArt !== null && label.zielId !== null));
}

export function labelAnzeige(aktiv: boolean, vorlageId: number | null, name: string | null): ZaehlAnzeige {
  if (aktiv && vorlageId !== null && name) {
    return { text: name, eigene: true };
  }
  return { text: tx('Wie Projekt'), eigene: false };
}

export function standardDaten(vorlageId: number | null): { art: TodoistOhne; vorlageId: number | null } {
  if (vorlageId === null) {
    return { art: 'keine', vorlageId: null };
  }
  return { art: 'standard', vorlageId };
}

function stundenOderLeer(stunden: number | null): number | null {
  return stunden === 0 ? null : stunden;
}

function faehigkeitOderLeer(id: number | null): number | null {
  return id !== null && id > 0 ? id : null;
}

export function standAusProjekt(zeile: TodoistZuordnung): ZuordnungsStand {
  return {
    zielArt: zeile.zielArt,
    zielId: zeile.zielId,
    projektId: zeile.projektId,
    vorlageId: zeile.vorlageId,
    stunden: stundenOderLeer(zeile.stunden),
    faehigkeitId: faehigkeitOderLeer(zeile.faehigkeitId),
    abschluss: zeile.abschluss,
    erkenntnis: zeile.erkenntnis,
    notiz: zeile.notiz,
    meilenstein: zeile.meilenstein,
  };
}

export function standAusLabel(zeile: TodoistLabel): ZuordnungsStand {
  const wirkt = labelWirkt(zeile);
  const abschluss = zeile.abschluss === 'geschafft' || zeile.abschluss === 'gescheitert' ? zeile.abschluss : null;
  return {
    zielArt: wirkt ? zeile.zielArt : null,
    zielId: wirkt ? zeile.zielId : null,
    projektId: wirkt ? zeile.projektId : null,
    vorlageId: wirkt ? zeile.vorlageId : null,
    stunden: stundenOderLeer(zeile.stunden),
    faehigkeitId: faehigkeitOderLeer(zeile.faehigkeitId),
    abschluss: wirkt ? abschluss : null,
    erkenntnis: wirkt ? zeile.erkenntnis : '',
    notiz: zeile.notiz,
    meilenstein: wirkt && zeile.meilenstein === true,
  };
}

/** Die erste Option löscht die Tätigkeit. Sie bleibt nicht stehen. */
export function mitVorlage(stand: ZuordnungsStand, vorlageId: number | null): ZuordnungsStand {
  return { ...stand, vorlageId };
}

function vorlageBleibt(taetigkeiten: readonly { id: number; projektId: number | null }[], vorlageId: number | null, projektId: number | null): number | null {
  if (vorlageId === null) {
    return null;
  }
  const vorlage = taetigkeiten.find((eintrag) => eintrag.id === vorlageId);
  return vorlage && taetigkeitPasst(vorlage.projektId, projektId) ? vorlageId : null;
}

export function zielSetzen(
  stand: ZuordnungsStand,
  ziel: { art: TodoistZielArt; id: number } | null,
  taetigkeiten: readonly { id: number; projektId: number | null }[],
  blick: ZielBlick,
): ZuordnungsStand {
  if (!ziel) {
    return {
      ...stand,
      zielArt: null,
      zielId: null,
      projektId: null,
      vorlageId: vorlageBleibt(taetigkeiten, stand.vorlageId, null),
      abschluss: null,
    };
  }
  const projektId = projektVonZiel(ziel.art, ziel.id, stand.projektId, blick);
  return {
    ...stand,
    zielArt: ziel.art,
    zielId: ziel.id,
    projektId,
    vorlageId: vorlageBleibt(taetigkeiten, stand.vorlageId, projektId),
    abschluss: ziel.art === 'vorhaben' ? stand.abschluss : null,
    meilenstein: ziel.art === 'vorhaben' ? false : stand.meilenstein,
  };
}

export function visionProjektSetzen(
  stand: ZuordnungsStand,
  projektId: number | null,
  taetigkeiten: readonly { id: number; projektId: number | null }[],
): ZuordnungsStand {
  return { ...stand, projektId, vorlageId: vorlageBleibt(taetigkeiten, stand.vorlageId, projektId) };
}

export function gruppenProjekt(stand: ZuordnungsStand, blick: ZielBlick): { id: number; name: string } | null {
  if (stand.zielArt === null || stand.zielId === null) {
    return null;
  }
  const id = projektVonZiel(stand.zielArt, stand.zielId, stand.projektId, blick);
  if (id === null) {
    return null;
  }
  const name = blick.projekte.find((projekt) => projekt.id === id)?.name;
  return name ? { id, name } : null;
}

export function zaehlOptionen(
  erste: string,
  taetigkeiten: readonly VorlageKurz[],
  gruppenProjektId: number | null,
  gruppenName: string | null,
  behaltenId: number | null,
): ZaehlOption[] {
  const optionen: ZaehlOption[] = [{ wert: '', name: erste }];
  const allgemein = taetigkeiten.filter((eintrag) => eintrag.projektId === null);
  if (allgemein.length > 0) {
    optionen.push({ wert: 'gruppe-alle', name: tx('Für alle Projekte'), waehlbar: false });
    for (const vorlage of allgemein) {
      optionen.push({ wert: String(vorlage.id), name: vorlage.name, ebene: 1 });
    }
  }
  if (gruppenProjektId !== null && gruppenName) {
    const eigen = taetigkeiten.filter((eintrag) => eintrag.projektId === gruppenProjektId);
    if (eigen.length > 0) {
      optionen.push({ wert: 'gruppe-nur', name: tx('Nur für {name}', { name: gruppenName }), waehlbar: false });
      for (const vorlage of eigen) {
        optionen.push({ wert: String(vorlage.id), name: vorlage.name, ebene: 1 });
      }
    }
  }
  if (behaltenId !== null && !optionen.some((option) => option.wert === String(behaltenId))) {
    const vorlage = taetigkeiten.find((eintrag) => eintrag.id === behaltenId);
    if (vorlage) {
      optionen.push({ wert: String(vorlage.id), name: vorlage.name });
    }
  }
  return optionen;
}

function hatZiel(stand: ZuordnungsStand): boolean {
  return stand.zielArt !== null && stand.zielId !== null;
}

export function projektDaten(stand: ZuordnungsStand): TodoistZuordnungDaten {
  const ziel = hatZiel(stand);
  const vorhaben = ziel && stand.zielArt === 'vorhaben';
  return {
    projektId: ziel ? stand.projektId : null,
    vorlageId: stand.vorlageId,
    stunden: stand.stunden,
    zielArt: ziel ? stand.zielArt : null,
    zielId: ziel ? stand.zielId : null,
    faehigkeitId: stand.faehigkeitId,
    abschluss: vorhaben ? stand.abschluss : null,
    erkenntnis: stand.abschluss === 'gescheitert' ? stand.erkenntnis : '',
    notiz: stand.notiz,
    meilenstein: !vorhaben && (ziel || stand.vorlageId !== null) ? stand.meilenstein : false,
  };
}

export function labelDaten(stand: ZuordnungsStand): TodoistLabelDaten {
  const ziel = hatZiel(stand);
  const vorhaben = ziel && stand.zielArt === 'vorhaben';
  const aktiv = stand.vorlageId !== null || ziel;
  return {
    aktiv,
    zielArt: ziel ? stand.zielArt : null,
    zielId: ziel ? stand.zielId : null,
    projektId: ziel ? stand.projektId : null,
    vorlageId: stand.vorlageId,
    stunden: stand.stunden,
    faehigkeitId: stand.faehigkeitId,
    abschluss: vorhaben ? stand.abschluss : null,
    erkenntnis: stand.abschluss === 'gescheitert' ? stand.erkenntnis : '',
    notiz: stand.notiz,
    meilenstein: aktiv && !vorhaben ? stand.meilenstein : null,
  };
}

export function weiteresGesetzt(stand: ZuordnungsStand): boolean {
  return (
    stand.stunden !== null ||
    stand.faehigkeitId !== null ||
    stand.meilenstein ||
    stand.abschluss !== null ||
    stand.erkenntnis !== '' ||
    stand.notiz !== ''
  );
}

export function verschiebe(ids: readonly string[], id: string, richtung: -1 | 1): string[] | null {
  const liste = [...ids];
  const index = liste.indexOf(id);
  const ziel = index + richtung;
  if (index < 0 || ziel < 0 || ziel >= liste.length) {
    return null;
  }
  const [entfernt] = liste.splice(index, 1);
  if (entfernt === undefined) {
    return null;
  }
  liste.splice(ziel, 0, entfernt);
  return liste;
}

export function vorlageIdAusWahl(wert: string): number | null {
  if (wert === '' || wert.startsWith('gruppe-')) {
    return null;
  }
  const id = Number(wert);
  return Number.isInteger(id) && id > 0 ? id : null;
}
