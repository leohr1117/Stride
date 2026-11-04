import { Swords } from 'lucide-react';
import type { CSSProperties } from 'react';

const GROESSE = 36;
const STROKE = 2.5;
const RADIUS = (GROESSE - STROKE) / 2;
const UMFANG = 2 * Math.PI * RADIUS;
const RASTER = 24;
const ZEILEN_SYMBOL = 20;
const KLEIN_RING = 20;
const ABSTAND_ZUM_RAND = 2.25;
const SCHWERT_ECKE = 9 * Math.SQRT2;
const ZEILEN_STRICH = 2;
const HALB_STRICH = (ZEILEN_STRICH * ZEILEN_SYMBOL) / RASTER / 2;
const KLEIN_KLINGE = ((KLEIN_RING / 2 - ABSTAND_ZUM_RAND - HALB_STRICH) * RASTER) / SCHWERT_ECKE;
const KLEIN_FAKTOR = ZEILEN_SYMBOL / KLEIN_KLINGE;

/** Ring aus der Zeit bis zur Deadline. Erwacht: geschlossen, Schwert in der Mitte. */
export function BossRing({
  ring,
  erwacht,
  ton = 'gefahr',
  klein = false,
}: {
  ring: number;
  erwacht: boolean;
  ton?: 'gefahr' | 'haupt';
  klein?: boolean;
}) {
  const anteil = Math.min(1, Math.max(0, ring));
  const offset = UMFANG * (1 - anteil);
  const mitte = GROESSE / 2;
  const strich = ton === 'haupt' ? 'var(--haupt)' : 'var(--gefahr)';
  const klinge = ton === 'haupt' ? 'text-haupt' : 'text-gefahr';
  const kasten = klein ? 'size-5' : 'size-9';
  const klingeKlasse = klein ? 'absolute' : 'absolute size-3.5';
  const klingeStil: CSSProperties | undefined = klein
    ? {
        width: KLEIN_KLINGE,
        height: KLEIN_KLINGE,
        strokeWidth: `calc(var(--zeilen-strich, ${ZEILEN_STRICH}) * ${KLEIN_FAKTOR})`,
      }
    : undefined;

  return (
    <span className={`relative inline-flex ${kasten} shrink-0 items-center justify-center`}>
      <svg viewBox={`0 0 ${GROESSE} ${GROESSE}`} className={`${kasten} -rotate-90`} aria-hidden>
        <circle cx={mitte} cy={mitte} r={RADIUS} fill="none" stroke={strich} strokeOpacity={0.25} strokeWidth={STROKE} />
        <circle
          cx={mitte}
          cy={mitte}
          r={RADIUS}
          fill="none"
          stroke={strich}
          strokeWidth={STROKE}
          strokeDasharray={UMFANG}
          strokeDashoffset={offset}
          className="bossring-bogen"
        />
      </svg>
      {erwacht && <Swords className={`${klingeKlasse} ${klinge}`} style={klingeStil} aria-hidden />}
    </span>
  );
}
