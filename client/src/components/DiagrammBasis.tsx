import type { ReactNode } from 'react';
import { KurzListe } from './Ausklappbar.tsx';

export const DIAGRAMM_ANIMATION_MS = 450;

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
    <div className="max-w-60 rounded-xl border border-rand bg-flaeche px-3 py-2 text-xs shadow-lg">
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
          <div className="h-2 overflow-hidden rounded-full bg-flaeche-2">
            {eintrag.wert > 0 && maximum > 0 && (
              <div
                className="h-full rounded-full"
                style={{ width: `${(eintrag.wert / maximum) * 100}%`, backgroundColor: eintrag.farbe ?? farbe }}
              />
            )}
          </div>
        </div>
      )}
    />
  );
}
