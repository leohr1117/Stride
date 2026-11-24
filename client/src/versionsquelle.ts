import { anzeigeFuer, TEST_VERSIONEN_META, versionAusMeta } from '../../e2e/versionsquelle.ts';
import { AKTUELLE_VERSION, VERSIONEN, type Versionseintrag } from '../../shared/versionen.ts';

function festeTestversion(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const inhalt = document.querySelector(`meta[name="${TEST_VERSIONEN_META}"]`)?.getAttribute('content');
  return versionAusMeta(inhalt);
}

export function versionsAnzeige(): { version: string; liste: readonly Versionseintrag[] } {
  return anzeigeFuer(festeTestversion(), VERSIONEN, AKTUELLE_VERSION);
}
