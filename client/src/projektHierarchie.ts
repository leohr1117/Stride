/** Ein Projekt steht unter seiner Organisation, wenn die zur Vision gehört. Sonst direkt unter der Vision. */

export interface GliedProjekt {
  id: number;
  name: string;
  visionId: number | null;
  organisationId: number | null;
}

export interface GliedVision {
  id: number;
  titel: string;
  farbe: string;
}

export interface GliedOrganisation {
  id: number;
  name: string;
  farbe: string;
  visionId: number | null;
}

export interface GliedOrg<P extends GliedProjekt = GliedProjekt, O extends GliedOrganisation = GliedOrganisation> {
  organisation: O;
  projekte: P[];
}

export interface GliedVisionAst<
  P extends GliedProjekt = GliedProjekt,
  V extends GliedVision = GliedVision,
  O extends GliedOrganisation = GliedOrganisation,
> {
  vision: V;
  direkte: P[];
  organisationen: GliedOrg<P, O>[];
}

export interface Gliederung<
  P extends GliedProjekt = GliedProjekt,
  V extends GliedVision = GliedVision,
  O extends GliedOrganisation = GliedOrganisation,
> {
  visionen: GliedVisionAst<P, V, O>[];
  freieOrganisationen: GliedOrg<P, O>[];
  lose: P[];
}

export interface WahlKnoten {
  schluessel: string;
  wert: string;
  name: string;
  waehlbar: boolean;
  farbe?: string;
  ast: 'vision' | 'organisation' | 'projekt' | 'vorhaben' | 'hinweis';
  kinder: WahlKnoten[];
}

export function gliedereProjekte<P extends GliedProjekt, V extends GliedVision, O extends GliedOrganisation>(
  projekte: readonly P[],
  visionen: readonly V[],
  organisationen: readonly O[],
  optionen: { leereOrganisationen?: boolean; leereVisionen?: boolean } = {},
): Gliederung<P, V, O> {
  const gesehen = new Set<number>();
  const nimm = (passend: (projekt: P) => boolean): P[] => {
    const treffer: P[] = [];
    for (const projekt of projekte) {
      if (gesehen.has(projekt.id) || !passend(projekt)) {
        continue;
      }
      gesehen.add(projekt.id);
      treffer.push(projekt);
    }
    return treffer;
  };

  const visionIds = new Set(visionen.map((vision) => vision.id));
  const aeste: GliedVisionAst<P, V, O>[] = [];
  for (const vision of visionen) {
    const orgs = organisationen.filter((organisation) => organisation.visionId === vision.id);
    const orgIds = new Set(orgs.map((organisation) => organisation.id));
    const direkte = nimm(
      (projekt) => projekt.visionId === vision.id && (projekt.organisationId === null || !orgIds.has(projekt.organisationId)),
    );
    const gruppen: GliedOrg<P, O>[] = [];
    for (const organisation of orgs) {
      const eigene = nimm((projekt) => projekt.organisationId === organisation.id);
      if (eigene.length > 0 || optionen.leereOrganisationen) {
        gruppen.push({ organisation, projekte: eigene });
      }
    }
    if (direkte.length > 0 || gruppen.length > 0 || optionen.leereVisionen) {
      aeste.push({ vision, direkte, organisationen: gruppen });
    }
  }

  const freieOrganisationen: GliedOrg<P, O>[] = [];
  for (const organisation of organisationen) {
    if (organisation.visionId !== null && visionIds.has(organisation.visionId)) {
      continue;
    }
    const eigene = nimm((projekt) => projekt.organisationId === organisation.id);
    if (eigene.length > 0 || optionen.leereOrganisationen) {
      freieOrganisationen.push({ organisation, projekte: eigene });
    }
  }

  return { visionen: aeste, freieOrganisationen, lose: nimm(() => true) };
}

export function projektKnoten(projekt: GliedProjekt, farbe?: string): WahlKnoten {
  return {
    schluessel: `projekt:${projekt.id}`,
    wert: String(projekt.id),
    name: projekt.name,
    waehlbar: true,
    farbe,
    ast: 'projekt',
    kinder: [],
  };
}

export function wahlBaum<P extends GliedProjekt>(
  gliederung: Gliederung<P>,
  namen: { leer?: string; ohneVision: string },
  knotenFuerProjekt: (projekt: P, farbe: string | undefined) => WahlKnoten = projektKnoten,
  visionWaehlbar = false,
): WahlKnoten[] {
  const knoten: WahlKnoten[] = [];
  if (namen.leer !== undefined) {
    knoten.push({ schluessel: 'leer', wert: '', name: namen.leer, waehlbar: true, ast: 'hinweis', kinder: [] });
  }
  for (const ast of gliederung.visionen) {
    knoten.push({
      schluessel: `vision:${ast.vision.id}`,
      wert: `vision:${ast.vision.id}`,
      name: ast.vision.titel,
      waehlbar: visionWaehlbar,
      farbe: ast.vision.farbe,
      ast: 'vision',
      kinder: [
        ...ast.direkte.map((projekt) => knotenFuerProjekt(projekt, ast.vision.farbe)),
        ...ast.organisationen.map((gruppe) => ({
          schluessel: `org:${gruppe.organisation.id}`,
          wert: `org:${gruppe.organisation.id}`,
          name: gruppe.organisation.name,
          waehlbar: false,
          farbe: gruppe.organisation.farbe,
          ast: 'organisation' as const,
          kinder: gruppe.projekte.map((projekt) => knotenFuerProjekt(projekt, gruppe.organisation.farbe)),
        })),
      ],
    });
  }
  for (const gruppe of gliederung.freieOrganisationen) {
    knoten.push({
      schluessel: `org:${gruppe.organisation.id}`,
      wert: `org:${gruppe.organisation.id}`,
      name: gruppe.organisation.name,
      waehlbar: false,
      farbe: gruppe.organisation.farbe,
      ast: 'organisation',
      kinder: gruppe.projekte.map((projekt) => knotenFuerProjekt(projekt, gruppe.organisation.farbe)),
    });
  }
  if (gliederung.lose.length > 0) {
    knoten.push({
      schluessel: 'ohne',
      wert: 'ohne',
      name: namen.ohneVision,
      waehlbar: false,
      ast: 'hinweis',
      kinder: gliederung.lose.map((projekt) => knotenFuerProjekt(projekt, undefined)),
    });
  }
  return knoten;
}

export function gewaehlterName(knoten: readonly WahlKnoten[], wert: string): string | null {
  for (const eintrag of knoten) {
    if (eintrag.waehlbar && eintrag.wert === wert) {
      return eintrag.name;
    }
    const tiefer = gewaehlterName(eintrag.kinder, wert);
    if (tiefer !== null) {
      return tiefer;
    }
  }
  return null;
}
