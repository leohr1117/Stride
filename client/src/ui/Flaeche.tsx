import type { ReactNode } from 'react';

/** Fläche ohne eigenen Ausbruch. Liegt in einem FlaechenRahmen. */
export const FLAECHE_INNEN = 'liste bg-flaeche md:overflow-hidden md:rounded-lg md:border md:border-rand';

/** Handy: bricht aus dem Seitenrand aus. PC: höchstens 720 px. */
export const FLAECHEN_RAHMEN = '-mx-4 md:mx-0 md:max-w-[720px]';

/** Handy: volle Breite, ohne Rahmen und ohne Radius. PC: 8 px Radius und 1 px Rand. */
export const FLAECHE_KLASSE = `${FLAECHE_INNEN} ${FLAECHEN_RAHMEN}`;

export function Flaeche({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div data-flaeche="" className={`${FLAECHE_KLASSE} ${className}`}>
      {children}
    </div>
  );
}

export function FlaecheInnen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div data-flaeche="" className={`${FLAECHE_INNEN} ${className}`}>
      {children}
    </div>
  );
}

export function FlaechenRahmen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${FLAECHEN_RAHMEN} ${className}`}>{children}</div>;
}
