import type { BestaetigungsAnfrage } from './components/Bestaetigung.tsx';
import { tx } from './text.ts';

type Bestaetigen = (anfrage: BestaetigungsAnfrage) => Promise<boolean>;

/** Eine Warnung, wenn Ausblenden Daten versteckt. Ohne Hinweis geht es sofort weiter. */
export function bestaetigeAusblenden(bestaetigen: Bestaetigen, hinweis: string | null): Promise<boolean> {
  if (!hinweis) {
    return Promise.resolve(true);
  }
  return bestaetigen({
    titel: tx('Ebenen ausblenden?'),
    text: hinweis,
    knopf: tx('Ausblenden'),
    gefahr: true,
  });
}
