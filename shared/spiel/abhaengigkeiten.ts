import type { Ebene, Ebenen } from './ebenen.ts';
import type { Funktion, Funktionen } from './funktionen.ts';
import type { FunktionsAttribute } from './sichtbarkeit.ts';

const ATTRIBUTE_AN: FunktionsAttribute = { disziplin: true, ressourcen: true };

/** Satz für das Info-Popup, wenn der Schalter gerade nicht umgeschaltet werden kann. */
export function funktionsSperre(
  funktion: Funktion,
  funktionen: Funktionen,
  ebenen: Ebenen,
  attribute: FunktionsAttribute = ATTRIBUTE_AN,
): string | null {
  const letzterTyp =
    (funktion === 'koennen' && funktionen.koennen && !funktionen.status) ||
    (funktion === 'status' && funktionen.status && !funktionen.koennen);
  if (letzterTyp) {
    return 'Können oder Haben muss aktiv bleiben.';
  }
  if (funktion === 'bossAngriffe' && !ebenen.vorhaben) {
    return 'Erst Vorhaben einschalten.';
  }
  if (funktion === 'bossAngriffe' && !attribute.disziplin) {
    return 'Erst Disziplin einschalten.';
  }
  if (funktion === 'ausruestung' && !attribute.ressourcen) {
    return 'Erst Ressourcen einschalten.';
  }
  if (funktion === 'verfallKoennen' && !funktionen.koennen) {
    return 'Erst Können einschalten.';
  }
  if (funktion === 'verfallHaben' && !funktionen.status) {
    return 'Erst Haben einschalten.';
  }
  return null;
}

export function ebenenSperre(ebene: Ebene, ebenen: Ebenen): string | null {
  if (ebene === 'organisationen' && !ebenen.projekte) {
    return 'Erst Projekte einschalten.';
  }
  return null;
}
