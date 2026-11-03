import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Fortschrittsbalken } from '../ui/index.ts';
import { KurzListe } from './Ausklappbar.tsx';

export const DIAGRAMM_ANIMATION_MS = 450;

const HINWEIS_RAND = 8;

export function FestImBild({
  coordinate,
  rahmen,
  children,
}: {
  coordinate?: { x?: number; y?: number };
  rahmen: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const selbst = useRef<HTMLDivElement>(null);
  const [stil, setStil] = useState<CSSProperties>({ position: 'fixed', left: 0, top: 0, visibility: 'hidden' });
  const x = coordinate?.x;
  const y = coordinate?.y;
  useLayoutEffect(() => {
    const kasten = selbst.current?.getBoundingClientRect();
    const flaeche = rahmen.current?.querySelector('.recharts-wrapper')?.getBoundingClientRect() ?? rahmen.current?.getBoundingClientRect();
    if (!kasten || !flaeche || x == null || y == null) {
      return;
    }
    const breite = document.documentElement.clientWidth;
    const hoehe = window.innerHeight;
    let links = flaeche.left + x + 12;
    let oben = flaeche.top + y + 12;
    if (links + kasten.width > breite - HINWEIS_RAND) {
      links = breite - HINWEIS_RAND - kasten.width;
    }
    if (links < HINWEIS_RAND) {
      links = HINWEIS_RAND;
    }
    if (oben + kasten.height > hoehe - HINWEIS_RAND) {
      oben = flaeche.top + y - kasten.height - 12;
    }
    if (oben < HINWEIS_RAND) {
      oben = HINWEIS_RAND;
    }
    setStil({
      position: 'fixed',
      left: links,
      top: oben,
      visibility: 'visible',
      zIndex: 40,
      pointerEvents: 'none',
      maxWidth: breite - HINWEIS_RAND * 2,
    });
  }, [rahmen, x, y, children]);
  return (
    <div ref={selbst} style={stil}>
      {children}
    </div>
  );
}

export function DiagrammTooltip({
  titel,
  untertitel,
  zeilen,
}: {
  titel: string;
  untertitel?: string;
  zeilen: { wert: string; name?: string }[];
}) {
  return (
    <div data-diagramm-hinweis="" className="max-w-60 rounded-xl border border-rand bg-flaeche px-3 py-2 text-xs shadow-lg break-words">
      <p className="mb-0.5 text-leise">{titel}</p>
      {untertitel && <p className="mb-1 font-medium text-haupt">{untertitel}</p>}
      {zeilen.map((zeile, index) => (
        <p key={index} className="zahl">
          <span className="font-semibold text-haupt">{zeile.wert}</span>
          {zeile.name && <span className="text-leise"> {zeile.name}</span>}
        </p>
      ))}
    </div>
  );
}

export interface SaeulenWert {
  label: string;
  titel: string;
  wert: number;
}

export interface BalkenWert {
  schluessel: string | number;
  label: ReactNode;
  wert: number;
  text: string;
  farbe?: string;
}

const BALKEN_SICHTBAR = 6;

export function BalkenListe({ werte, farbe = 'var(--akzent)' }: { werte: BalkenWert[]; farbe?: string }) {
  let maximum = 0;
  for (const eintrag of werte) {
    maximum = Math.max(maximum, eintrag.wert);
  }
  return (
    <KurzListe
      eintraege={werte}
      anzahl={BALKEN_SICHTBAR}
      className="space-y-3"
      darstellen={(eintrag) => (
        <div key={eintrag.schluessel} className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">{eintrag.label}</span>
            <span className={`zahl shrink-0 text-xs ${eintrag.wert < 0 ? 'text-gefahr' : 'text-leise'}`}>{eintrag.text}</span>
          </div>
          <Fortschrittsbalken
            anteil={eintrag.wert > 0 && maximum > 0 ? eintrag.wert / maximum : 0}
            farbe={eintrag.farbe ?? farbe}
            bewegt={false}
          />
        </div>
      )}
    />
  );
}
