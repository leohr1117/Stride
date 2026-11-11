import { type ReactNode } from 'react';
import type { Attribut, Investition, InvestitionsZiel, Projekt, Vision } from '../../../../shared/api/index.ts';
import { Icon } from '../../components/Icons.tsx';
import { bonusProzent } from '../../format.ts';
import { attributName } from '../../text.ts';

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

function zielMarke(art: 'vision' | 'projekt', name: string) {
  const icon = art === 'vision' ? 'flag' : 'target';
  return (
    <span data-ziel={art} data-icon={icon}>
      <Icon name={icon} className="me-1 inline-block size-3.5 align-middle" aria-hidden="true" />
      <span>{name}</span>
    </span>
  );
}

export function nebenDerInvestition(
  investition: Investition,
  visionen: Vision[],
  projekte: Projekt[],
  attribute: Attribut[],
) {
  const teile: ReactNode[] = [<span key="bonus">{bonusProzent(investition.bonus)}</span>];
  const trenner = (key: string) => (
    <span key={key} aria-hidden="true">
      {' · '}
    </span>
  );
  if (investition.attributId !== null) {
    const eintrag = attribute.find((attribut) => attribut.id === investition.attributId);
    const name = eintrag ? attributName(eintrag) : investition.attributName;
    if (name) {
      teile.push(trenner('attribut'), <span key="attribut">{name}</span>);
    }
  }
  const ziel = investition.ziel;
  if (ziel?.art === 'vision' || ziel?.art === 'projekt') {
    const name = investition.zielName ?? zielText(ziel, visionen, projekte, attribute);
    if (name) {
      teile.push(trenner('ziel'), zielMarke(ziel.art, name));
    }
  } else if (ziel?.art === 'attribut') {
    const eintrag = attribute.find((attribut) => attribut.id === ziel.id);
    const name = eintrag ? attributName(eintrag) : investition.zielName;
    if (name) {
      teile.push(trenner('zweit'), <span key="zweit">{name}</span>);
    }
  }
  return <span data-investition-neben="">{teile}</span>;
}
