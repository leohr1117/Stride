import type { Attribut } from '../../../shared/api/index.ts';
import { ATTRIBUT_KENNUNGEN, type AttributKennung } from '../../../shared/spiel/begriffe.ts';
import { radarWert } from '../../../shared/spiel/radar.ts';
import type { KennungsLevel } from '../../../shared/features/vorbilder/vorbilder.ts';

export interface EigenesProfil {
  /** Level plus Fortschritt, nur aktive Werte. */
  level: Partial<KennungsLevel>;
  kennungen: AttributKennung[];
  namen: Map<AttributKennung, string>;
}

export interface ProfilBereiche {
  koennen: boolean;
  status: boolean;
}

/** Aktive Kennungen. Archivierte Werte und ausgeschaltete Bereiche zählen nicht. */
export function eigenesProfil(
  attribute: Attribut[],
  bereiche: ProfilBereiche = { koennen: true, status: true },
): EigenesProfil {
  const level: Partial<KennungsLevel> = {};
  const namen = new Map<AttributKennung, string>();
  const typAn = { attribut: bereiche.koennen, status: bereiche.status };
  for (const attribut of attribute) {
    if (attribut.kennung === null || attribut.archiviert || !typAn[attribut.typ]) {
      continue;
    }
    if (namen.has(attribut.kennung)) {
      continue;
    }
    level[attribut.kennung] = radarWert(attribut.level);
    namen.set(attribut.kennung, attribut.name);
  }
  return { level, kennungen: ATTRIBUT_KENNUNGEN.filter((kennung) => namen.has(kennung)), namen };
}
