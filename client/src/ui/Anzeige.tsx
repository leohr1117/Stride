import { motion } from 'framer-motion';
import { type CSSProperties, type ReactNode, useId } from 'react';
import { prozentPunkte } from '../format.ts';
import { attributName, tx } from '../text.ts';
import { RING_HEUTE, RING_MITTE, RING_RADIUS, RING_SCHRIFT_AB, RING_UMFANG, ringAbschluss, strichWeite } from './levelringAbschluss.ts';

export function XpAbzug({ prozent }: { prozent: number }) {
  return (
    <span data-abzug="ziel" className="zahl shrink-0 text-xs font-medium whitespace-nowrap text-haupt">
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
  prozent,
  schrift = 'text-sm',
}: {
  name: string;
  kennung?: string | null;
  prozent: number | null;
  schrift?: string;
}) {
  return (
    <span className="flex min-w-0 flex-1 flex-nowrap items-center gap-1">
      <span className={`min-w-0 truncate ${schrift}`}>{attributName({ name, kennung })}</span>
      {prozent !== null ? <XpAbzug prozent={prozent} /> : null}
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

function ringSchrift(groesse: number, basis: number): number | undefined {
  if (groesse >= RING_SCHRIFT_AB) {
    return undefined;
  }
  return Math.max(1, Math.round((basis * groesse) / RING_SCHRIFT_AB));
}

function levelZeile(level: number, groesse: number, darunter: boolean): ReactNode {
  if (!darunter && groesse === RING_HEUTE) {
    return (
      <>
        <span className="max-w-full px-0.5 text-center text-[12px] leading-none text-leise">{tx("Level")}</span>
        <span className="zahl text-[20px] leading-[24px] font-semibold">{level}</span>
      </>
    );
  }
  const labelGroesse = ringSchrift(groesse, 10);
  const zahlGroesse = ringSchrift(groesse, 24);
  return (
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
}

function levelGrafik(anteil: number, groesse: number, verlaufId: string): ReactNode {
  const begrenzt = Math.min(1, Math.max(0, anteil));
  const strich = strichWeite(groesse);
  const voll = begrenzt >= 0.999;
  const abschluss = ringAbschluss(anteil, groesse);
  const kreis = {
    cx: RING_MITTE,
    cy: RING_MITTE,
    r: RING_RADIUS,
    fill: 'none',
    strokeWidth: strich,
    strokeLinecap: 'butt',
  } as const;
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0" aria-hidden="true">
      <circle cx={RING_MITTE} cy={RING_MITTE} r={RING_RADIUS} fill="none" stroke="var(--flaeche-2)" strokeWidth={strich} />
      {abschluss && (
        <g className="levelring-bogen">
          <circle
            className="levelring-strich"
            {...kreis}
            stroke="var(--fortschritt)"
            strokeDasharray={voll ? undefined : `${begrenzt * RING_UMFANG} ${RING_UMFANG}`}
            transform={voll ? undefined : `rotate(-90 ${RING_MITTE} ${RING_MITTE})`}
          />
          {abschluss.verlauf !== null && abschluss.versatzVerlauf !== null && abschluss.verlaufVon && abschluss.verlaufNach && (
            <>
              <defs>
                <linearGradient
                  id={verlaufId}
                  gradientUnits="userSpaceOnUse"
                  x1={abschluss.verlaufVon.x}
                  y1={abschluss.verlaufVon.y}
                  x2={abschluss.verlaufNach.x}
                  y2={abschluss.verlaufNach.y}
                >
                  <stop offset="0" stopColor="var(--balken-farbe)" />
                  <stop offset="1" stopColor="var(--balken-verlauf-ton)" />
                </linearGradient>
              </defs>
              <circle
                className="levelring-verlauf"
                {...kreis}
                stroke={`url(#${verlaufId})`}
                strokeDasharray={`${abschluss.verlauf} ${RING_UMFANG}`}
                strokeDashoffset={abschluss.versatzVerlauf}
              />
            </>
          )}
          <circle
            className="levelring-spitze"
            {...kreis}
            stroke="var(--balken-spitze)"
            strokeDasharray={`${abschluss.spitze} ${RING_UMFANG}`}
            strokeDashoffset={abschluss.versatzSpitze}
          />
        </g>
      )}
    </svg>
  );
}

export function LevelRing({
  level,
  anteil,
  groesse = RING_HEUTE,
  mitte,
}: {
  level: number;
  anteil: number;
  groesse?: number;
  mitte?: ReactNode;
}) {
  const verlaufId = `lr${useId().replaceAll(':', '')}`;
  const grafik = levelGrafik(anteil, groesse, verlaufId);
  const zeile = levelZeile(level, groesse, Boolean(mitte));

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
