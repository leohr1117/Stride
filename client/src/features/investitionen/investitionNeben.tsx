import type { Attribut, Investition, InvestitionsZiel, Projekt, Vision } from '../../../../shared/api/index.ts';
import { bonusProzent } from '../../format.ts';

export function zielText(ziel: InvestitionsZiel | null, visionen: Vision[], projekte: Projekt[], attribute: Attribut[]): string | null {
  if (!ziel) {
    return null;
  }
  if (ziel.art === 'vision') {
    return visionen.find((vision) => vision.id === ziel.id)?.titel ?? null;
  }
  if (ziel.art === 'projekt') {
    return projekte.find((projekt) => projekt.id === ziel.id)?.name ?? null;
  }
  return attribute.find((attribut) => attribut.id === ziel.id)?.name ?? null;
}

export function nebenDerInvestition(investition: Investition) {
  return (
    <span data-investition-neben="">
      <span>{bonusProzent(investition.bonus)}</span>
    </span>
  );
}
