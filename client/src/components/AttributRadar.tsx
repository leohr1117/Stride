import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { Attribut } from '../../../shared/api/index.ts';
import type { AttributTyp } from '../../../shared/spiel/begriffe.ts';
import { MIN_RADAR_ACHSEN, radarMaximum, radarWert } from '../../../shared/spiel/radar.ts';
import { zahl } from '../format.ts';
import { tx } from '../text.ts';
import { DIAGRAMM_ANIMATION_MS, DiagrammTooltip } from './DiagrammBasis.tsx';

export function AttributRadar({ typ, werte }: { typ: AttributTyp; werte: Attribut[] }) {
  if (werte.length < MIN_RADAR_ACHSEN) {
    return null;
  }
  const radarDaten = werte.map((attribut) => ({ name: attribut.name, wert: radarWert(attribut.level) }));
  const radarRand = radarMaximum(werte.map((attribut) => attribut.level));
  const farbe = typ === 'status' ? 'var(--xp)' : 'var(--akzent)';

  return (
    <div data-spektrum={typ} data-achsen-max={radarRand} data-werte={radarDaten.map((eintrag) => eintrag.wert).join(',')}>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarDaten} outerRadius="70%">
            <PolarGrid stroke="var(--rand)" />
            <PolarAngleAxis dataKey="name" tick={{ fill: 'var(--leise)', fontSize: 12 }} />
            <PolarRadiusAxis type="number" domain={[0, radarRand]} allowDataOverflow niceTicks="none" tick={false} axisLine={false} />
            <Radar animationDuration={DIAGRAMM_ANIMATION_MS} dataKey="wert" stroke={farbe} fill={farbe} fillOpacity={0.25} />
            <Tooltip
              content={(eigenschaften) => {
                const punkt = eigenschaften.payload?.[0]?.payload as (typeof radarDaten)[number] | undefined;
                if (!eigenschaften.active || !punkt) {
                  return null;
                }
                return <DiagrammTooltip titel={punkt.name} zeilen={[{ wert: tx('Lvl {level}', { level: zahl(punkt.wert) }) }]} />;
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center text-xs text-leise">{tx('Lvl {level}', { level: zahl(radarRand) })}</p>
    </div>
  );
}
