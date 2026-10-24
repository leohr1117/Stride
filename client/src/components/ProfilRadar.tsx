import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import { zahl } from '../format.ts';
import { tx } from '../text.ts';
import { DIAGRAMM_ANIMATION_MS, DiagrammTooltip } from './DiagrammBasis.tsx';

export interface RadarZeile {
  name: string;
  du: number;
  vorbild: number;
}

/** Rohwerte in Leveln. Die Achse endet beim größten Wert, niemand wird auf 1 gezogen. */
export function ProfilRadar({
  person,
  zeilen,
  maximum,
  hoehe,
}: {
  person: string;
  zeilen: RadarZeile[];
  maximum: number;
  hoehe: string;
}) {
  return (
    <div data-radar="vergleich">
      <div className={hoehe}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={zeilen} outerRadius="68%">
            <PolarGrid stroke="var(--rand)" />
            <PolarAngleAxis dataKey="name" tick={{ fill: 'var(--leise)', fontSize: 11 }} />
            <PolarRadiusAxis type="number" domain={[0, maximum]} allowDataOverflow niceTicks="none" tick={false} axisLine={false} />
            <Radar
              animationDuration={DIAGRAMM_ANIMATION_MS}
              dataKey="vorbild"
              stroke="var(--diagramm-vorbild)"
              strokeWidth={2}
              fill="var(--diagramm-vorbild)"
              fillOpacity={0.12}
            />
            <Radar
              animationDuration={DIAGRAMM_ANIMATION_MS}
              dataKey="du"
              stroke="var(--akzent)"
              strokeWidth={2}
              fill="var(--akzent)"
              fillOpacity={0.35}
            />
            <Tooltip
              content={(eigenschaften) => {
                const punkt = eigenschaften.payload?.[0]?.payload as RadarZeile | undefined;
                if (!eigenschaften.active || !punkt) {
                  return null;
                }
                return (
                  <DiagrammTooltip
                    titel={punkt.name}
                    zeilen={[
                      { wert: tx('Lvl {level}', { level: zahl(punkt.du) }), name: tx('Du') },
                      { wert: tx('Lvl {level}', { level: zahl(punkt.vorbild) }), name: person },
                    ]}
                  />
                );
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center text-xs text-leise">{tx('Lvl {level}', { level: zahl(maximum) })}</p>
    </div>
  );
}
