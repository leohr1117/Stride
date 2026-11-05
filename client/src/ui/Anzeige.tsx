import { motion } from 'framer-motion';
import { type CSSProperties, type ReactNode, useId } from 'react';
import { prozentPunkte } from '../format.ts';
import { tx } from '../text.ts';

export function XpAbzug({ prozent, schrift = 'text-xs' }: { prozent: number; schrift?: string }) {
  return (
    <span data-abzug="ziel" className={`zahl shrink-0 font-medium whitespace-nowrap text-gefahr ${schrift}`}>
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

/** Farbpunkt vor dem Namen, bündig zur Zeile. Standard 10 px, Organisation in der Liste 8 px. */
export function Farbpunkt({
  farbe,
  className = '',
  groesse = 10,
}: {
  farbe: string;
  className?: string;
  groesse?: 8 | 10;
}) {
  return (
    <span
      data-farbpunkt=""
      aria-hidden
      className={`inline-block shrink-0 rounded-full align-middle ${groesse === 8 ? 'size-2' : 'size-[10px]'} ${className}`}
      style={{ backgroundColor: farbe }}
    />
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

export function Ueberschrift({ titel, aktion, className = '' }: { titel: string; aktion?: ReactNode; className?: string }) {
  return (
    <div className={`mb-2 flex items-center justify-between gap-3 ${className}`}>
      <h2 className="ueberschrift abschnittskopf min-w-0 text-[13px] font-semibold leading-[18px] tracking-normal text-leise normal-case">{titel}</h2>
      {aktion ? <div className="shrink-0">{aktion}</div> : null}
    </div>
  );
}

export function Leer({ text, aktion }: { text: string; aktion?: ReactNode }) {
  return (
    <div className="leer px-4 py-6 text-center">
      <p className="text-base text-leise">{text}</p>
      {aktion ? <div className="mt-4 flex justify-center">{aktion}</div> : null}
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
  return (
    <p className="feld-fehler text-[13px] leading-[18px] break-words text-gefahr" role="alert">
      <span aria-hidden="true">⚠ </span>
      {text}
    </p>
  );
}

export function Ladeanzeige() {
  return <div className="py-16 text-center text-sm text-leise">{tx('Lädt …')}</div>;
}

export function Fortschrittsbalken({
  anteil,
  verlustBis,
  farbe = 'var(--fortschritt)',
  hoehe = 'h-2',
  bewegt = true,
}: {
  anteil: number;
  /** Ende des abgeschwächten Verlusts. Ohne Angabe zeigt der Balken nur den Stand. */
  verlustBis?: number;
  farbe?: string;
  hoehe?: string;
  bewegt?: boolean;
}) {
  const stand = Math.min(1, Math.max(0, anteil));
  if (!bewegt) {
    const breite = stand * 100;
    return (
      <div className={`${hoehe} overflow-hidden rounded-full bg-flaeche-2`}>
        {breite > 0 && <div className="h-full rounded-full" style={{ width: `${breite}%`, backgroundColor: farbe }} />}
      </div>
    );
  }
  const verlust = Math.min(1, Math.max(stand, verlustBis ?? stand));
  const zeigtVerlust = verlust - stand > 0.005;
  const leer = stand <= 0;
  const fuellung = { backgroundColor: farbe, '--balken-farbe': farbe } as CSSProperties;
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
        data-leer={leer ? '' : undefined}
        style={fuellung}
        initial={false}
        animate={{ width: `${stand * 100}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      >
        {leer ? null : (
          <span className="balken-mass">
            <span className="balken-verlauf" />
            <span className="balken-spitze" />
          </span>
        )}
      </motion.div>
    </div>
  );
}

const RING_MITTE = 50;
const RING_RADIUS = 42;
const RING_STRICH = 8;

function ringId(roh: string): string {
  return `ringschein${roh.replace(/:/g, '')}`;
}

function ringSpitze(anteil: number): { cx: number; cy: number } {
  const winkel = -Math.PI / 2 + anteil * Math.PI * 2;
  return {
    cx: RING_MITTE + Math.cos(winkel) * RING_RADIUS,
    cy: RING_MITTE + Math.sin(winkel) * RING_RADIUS,
  };
}

const RING_SCHRIFT_AB = 96;

function ringSchrift(groesse: number, basis: number): number | undefined {
  return Math.max(1, Math.round((basis * groesse) / RING_SCHRIFT_AB));
}

export function LevelRing({
  level,
  anteil,
  groesse = 96,
  mitte,
}: {
  level: number;
  anteil: number;
  groesse?: number;
  mitte?: ReactNode;
}) {
  const schein = ringId(useId());
  const begrenzt = Math.min(1, Math.max(0, anteil));
  const voll = begrenzt >= 0.999;
  const spitze = ringSpitze(begrenzt);
  const endMix = Math.round(18 + begrenzt * 82);
  const startKraft = Math.round(58 + begrenzt * 18);
  const spitzenFarbe = `color-mix(in srgb, var(--fortschritt) ${endMix}%, var(--haupt))`;
  // 0° im conic-gradient ist 12 Uhr, im Uhrzeigersinn. Blass am Anfang, kräftig an der Spitze.
  const verlauf = `conic-gradient(from 0deg, color-mix(in srgb, var(--haupt) ${startKraft}%, transparent) 0deg, ${spitzenFarbe} ${begrenzt * 360}deg, transparent ${begrenzt * 360}deg)`;
  // Die Maske deckt genau den Strich (Mitte 42, Breite 8 in der 100er-Box).
  const maske = 'radial-gradient(farthest-side, transparent 75.2%, #000 76.4%, #000 91.6%, transparent 92.8%)';
  const labelGroesse = ringSchrift(groesse, 10);
  const zahlGroesse = ringSchrift(groesse, 24);
  const zeile = (
    <>
      <span
        className="max-w-full px-1 text-center text-[10px] leading-none font-medium tracking-wider text-leise uppercase"
        style={labelGroesse ? { fontSize: labelGroesse, lineHeight: 1.1 } : undefined}
      >
        {tx("Level")}
      </span>
      <span
        className="zahl text-2xl leading-none font-bold"
        style={zahlGroesse ? { fontSize: zahlGroesse, lineHeight: 1 } : undefined}
      >
        {level}
      </span>
    </>
  );
  const grafik = (
    <>
      <svg viewBox="0 0 100 100" className="absolute inset-0 overflow-visible" aria-hidden="true">
        <circle cx={RING_MITTE} cy={RING_MITTE} r={RING_RADIUS} fill="none" stroke="var(--flaeche-2)" strokeWidth={RING_STRICH} />
        {voll && (
          <circle
            cx={RING_MITTE}
            cy={RING_MITTE}
            r={RING_RADIUS}
            fill="none"
            stroke={spitzenFarbe}
            strokeWidth={RING_STRICH}
          />
        )}
      </svg>
      {begrenzt > 0 && !voll && (
        <div
          className="pointer-events-none absolute inset-0"
          data-levelbogen=""
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
            fill={spitzenFarbe}
            fillOpacity={0.45 + begrenzt * 0.5}
            filter={`url(#${schein})`}
          />
          <circle cx={spitze.cx} cy={spitze.cy} r="4.05" fill={spitzenFarbe} />
          <circle data-ringlicht="" cx={spitze.cx} cy={spitze.cy} r="1.25" fill="white" fillOpacity={0.55 + begrenzt * 0.4} />
        </svg>
      )}
    </>
  );

  if (mitte) {
    return (
      <div
        className="levelring relative flex shrink-0 flex-col items-center"
        data-levelring=""
        style={{ width: groesse, minWidth: groesse, maxWidth: groesse }}
      >
        <div className="relative" style={{ width: groesse, height: groesse }}>
          {grafik}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">{mitte}</div>
        </div>
        <div className="mt-1 flex w-full flex-col items-center">{zeile}</div>
      </div>
    );
  }

  return (
    <div className="levelring relative shrink-0" data-levelring="" style={{ width: groesse, height: groesse }}>
      {grafik}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">{zeile}</div>
    </div>
  );
}
