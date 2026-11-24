import { istVersionsnummer, versionKleiner } from '../shared/spiel/updateHinweis.ts';
import type { Versionseintrag } from '../shared/versionen.ts';

export const TEST_VERSION = '4.2.7';

export const TEST_VERSIONEN_META = 'stride-test-versionen';

export function listeBisVersion(liste: readonly Versionseintrag[], grenze: string): readonly Versionseintrag[] {
  return liste.filter((eintrag) => eintrag.version === grenze || versionKleiner(eintrag.version, grenze));
}

export function versionAusMeta(inhalt: string | null | undefined): string | null {
  const text = inhalt?.trim() ?? '';
  return istVersionsnummer(text) ? text : null;
}

export function anzeigeFuer(
  fest: string | null,
  liste: readonly Versionseintrag[],
  aktuell: string,
): { version: string; liste: readonly Versionseintrag[] } {
  if (fest === null) {
    return { version: aktuell, liste };
  }
  return { version: fest, liste: listeBisVersion(liste, fest) };
}
