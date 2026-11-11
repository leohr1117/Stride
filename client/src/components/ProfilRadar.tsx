import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import { duZeichenwert } from '../../../shared/spiel/radar.ts';
import { vorbildLevelSichtbar } from '../features/vorbilder/vorbildTeile.tsx';
import { levelZahl } from '../format.ts';
import { tx } from '../text.ts';
import { DIAGRAMM_ANIMATION_MS, DiagrammTooltip } from './DiagrammBasis.tsx';

export interface RadarZeile {
  name: string;
  du: number;
  vorbild: number;
  unsicher?: boolean;
}

function vorbildPunkt(props: { cx?: number; cy?: number; payload?: { unsicher?: boolean } }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) {
    return <g />;
  }
  const unsicher = payload?.unsicher === true;
  return (
    <circle
      className="recharts-radar-dot"
      data-vorbild-punkt={unsicher ? 'hohl' : 'voll'}
      cx={cx}
      cy={cy}
      r={3}
      aria-hidden="true"
      fill={unsicher ? 'var(--flaeche)' : 'var(--diagramm-vorbild)'}
      stroke="var(--diagramm-vorbild)"
      strokeWidth={unsicher ? 1.5 : 0}
    />
  );
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
  let duMax = 0;
  for (const zeile of zeilen) {
    if (zeile.du > duMax) {
      duMax = zeile.du;
    }
  }
  const gezeichnet = zeilen.map((zeile) => ({
    ...zeile,
    duZeichnung: duZeichenwert(zeile.du, duMax, maximum),
  }));
  const duRing = maximum > 0 ? duZeichenwert(duMax, duMax, maximum) / maximum : 0;

  return (
    <div data-radar="vergleich" data-du-ring={duRing}>
      <div className={hoehe}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={gezeichnet} outerRadius="68%">
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
              dot={vorbildPunkt}
              activeDot={vorbildPunkt}
            />
            <Radar
              className="radar-du"
              animationDuration={DIAGRAMM_ANIMATION_MS}
              dataKey="duZeichnung"
              stroke="var(--akzent)"
              strokeWidth={2.5}
              fill="var(--akzent)"
              fillOpacity={0.42}
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
                      { wert: tx('Lvl {level}', { level: levelZahl(punkt.du) }), name: tx('Du') },
                      {
                        wert: vorbildLevelSichtbar(levelZahl(punkt.vorbild), punkt.unsicher === true),
                        name: person,
                        leise: punkt.unsicher === true,
                      },
                    ]}
                  />
                );
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center text-xs text-leise">{tx('Lvl {level}', { level: levelZahl(maximum) })}</p>
    </div>
  );
}
