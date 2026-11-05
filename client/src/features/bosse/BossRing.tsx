import { Swords } from 'lucide-react';
import type { CSSProperties } from 'react';

/** Zweizeilige Boss-Zeile. Kreis = 0,56 der Zeilenhöhe, auf eine gerade Zahl gerundet. */
const BOSS_ZEILENHOEHE = 64;
const KREIS_ANTEIL = 0.56;
const ZEILEN_RAND = 16;
const ZEILEN_ABSTAND = 12;
const BOSS_PLATZ = 40;

export function bossRingDurchmesser(zeilenhoehe = BOSS_ZEILENHOEHE): number {
  return Math.round((KREIS_ANTEIL * zeilenhoehe) / 2) * 2;
}

export const BOSS_RING_D = bossRingDurchmesser();

/** Trennlinie beginnt hinter dem Platz und dem Abstand. */
export function bossListenEinzug(platz = BOSS_PLATZ): string {
  return `${ZEILEN_RAND + platz + ZEILEN_ABSTAND}px`;
}

/** Ring aus der Zeit bis zur Deadline. Erwacht: geschlossen, Schwert in der Mitte. */
export function BossRing({ ring, erwacht }: { ring: number; erwacht: boolean }) {
  const anteil = Math.min(1, Math.max(0, ring));
  const voll = anteil >= 1 || erwacht;
  const stil = { '--ring-d': `${BOSS_RING_D}px` } as CSSProperties;

  return (
    <span className="boss-platz">
      <span className="boss-ring" style={stil} data-boss-ring="">
        <svg className="boss-ring-bild -rotate-90" aria-hidden="true">
          {voll ? (
            <circle className="bossring-bogen boss-ring-voll" />
          ) : (
            <>
              <circle className="boss-ring-spur" pathLength={100} />
              <circle
                className="bossring-bogen"
                pathLength={100}
                strokeDasharray={100}
                strokeDashoffset={100 * (1 - anteil)}
              />
            </>
          )}
        </svg>
        {erwacht ? (
          <span className="boss-ring-symbol" aria-hidden="true">
            <Swords
              className="boss-symbol text-gefahr"
              style={{ strokeWidth: 'var(--ring-strich)', vectorEffect: 'non-scaling-stroke' }}
            />
          </span>
        ) : null}
      </span>
    </span>
  );
}
