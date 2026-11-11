import type { Attribut, InvestitionsZiel, Projekt, Vision } from '../../../../shared/api/index.ts';
import { levelZahl, zahl } from '../../format.ts';
import { tx } from '../../text.ts';
import { kurveFuerTyp, levelDanach } from './zahlungAnzeige.ts';

export function zielName(ziel: InvestitionsZiel | null, visionen: Vision[], projekte: Projekt[], attribute: Attribut[]): string {
  if (!ziel) {
    return tx('Keins');
  }
  if (ziel.art === 'vision') {
    return visionen.find((vision) => vision.id === ziel.id)?.titel ?? tx('Keins');
  }
  if (ziel.art === 'projekt') {
    return projekte.find((eintrag) => eintrag.id === ziel.id)?.name ?? tx('Keins');
  }
  return attribute.find((eintrag) => eintrag.id === ziel.id)?.name ?? tx('Keins');
}

export function fassung(angaben: {
  bezahltId: number | null;
  betragZahl: number | null;
  zahlText: string;
  attributText: string | null;
  projektText: string | null;
  xpNeu: number | null;
  xpJetzt: number;
  kurve: ReturnType<typeof kurveFuerTyp>;
}): string {
  const kostenlos = angaben.bezahltId === null || angaben.betragZahl === 0;
  const betragZahl = angaben.betragZahl;
  const hatBetrag = betragZahl !== null && betragZahl > 0;
  const { attributText, projektText } = angaben;
  let basis = '';
  if (attributText && projektText) {
    basis = kostenlos
      ? tx('Kostenlos · Bonus für {name} und {ziel}', { name: attributText, ziel: projektText })
      : hatBetrag
        ? tx('Kostet {xp} XP aus {name} · Bonus für {bonus} und {ziel}', {
            xp: zahl(betragZahl ?? 0),
            name: angaben.zahlText,
            bonus: attributText,
            ziel: projektText,
          })
        : tx('Bonus für {name} und {ziel}', { name: attributText, ziel: projektText });
  } else if (attributText || projektText) {
    const name = attributText ?? projektText ?? '';
    basis = kostenlos
      ? tx('Kostenlos · Bonus für {name}', { name })
      : hatBetrag
        ? tx('Kostet {xp} XP aus {name} · Bonus für {bonus}', {
            xp: zahl(betragZahl ?? 0),
            name: angaben.zahlText,
            bonus: name,
          })
        : tx('Bonus für {name}', { name });
  } else if (!kostenlos && hatBetrag) {
    basis = tx('Kostet {xp} XP aus {name}', { xp: zahl(betragZahl ?? 0), name: angaben.zahlText });
  }
  if (angaben.xpNeu === null || betragZahl === null || betragZahl <= 0) {
    return basis;
  }
  const fall = levelDanach(angaben.xpJetzt, angaben.xpNeu, angaben.kurve);
  if (fall === null || basis === '') {
    return basis;
  }
  return `${basis} · ${tx('{name} fällt auf Level {level}', { name: angaben.zahlText, level: levelZahl(fall) })}`;
}
