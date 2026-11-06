import type { ReactNode } from 'react';

/** Fläche. Handy: Radius 12, ohne Rand. PC: 8 px Radius und 1 px Rand. */
export const FLAECHE_INNEN = 'liste bg-flaeche rounded-[12px] md:overflow-hidden md:rounded-lg md:border md:border-rand';

/** Liegt im Seitenrand der Seite. PC: höchstens die gemeinsame Inhaltsbreite. */
export const FLAECHEN_RAHMEN = 'md:mx-0 inhalt-max';

/** Handy: 16 px Seitenrand, Radius 12, ohne Rahmen. PC: 8 px Radius und 1 px Rand. */
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
