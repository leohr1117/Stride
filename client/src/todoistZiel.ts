import type { TodoistZielArt } from '../../shared/api/index.ts';

export interface ZielProjekt {
  id: number;
  name: string;
  visionId: number | null;
  organisationId: number | null;
  aktiv: boolean;
}

export interface ZielVorhaben {
  id: number;
  titel: string;
  projektId: number | null;
  status: string;
}

export interface ZielVision {
  id: number;
  titel: string;
}

export interface ZielOrganisation {
  id: number;
  visionId: number | null;
}

export interface ZielBlick {
  projekte: readonly ZielProjekt[];
  vorhaben: readonly ZielVorhaben[];
  visionen: readonly ZielVision[];
  organisationen: readonly ZielOrganisation[];
}

export interface ZielVorschlag {
  zielArt: TodoistZielArt;
  zielId: number;
  projektId: number | null;
}

function nachName<T extends { id: number }>(name: (eintrag: T) => string) {
  return (links: T, rechts: T) => name(links).localeCompare(name(rechts), 'de') || links.id - rechts.id;
}

function gleicherName(links: string, rechts: string): boolean {
  return links.localeCompare(rechts, 'de', { sensitivity: 'accent' }) === 0;
}

export function zielSchluessel(art: TodoistZielArt | null, id: number | null): string {
  if (art === null || id === null) {
    return '';
  }
  return `${art}:${id}`;
}

export function parseZiel(wert: string): { art: TodoistZielArt; id: number } | null {
  const treffer = /^(vision|projekt|vorhaben):(\d+)$/.exec(wert);
  if (!treffer) {
    return null;
  }
  return { art: treffer[1] as TodoistZielArt, id: Number(treffer[2]) };
}

export function gehoertZurVision(projekt: ZielProjekt, organisationen: readonly ZielOrganisation[], visionId: number): boolean {
  if (projekt.visionId === visionId) {
    return true;
  }
  const organisation = organisationen.find((eintrag) => eintrag.id === projekt.organisationId);
  return organisation?.visionId === visionId;
}

export function projekteFuerVision(blick: ZielBlick, visionId: number): ZielProjekt[] {
  return blick.projekte
    .filter((projekt) => projekt.aktiv && gehoertZurVision(projekt, blick.organisationen, visionId))
    .sort(nachName((projekt) => projekt.name));
}

/** Name, Groß/Klein egal: Projekt, dann offenes Vorhaben, dann Vision mit Projekt. Sonst das erste davon. */
export function zielVorschlag(name: string, blick: ZielBlick): ZielVorschlag | null {
  const projekte = blick.projekte.filter((projekt) => projekt.aktiv).sort(nachName((projekt) => projekt.name));
  const vorhaben = blick.vorhaben
    .filter((eintrag) => eintrag.status === 'offen' && eintrag.projektId !== null)
    .sort(nachName((eintrag) => eintrag.titel));
  const visionen = blick.visionen
    .filter((vision) => projekteFuerVision(blick, vision.id).length > 0)
    .sort(nachName((vision) => vision.titel));

  const projekt = projekte.find((eintrag) => gleicherName(eintrag.name, name));
  if (projekt) {
    return { zielArt: 'projekt', zielId: projekt.id, projektId: projekt.id };
  }
  const aufgabe = vorhaben.find((eintrag) => gleicherName(eintrag.titel, name));
  if (aufgabe?.projektId) {
    return { zielArt: 'vorhaben', zielId: aufgabe.id, projektId: aufgabe.projektId };
  }
  const vision = visionen.find((eintrag) => gleicherName(eintrag.titel, name));
  if (vision) {
    return { zielArt: 'vision', zielId: vision.id, projektId: projekteFuerVision(blick, vision.id)[0]?.id ?? null };
  }
  const erstesProjekt = projekte[0];
  if (erstesProjekt) {
    return { zielArt: 'projekt', zielId: erstesProjekt.id, projektId: erstesProjekt.id };
  }
  const erstesVorhaben = vorhaben[0];
  if (erstesVorhaben?.projektId) {
    return { zielArt: 'vorhaben', zielId: erstesVorhaben.id, projektId: erstesVorhaben.projektId };
  }
  const ersteVision = visionen[0];
  if (ersteVision) {
    return { zielArt: 'vision', zielId: ersteVision.id, projektId: projekteFuerVision(blick, ersteVision.id)[0]?.id ?? null };
  }
  return null;
}

export function vorschauTeile(teile: readonly (string | null | undefined)[]): string {
  return teile.filter((teil): teil is string => Boolean(teil && teil.trim() !== '')).join(' · ');
}
