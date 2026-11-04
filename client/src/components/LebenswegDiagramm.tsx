import { tx, txMenge } from '../text.ts';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ALTERS_MARKEN } from '../../../shared/features/vorbilder/vorbilder.ts';
import { kompakt, levelZahl } from '../format.ts';
import { DIAGRAMM_ANIMATION_MS, DiagrammTooltip } from './DiagrammBasis.tsx';

const RENTE = 67;
const LEBENSERWARTUNG = 80;

export interface LebenswegPunkt {
  alter: number;
  ereignis?: string;
  vorbild?: number;
  durchschnitt?: number;
  du?: number;
}

export function LebenswegDiagramm({ daten, name }: { daten: LebenswegPunkt[]; name: string }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={daten} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--rand)" />
          <XAxis
            dataKey="alter"
            type="number"
            domain={[ALTERS_MARKEN[0].alter, 'dataMax']}
            ticks={ALTERS_MARKEN.map((marke) => marke.alter)}
            tickLine={false}
            axisLine={{ stroke: 'var(--rand)' }}
            tick={{ fill: 'var(--leise)', fontSize: 11 }}
          />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--leise)', fontSize: 11 }} tickFormatter={kompakt} width={40} />
          <ReferenceLine x={RENTE} stroke="var(--rand)" label={{ value: tx("Rente"), position: 'insideTopRight', fill: 'var(--leise)', fontSize: 10 }} />
          <ReferenceLine
            x={LEBENSERWARTUNG}
            stroke="var(--rand)"
            label={{ value: tx("Lebenserwartung"), position: 'insideBottomRight', fill: 'var(--leise)', fontSize: 10 }}
          />
          <Tooltip
            cursor={{ stroke: 'var(--leise)', strokeWidth: 1 }}
            content={(eigenschaften) => {
              const punkt = eigenschaften.payload?.[0]?.payload as LebenswegPunkt | undefined;
              if (!eigenschaften.active || !punkt) {
                return null;
              }
              const zeilen = [
                ...(punkt.vorbild !== undefined ? [{ wert: `Lvl ${levelZahl(punkt.vorbild)}`, name }] : []),
                ...(punkt.durchschnitt !== undefined ? [{ wert: `Lvl ${levelZahl(punkt.durchschnitt)}`, name: tx("Durchschnitt") }] : []),
                ...(punkt.du !== undefined ? [{ wert: `Lvl ${levelZahl(punkt.du)}`, name: tx('Du') }] : []),
              ];
              return (
                <DiagrammTooltip
                  titel={txMenge(punkt.alter, 'Mit {alter} Jahren', { alter: punkt.alter })}
                  untertitel={punkt.ereignis ? tx(punkt.ereignis) : undefined}
                  zeilen={zeilen}
                />
              );
            }}
          />
          <Line animationDuration={DIAGRAMM_ANIMATION_MS} type="monotone" dataKey="durchschnitt" stroke="var(--leise)" strokeWidth={2} dot={false} connectNulls />
          <Line
            animationDuration={DIAGRAMM_ANIMATION_MS}
            type="monotone"
            dataKey="vorbild"
            stroke="var(--diagramm-vorbild)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--diagramm-vorbild)', stroke: 'var(--flaeche)', strokeWidth: 2 }}
            connectNulls
          />
          <Line
            animationDuration={DIAGRAMM_ANIMATION_MS}
            dataKey="du"
            stroke="none"
            dot={{ r: 5, fill: 'var(--akzent)', stroke: 'var(--flaeche)', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: 'var(--akzent)', stroke: 'var(--flaeche)', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
