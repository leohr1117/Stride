import { motion } from 'framer-motion';
import { useId, type ReactNode } from 'react';
import { prozentPunkte } from '../format.ts';
import { attributName, tx } from '../text.ts';
import { ZuNiedrigHinweis } from './Info.tsx';

export function XpAbzug({ prozent }: { prozent: number }) {
  return (
    <span data-abzug="ziel" className="zahl shrink-0 text-xs font-medium whitespace-nowrap text-gefahr">
      −{prozentPunkte(prozent)} XP
    </span>
  );
}

export function AllgemeinerXpAbzug({ prozent }: { prozent: number | null }) {
  if (prozent === null) {
    return null;
  }
  return (
    <span data-abzug="allgemein" className="inline-flex shrink-0">
      <XpAbzug prozent={prozent} />
    </span>
  );
}

export function AttributBezeichnung({
  name,
  kennung,
  ursache,
  prozent,
  schrift = 'text-sm',
}: {
  name: string;
  kennung?: string | null;
  ursache: boolean;
  prozent: number | null;
  schrift?: string;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1">
      <span className={`min-w-0 break-words ${schrift}`}>{attributName({ name, kennung })}</span>
      {ursache ? <ZuNiedrigHinweis /> : null}
      {prozent !== null ? <XpAbzug prozent={prozent} /> : null}
    </span>
  );
}

/** Farbe von Vision und Organisation: 10 px vor dem Namen, nicht als Linie oder Balken. */
export function Farbpunkt({ farbe }: { farbe: string }) {
  return (
    <span data-farbpunkt="" aria-hidden className="inline-block size-[10px] shrink-0 rounded-full" style={{ backgroundColor: farbe }} />
  );
}

export function archivBeschriftung(offen: boolean, anzahl?: number): string {
  if (offen) {
    return tx("Archiv ausblenden");
  }
  return anzahl === undefined ? tx("Archiv anzeigen") : tx("Archiv anzeigen ({anzahl})", { anzahl });
}

export function Karte({
  children,
  className = '',
  dicht = false,
  label,
}: {
  children: ReactNode;
  className?: string;
  dicht?: boolean;
  label?: string;
}) {
  return (
    <section aria-label={label} className={`karte rounded-2xl border border-rand bg-flaeche ${dicht ? '' : 'p-4'} ${className}`}>
      {children}
    </section>
  );
}

export function Ueberschrift({ titel, aktion }: { titel: string; aktion?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <h2 className="ueberschrift min-w-0 text-sm font-semibold tracking-wide text-leise uppercase">{titel}</h2>
      {aktion ? <div className="shrink-0">{aktion}</div> : null}
    </div>
  );
}

function meldungstext(text: string): string {
  const direkt = tx(text);
  if (direkt !== text) {
    return direkt;
  }
  const suffix = text.match(/^(.*) \(([A-Za-z_][A-Za-z0-9_.]*)\)$/);
  const kern = suffix?.[1];
  if (!kern) {
    return text;
  }
  const uebersetzt = tx(kern);
  return uebersetzt === kern ? text : `${uebersetzt} (${suffix[2]})`;
}

export function Fehlermeldung({ fehler }: { fehler: unknown }) {
  if (!fehler) {
    return null;
  }
  const text = fehler instanceof Error ? meldungstext(fehler.message) : tx('Etwas ist schiefgelaufen.');
  return <p className="rounded-xl bg-gefahr/10 px-3 py-2 text-sm break-words text-gefahr">{text}</p>;
}

export function Ladeanzeige() {
  return <div className="py-16 text-center text-sm text-leise">{tx('Lädt …')}</div>;
}

export function Fortschrittsbalken({
  anteil,
  verlustBis,
  farbe = 'var(--akzent)',
  hoehe = 'h-2',
}: {
  anteil: number;
  /** Ende des abgeschwächten Verlusts. Ohne Angabe zeigt der Balken nur den Stand. */
  verlustBis?: number;
  farbe?: string;
  hoehe?: string;
}) {
  const stand = Math.min(1, Math.max(0, anteil));
  const verlust = Math.min(1, Math.max(stand, verlustBis ?? stand));
  const zeigtVerlust = verlust - stand > 0.005;
  return (
    <div className={`balken relative w-full overflow-hidden rounded-full bg-flaeche-2 ${hoehe}`}>
      {zeigtVerlust && (
        <div
          className="balken-verlust absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${verlust * 100}%`, backgroundColor: farbe }}
        />
      )}
      <motion.div
        className="balken-fuellung relative h-full rounded-full"
        style={{ backgroundColor: farbe }}
        initial={false}
        animate={{ width: `${stand * 100}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      />
    </div>
  );
}

const RING_MITTE = 50;
const RING_RADIUS = 42;
const RING_STRICH = 8;

function ringId(roh: string, name: string): string {
  return `${name}${roh.replace(/:/g, '')}`;
}

function ringSpitze(anteil: number): { cx: number; cy: number } {
  const winkel = -Math.PI / 2 + anteil * Math.PI * 2;
  return {
    cx: RING_MITTE + Math.cos(winkel) * RING_RADIUS,
    cy: RING_MITTE + Math.sin(winkel) * RING_RADIUS,
  };
}

export function LevelRing({ level, anteil, groesse = 96 }: { level: number; anteil: number; groesse?: number }) {
  const schein = ringId(useId(), 'ringschein');
  const begrenzt = Math.min(1, Math.max(0, anteil));
  const voll = begrenzt >= 0.999;
  const spitze = ringSpitze(begrenzt);
  const endMix = Math.round(18 + begrenzt * 82);
  const startKraft = Math.round(58 + begrenzt * 18);
  // 0° im conic-gradient ist 12 Uhr, im Uhrzeigersinn. Das trifft die Spitze.
  const verlauf = `conic-gradient(from 0deg, color-mix(in srgb, var(--haupt) ${startKraft}%, transparent) 0deg, color-mix(in srgb, var(--akzent) ${endMix}%, var(--haupt)) ${begrenzt * 360}deg, transparent ${begrenzt * 360}deg)`;
  // Die Maske deckt genau den Strich (Mitte 42, Breite 8 in der 100er-Box).
  // Kein stroke-dasharray: ein kurzer Strich darin ist am Bogenanfang immer wieder aufgetaucht.
  const maske =
    'radial-gradient(farthest-side, transparent 75.2%, #000 76.4%, #000 91.6%, transparent 92.8%)';

  return (
    <div className="levelring relative shrink-0" style={{ width: groesse, height: groesse }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 overflow-visible" aria-hidden="true">
        <circle cx={RING_MITTE} cy={RING_MITTE} r={RING_RADIUS} fill="none" stroke="var(--flaeche-2)" strokeWidth={RING_STRICH} />
        {voll && (
          <circle
            cx={RING_MITTE}
            cy={RING_MITTE}
            r={RING_RADIUS}
            fill="none"
            stroke={`color-mix(in srgb, var(--akzent) ${endMix}%, var(--haupt))`}
            strokeWidth={RING_STRICH}
          />
        )}
      </svg>
      {begrenzt > 0 && !voll && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: verlauf, maskImage: maske, WebkitMaskImage: maske }}
        />
      )}
      {begrenzt > 0 && (
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
          <defs>
            <filter id={schein} x="-70%" y="-70%" width="240%" height="240%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation="1.6" />
            </filter>
          </defs>
          <circle
            className="levelring-spitze-schein"
            cx={spitze.cx}
            cy={spitze.cy}
            r="6.4"
            fill={`color-mix(in srgb, var(--akzent) ${endMix}%, var(--haupt))`}
            fillOpacity={0.45 + begrenzt * 0.5}
            filter={`url(#${schein})`}
          />
          <circle cx={spitze.cx} cy={spitze.cy} r="4.05" fill={`color-mix(in srgb, var(--akzent) ${endMix}%, var(--haupt))`} />
          <circle cx={spitze.cx} cy={spitze.cy} r="1.25" fill="white" fillOpacity={0.55 + begrenzt * 0.4} />
        </svg>
      )}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-medium tracking-wider text-leise uppercase">{tx("Level")}</span>
        <span className="zahl text-2xl leading-none font-bold">{level}</span>
      </div>
    </div>
  );
}
