import { ZIEL_MARKE, type Ebene } from '../../../shared/spiel/ebenen.ts';
import { tx } from '../text.ts';

export function ZielMarke({ ebene, mehrzahl = false }: { ebene: Ebene; mehrzahl?: boolean }) {
  const marke = ZIEL_MARKE[ebene];
  return <span>{tx(mehrzahl ? marke.mehrzahl : marke.name)}</span>;
}
