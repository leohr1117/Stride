import { Swords } from 'lucide-react';

const GROESSE = 36;
const STROKE = 2.5;
const RADIUS = (GROESSE - STROKE) / 2;
const UMFANG = 2 * Math.PI * RADIUS;

/** Ring aus der Zeit bis zur Deadline. Erwacht: geschlossen, Schwert in der Mitte. */
export function BossRing({
  ring,
  erwacht,
  ton = 'gefahr',
}: {
  ring: number;
  erwacht: boolean;
  ton?: 'gefahr' | 'haupt';
}) {
  const anteil = Math.min(1, Math.max(0, ring));
  const offset = UMFANG * (1 - anteil);
  const mitte = GROESSE / 2;
  const strich = ton === 'haupt' ? 'var(--haupt)' : 'var(--gefahr)';
  const klinge = ton === 'haupt' ? 'text-haupt' : 'text-gefahr';

  return (
    <span className="relative inline-flex size-9 shrink-0 items-center justify-center">
      <svg viewBox={`0 0 ${GROESSE} ${GROESSE}`} className="size-9 -rotate-90" aria-hidden>
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
      {erwacht && <Swords className={`absolute size-3.5 ${klinge}`} aria-hidden />}
    </span>
  );
}
