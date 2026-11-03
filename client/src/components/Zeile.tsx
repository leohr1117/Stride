import { ChevronRight } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import { tx } from '../text.ts';
import { Flaeche } from '../ui/Flaeche.tsx';
import { InfoHinweis, SchalterBahn } from '../ui/index.ts';

const INFO_IN_ZEILE = 'inline-flex size-4 items-center justify-center rounded-full text-leise hover:text-haupt';
const ABSCHNITT = 'ueberschrift abschnittskopf mb-2 text-[13px] font-semibold leading-[18px] tracking-normal text-leise normal-case';
const TITEL = 'min-w-0 text-base leading-6 break-words';
const NEBEN = 'truncate text-[13px] leading-[18px] text-leise';
const WERT = 'max-w-40 truncate text-right text-[15px] leading-5 text-leise';

export type ZeilenArt = 'navigation' | 'auswahl' | 'lesen' | 'aktion';

function nameVon(titel: ReactNode, name?: string): string {
  if (name) {
    return name;
  }
  return typeof titel === 'string' ? titel : tx("Eintrag");
}

function artVon(eingabe: {
  gefahr: boolean;
  pfeil?: boolean;
  onKlick?: () => void;
  nach?: string;
  href?: string;
}): ZeilenArt {
  if (eingabe.gefahr) {
    return 'aktion';
  }
  if (eingabe.pfeil === false) {
    return eingabe.onKlick || eingabe.href ? 'aktion' : 'lesen';
  }
  if (eingabe.onKlick && !eingabe.nach && !eingabe.href) {
    return 'auswahl';
  }
  if (!eingabe.nach && !eingabe.href && !eingabe.onKlick) {
    return 'lesen';
  }
  return 'navigation';
}

export function Liste({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Flaeche className={className}>{children}</Flaeche>;
}

export function ZeilenGruppe({
  titel,
  aktion,
  zwischen,
  children,
}: {
  titel?: string;
  aktion?: ReactNode;
  zwischen?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      {titel ? (
        <div className="flex items-center justify-between gap-3">
          <h2 className={`min-w-0 text-balance break-words ${ABSCHNITT}`}>{tx(titel)}</h2>
          {aktion ? <div className="mb-2 shrink-0">{aktion}</div> : null}
        </div>
      ) : null}
      {zwischen}
      <Liste>{children}</Liste>
    </section>
  );
}

export function AnlegeZeile({ text, onKlick }: { text: string; onKlick: () => void }) {
  const sichtbar = `+ ${tx(text)}`;
  return <Zeile typ="aktion" titel={sichtbar} name={sichtbar} onKlick={onKlick} />;
}

export function Zeile({
  titel,
  name,
  info,
  wert,
  nach,
  href,
  download = false,
  onKlick,
  rechts,
  pfeil,
  gefahr = false,
  symbol,
  neben,
  typ,
  id,
  className = '',
}: {
  titel: ReactNode;
  name?: string;
  info?: string;
  wert?: ReactNode;
  nach?: string;
  href?: string;
  download?: boolean;
  onKlick?: () => void;
  rechts?: ReactNode;
  pfeil?: boolean;
  gefahr?: boolean;
  symbol?: ReactNode;
  neben?: string;
  typ?: ZeilenArt;
  id?: string;
  className?: string;
}) {
  const bezeichnung = nameVon(titel, name);
  const art = typ ?? artVon({ gefahr, pfeil, onKlick, nach, href });
  const zeigePfeil = art === 'navigation' || art === 'auswahl';
  const titelFarbe = art === 'aktion' ? (gefahr ? 'text-gefahr' : 'text-haupt') : '';
  const einzug = { '--liste-einzug': symbol ? '48px' : '16px' } as CSSProperties;
  return (
    <div id={id} data-zeile={art} style={einzug} className={`zeile relative flex min-h-12 items-center gap-3 px-4 py-3 ${className}`}>
      {nach ? <Link to={nach} aria-label={bezeichnung} className="absolute inset-0 z-0" /> : null}
      {href ? (
        <a href={href} download={download || undefined} aria-label={bezeichnung} className="absolute inset-0 z-0" />
      ) : null}
      {onKlick && !nach && !href ? (
        <button type="button" onClick={onKlick} aria-label={bezeichnung} className="absolute inset-0 z-0" />
      ) : null}
      {symbol ? (
        <span className="pointer-events-none flex size-5 shrink-0 items-center justify-center text-leise [&_svg]:size-5">{symbol}</span>
      ) : null}
      <span className="pointer-events-none flex min-w-0 flex-1 flex-col justify-center">
        <span className="flex min-w-0 items-center">
          <span className={`${TITEL} ${titelFarbe}`}>{titel}</span>
          {info ? (
            <span className="pointer-events-auto inline-flex self-center">
              <InfoHinweis text={info} name={typeof titel === 'string' ? titel : name} knopfKlasse={INFO_IN_ZEILE} />
            </span>
          ) : null}
        </span>
        {neben ? <span className={NEBEN}>{neben}</span> : null}
      </span>
      <span className="pointer-events-none flex shrink-0 items-center gap-2">
        {wert != null && wert !== '' ? <span className={WERT}>{wert}</span> : null}
        {rechts ? <span className="pointer-events-auto relative z-10">{rechts}</span> : null}
        {zeigePfeil ? <ChevronRight className="size-5 shrink-0 text-leise" aria-hidden /> : null}
      </span>
    </div>
  );
}

export function ZeileSchalter({
  titel,
  name,
  info,
  untertitel,
  an,
  onAendern,
  deaktiviert = false,
  neben,
  symbol,
  id,
  className = '',
}: {
  titel: ReactNode;
  name?: string;
  info?: string;
  untertitel?: string;
  an: boolean;
  onAendern: (an: boolean) => void;
  deaktiviert?: boolean;
  neben?: ReactNode;
  symbol?: ReactNode;
  id?: string;
  className?: string;
}) {
  const bezeichnung = nameVon(titel, name);
  const einzug = { '--liste-einzug': symbol ? '48px' : '16px' } as CSSProperties;
  return (
    <div id={id} data-zeile="schalter" style={einzug} className={`zeile relative flex min-h-12 items-center gap-3 px-4 py-3 ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={an}
        aria-label={bezeichnung}
        disabled={deaktiviert}
        onClick={() => onAendern(!an)}
        className="absolute inset-0 z-0 disabled:cursor-not-allowed"
      />
      {symbol ? (
        <span className={`pointer-events-none flex size-5 shrink-0 items-center justify-center text-leise [&_svg]:size-5 ${deaktiviert ? 'opacity-60' : ''}`}>
          {symbol}
        </span>
      ) : null}
      <span className="pointer-events-none flex min-w-0 flex-1 flex-col justify-center">
        <span className="flex min-w-0 items-center">
          <span className={`${TITEL} ${deaktiviert ? 'opacity-60' : ''}`}>{titel}</span>
          {info ? (
            <span className="pointer-events-auto inline-flex self-center">
              <InfoHinweis text={info} name={typeof titel === 'string' ? titel : name} knopfKlasse={INFO_IN_ZEILE} />
            </span>
          ) : null}
        </span>
        {untertitel ? <span className={`${NEBEN} ${deaktiviert ? 'opacity-60' : ''}`}>{untertitel}</span> : null}
      </span>
      <span className={`pointer-events-none flex shrink-0 items-center gap-3 ${deaktiviert ? 'opacity-60' : ''}`}>
        {neben ? <span className="pointer-events-auto relative z-10">{neben}</span> : null}
        <SchalterBahn an={an} />
      </span>
    </div>
  );
}
