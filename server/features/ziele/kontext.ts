import type { ProjektKontext } from '../../../shared/api/index.ts';
import { NEUTRAL_FARBE } from '../../../shared/spiel/begriffe.ts';

export const KONTEXT_SPALTEN = `
  CASE
    WHEN p.vision_id IS NOT NULL THEN 'vision'
    WHEN p.organisation_id IS NOT NULL THEN 'organisation'
    ELSE NULL
  END AS kontextArt,
  COALESCE(v.id, o.id) AS kontextId,
  COALESCE(v.titel, o.name) AS kontextTitel,
  COALESCE(v.farbe, o.farbe) AS kontextFarbe
`;

export const KONTEXT_JOINS = `
  LEFT JOIN visionen v ON v.id = p.vision_id
  LEFT JOIN organisationen o ON o.id = p.organisation_id
`;

export const PROJEKT_FARBE = `COALESCE(v.farbe, o.farbe, '${NEUTRAL_FARBE}')`;
export const PROJEKT_AKTIV = `p.archiviert = 0 AND COALESCE(v.archiviert, o.archiviert, 0) = 0`;
export const PROJEKT_ODER_FREI = `(p.id IS NULL OR (${PROJEKT_AKTIV}))`;

export interface KontextZeile {
  kontextArt: ProjektKontext['art'] | null;
  kontextId: number | null;
  kontextTitel: string | null;
  kontextFarbe: string | null;
}

export function zuKontext(zeile: KontextZeile): ProjektKontext | null {
  if (
    zeile.kontextArt === null ||
    zeile.kontextId === null ||
    zeile.kontextTitel === null ||
    zeile.kontextFarbe === null
  ) {
    return null;
  }
  return { art: zeile.kontextArt, id: zeile.kontextId, titel: zeile.kontextTitel, farbe: zeile.kontextFarbe };
}
