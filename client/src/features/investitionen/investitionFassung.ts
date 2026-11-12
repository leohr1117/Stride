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

function bonusText(
  namen: string[],
  kostenlos: boolean,
  hatBetrag: boolean,
  zahlText: string,
  betragZahl: number | null,
): string {
  const [name, ziel, skill] = namen;
  if (namen.length >= 3 && name && ziel && skill) {
    return kostenlos
      ? tx('Kostenlos · Bonus für {name}, {ziel} und {skill}', { name, ziel, skill })
      : hatBetrag
        ? tx('Kostet {xp} XP aus {name} · Bonus für {bonus}, {ziel} und {skill}', {
            xp: zahl(betragZahl ?? 0),
            name: zahlText,
            bonus: name,
            ziel,
            skill,
          })
        : tx('Bonus für {name}, {ziel} und {skill}', { name, ziel, skill });
  }
  if (namen.length === 2 && name && ziel) {
    return kostenlos
      ? tx('Kostenlos · Bonus für {name} und {ziel}', { name, ziel })
      : hatBetrag
        ? tx('Kostet {xp} XP aus {name} · Bonus für {bonus} und {ziel}', {
            xp: zahl(betragZahl ?? 0),
            name: zahlText,
            bonus: name,
            ziel,
          })
        : tx('Bonus für {name} und {ziel}', { name, ziel });
  }
  if (namen.length === 1 && name) {
    return kostenlos
      ? tx('Kostenlos · Bonus für {name}', { name })
      : hatBetrag
        ? tx('Kostet {xp} XP aus {name} · Bonus für {bonus}', {
            xp: zahl(betragZahl ?? 0),
            name: zahlText,
            bonus: name,
          })
        : tx('Bonus für {name}', { name });
  }
  if (!kostenlos && hatBetrag) {
    return tx('Kostet {xp} XP aus {name}', { xp: zahl(betragZahl ?? 0), name: zahlText });
  }
  return '';
}

export function fassung(angaben: {
  bezahltId: number | null;
  betragZahl: number | null;
  zahlText: string;
  attributText: string | null;
  projektText: string | null;
  faehigkeitText: string | null;
  xpNeu: number | null;
  xpJetzt: number;
  kurve: ReturnType<typeof kurveFuerTyp>;
}): string {
  const kostenlos = angaben.bezahltId === null || angaben.betragZahl === 0;
  const betragZahl = angaben.betragZahl;
  const hatBetrag = betragZahl !== null && betragZahl > 0;
  const namen = [angaben.attributText, angaben.projektText, angaben.faehigkeitText].filter((name): name is string => name !== null && name !== '');
  const basis = bonusText(namen, kostenlos, hatBetrag, angaben.zahlText, betragZahl);
  if (angaben.xpNeu === null || betragZahl === null || betragZahl <= 0) {
    return basis;
  }
  const fall = levelDanach(angaben.xpJetzt, angaben.xpNeu, angaben.kurve);
  if (fall === null || basis === '') {
    return basis;
  }
  return `${basis} · ${tx('{name} fällt auf Level {level}', { name: angaben.zahlText, level: levelZahl(fall) })}`;
}
