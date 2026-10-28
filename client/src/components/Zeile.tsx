import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { tx } from '../text.ts';
import { InfoHinweis, Karte, SchalterBahn } from '../ui/index.ts';

const INFO_IN_ZEILE = 'inline-flex size-4 items-center justify-center rounded-full text-leise hover:text-haupt';

function nameVon(titel: ReactNode, name?: string): string {
  if (name) {
    return name;
  }
  return typeof titel === 'string' ? titel : tx("Eintrag");
}

export function ZeilenGruppe({ titel, children }: { titel?: string; children: ReactNode }) {
  return (
    <section>
      {titel ? <h2 className="abschnittskopf mb-2 text-sm font-medium text-balance break-words text-leise">{tx(titel)}</h2> : null}
      <Karte dicht>
        <div className="divide-y divide-rand">{children}</div>
      </Karte>
    </section>
  );
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
  id?: string;
  className?: string;
}) {
  const bezeichnung = nameVon(titel, name);
  const zeigePfeil = pfeil ?? Boolean(nach || href || onKlick);
  return (
    <div id={id} className={`zeile relative flex min-h-12 items-center gap-3 px-4 ${className}`}>
      {nach ? <Link to={nach} aria-label={bezeichnung} className="absolute inset-0 z-0" /> : null}
      {href ? (
        <a href={href} download={download || undefined} aria-label={bezeichnung} className="absolute inset-0 z-0" />
      ) : null}
      {onKlick && !nach && !href ? (
        <button type="button" onClick={onKlick} aria-label={bezeichnung} className="absolute inset-0 z-0" />
      ) : null}
      {symbol ? <span className="pointer-events-none shrink-0 text-leise">{symbol}</span> : null}
      <span className="pointer-events-none flex min-w-0 flex-1 items-center">
        <span className={`min-w-0 text-sm font-medium break-words ${gefahr ? 'text-gefahr' : ''}`}>{titel}</span>
        {info ? (
          <span className="pointer-events-auto inline-flex self-center">
            <InfoHinweis text={info} knopfKlasse={INFO_IN_ZEILE} />
          </span>
        ) : null}
      </span>
      <span className="pointer-events-none flex shrink-0 items-center gap-2">
        {wert != null && wert !== '' ? (
          <span className={`max-w-40 text-right text-sm break-words ${gefahr ? 'text-gefahr' : 'text-leise'}`}>{wert}</span>
        ) : null}
        {rechts ? <span className="pointer-events-auto relative z-10">{rechts}</span> : null}
        {zeigePfeil ? <ChevronRight className="size-4 shrink-0 text-leise" aria-hidden /> : null}
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
  return (
    <div id={id} className={`zeile relative flex min-h-12 items-center gap-3 px-4 ${className}`}>
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
        <span className={`pointer-events-none shrink-0 text-leise ${deaktiviert ? 'opacity-60' : ''}`}>{symbol}</span>
      ) : null}
      <span className="pointer-events-none flex min-w-0 flex-1 flex-col justify-center">
        <span className="flex min-w-0 items-center">
          <span className={`min-w-0 text-sm font-medium break-words ${deaktiviert ? 'opacity-60' : ''}`}>{titel}</span>
          {info ? (
            <span className="pointer-events-auto inline-flex self-center">
              <InfoHinweis text={info} knopfKlasse={INFO_IN_ZEILE} />
            </span>
          ) : null}
        </span>
        {untertitel ? (
          <span className={`break-words text-xs text-leise ${deaktiviert ? 'opacity-60' : ''}`}>{untertitel}</span>
        ) : null}
      </span>
      <span className={`pointer-events-none flex shrink-0 items-center gap-3 ${deaktiviert ? 'opacity-60' : ''}`}>
        {neben ? <span className="pointer-events-auto relative z-10">{neben}</span> : null}
        <SchalterBahn an={an} />
      </span>
    </div>
  );
}
