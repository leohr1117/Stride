import { useRef } from 'react';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { Attribut } from '../../../shared/api/index.ts';
import type { AttributTyp } from '../../../shared/spiel/begriffe.ts';
import { MIN_RADAR_ACHSEN, radarMaximum, radarWert } from '../../../shared/spiel/radar.ts';
import { levelZahl } from '../format.ts';
import { attributName, tx } from '../text.ts';
import { DIAGRAMM_ANIMATION_MS, DiagrammTooltip, FestImBild } from './DiagrammBasis.tsx';

export function AttributRadar({
  typ,
  werte,
  kompakt = false,
}: {
  typ: AttributTyp;
  werte: Attribut[];
  /** Kleine Form für die Profilzeile. Die Seiten Können und Haben bleiben bei der großen Form. */
  kompakt?: boolean;
}) {
  const rahmen = useRef<HTMLDivElement>(null);
  if (werte.length < MIN_RADAR_ACHSEN) {
    return null;
  }
  const radarDaten = werte.map((attribut) => ({ name: attributName(attribut), wert: radarWert(attribut.level) }));
  const radarRand = radarMaximum(werte.map((attribut) => attribut.level));
  const farbe = 'var(--fortschritt)';

  return (
    <div ref={rahmen} data-spektrum={typ} data-achsen-max={radarRand} data-werte={radarDaten.map((eintrag) => eintrag.wert).join(',')}>
      <div className={`w-full min-w-0 overflow-hidden ${kompakt ? 'h-32' : 'h-56'}`}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarDaten} outerRadius={kompakt ? '78%' : '70%'}>
            <PolarGrid stroke="var(--trenner)" />
            <PolarAngleAxis dataKey="name" tick={kompakt ? false : { fill: 'var(--leise)', fontSize: 13 }} />
            <PolarRadiusAxis type="number" domain={[0, radarRand]} allowDataOverflow niceTicks="none" tick={false} axisLine={false} />
            <Radar
              animationDuration={DIAGRAMM_ANIMATION_MS}
              dataKey="wert"
              stroke={farbe}
              strokeWidth={2}
              fill={farbe}
              fillOpacity={0.16}
            />
            <Tooltip
              portal={typeof document === 'undefined' ? undefined : document.body}
              wrapperStyle={{ position: 'fixed', width: 0, height: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 40 }}
              content={(eigenschaften) => {
                const punkt = eigenschaften.payload?.[0]?.payload as (typeof radarDaten)[number] | undefined;
                if (!eigenschaften.active || !punkt) {
                  return null;
                }
                return (
                  <FestImBild coordinate={eigenschaften.coordinate} rahmen={rahmen}>
                    <DiagrammTooltip titel={punkt.name} zeilen={[{ wert: tx('Lvl {level}', { level: levelZahl(punkt.wert) }) }]} />
                  </FestImBild>
                );
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center text-xs text-leise">{tx('Außen: Lvl {level}', { level: levelZahl(radarRand) })}</p>
    </div>
  );
}
