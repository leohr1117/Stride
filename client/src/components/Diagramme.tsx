import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { kompakt, zahl } from '../format.ts';
import { xIntervall, yAchse } from './achsen.ts';
import { DIAGRAMM_ANIMATION_MS, DiagrammTooltip, type SaeulenWert } from './DiagrammBasis.tsx';

const ACHSEN_TEXT = { fill: 'var(--leise)', fontSize: 11 };

function achse(werte: SaeulenWert[]) {
  return yAchse(werte.map((eintrag) => eintrag.wert));
}

export function SaeulenDiagramm({ werte, einheit }: { werte: SaeulenWert[]; einheit: string }) {
  const y = achse(werte);
  return (
    <div className="h-56" data-achsen={y.ticks.join(' ')}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={werte} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--rand)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: 'var(--rand)' }}
            tick={ACHSEN_TEXT}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            domain={y.domain}
            ticks={y.ticks}
            tickLine={false}
            axisLine={false}
            tick={ACHSEN_TEXT}
            tickFormatter={kompakt}
            allowDecimals={false}
            width={40}
          />
          <Tooltip
            cursor={{ fill: 'var(--flaeche-2)' }}
            content={(eigenschaften) => {
              const eintrag = eigenschaften.payload?.[0]?.payload as SaeulenWert | undefined;
              if (!eigenschaften.active || !eintrag) {
                return null;
              }
              return <DiagrammTooltip titel={eintrag.titel} zeilen={[{ wert: `${zahl(eintrag.wert)} ${einheit}` }]} />;
            }}
          />
          <Bar animationDuration={DIAGRAMM_ANIMATION_MS} dataKey="wert" fill="var(--akzent)" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LinienDiagramm({
  werte,
  einheit,
  jedeZweiteBeschriftung = false,
}: {
  werte: SaeulenWert[];
  einheit: string;
  jedeZweiteBeschriftung?: boolean;
}) {
  const y = achse(werte);
  return (
    <div className="h-56" data-achsen={y.ticks.join(' ')}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={werte} margin={{ top: 8, right: jedeZweiteBeschriftung ? 28 : 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="verlaufFlaeche" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--akzent)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--akzent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--rand)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: 'var(--rand)' }}
            tick={ACHSEN_TEXT}
            interval={xIntervall(jedeZweiteBeschriftung)}
            minTickGap={jedeZweiteBeschriftung ? 0 : 16}
          />
          <YAxis
            domain={y.domain}
            ticks={y.ticks}
            tickLine={false}
            axisLine={false}
            tick={ACHSEN_TEXT}
            tickFormatter={kompakt}
            allowDecimals={false}
            width={40}
          />
          <Tooltip
            cursor={{ stroke: 'var(--leise)', strokeWidth: 1 }}
            content={(eigenschaften) => {
              const eintrag = eigenschaften.payload?.[0]?.payload as SaeulenWert | undefined;
              if (!eigenschaften.active || !eintrag) {
                return null;
              }
              return <DiagrammTooltip titel={eintrag.titel} zeilen={[{ wert: `${zahl(eintrag.wert)} ${einheit}` }]} />;
            }}
          />
          <Area
            animationDuration={DIAGRAMM_ANIMATION_MS}
            type="monotone"
            dataKey="wert"
            stroke="var(--akzent)"
            strokeWidth={2}
            fill="url(#verlaufFlaeche)"
            dot={false}
            activeDot={{ r: 4, stroke: 'var(--flaeche)', strokeWidth: 2, fill: 'var(--akzent)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}