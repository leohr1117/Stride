import { Check } from 'lucide-react';
import { Children, isValidElement, type ReactNode } from 'react';
import { tx } from '../text.ts';

type ChipFelder = {
  aktiv: boolean;
  children: ReactNode;
  farbe?: string;
  className?: string;
  /** Voller Name, wenn der sichtbare Text ihn nicht schon trägt. */
  name?: string;
  gesperrt?: boolean;
  /** Haken bei der gewählten Option. Zweistufige Vorschläge bleiben ohne. */
  haken?: boolean;
  /** Eine Zeile, Namen über 200 px mit Auslassung. */
  einzeilig?: boolean;
};

function nameAus(knoten: ReactNode): string {
  const teile: string[] = [];
  const lauf = (wert: ReactNode) => {
    if (wert === null || wert === undefined || typeof wert === 'boolean') {
      return;
    }
    if (typeof wert === 'string' || typeof wert === 'number') {
      teile.push(String(wert));
      return;
    }
    if (Array.isArray(wert)) {
      wert.forEach(lauf);
      return;
    }
    if (isValidElement(wert)) {
      const props = wert.props as { children?: ReactNode; 'aria-hidden'?: boolean };
      if (props['aria-hidden']) {
        return;
      }
      lauf(props.children);
    }
  };
  lauf(knoten);
  return teile.join('').replace(/\s+/g, ' ').trim();
}

function chipKinder(knoten: ReactNode, einzeilig: boolean): ReactNode {
  if (!einzeilig) {
    return knoten;
  }
  return Children.map(knoten, (kind) => {
    if (typeof kind === 'string' || typeof kind === 'number') {
      const text = String(kind);
      if (text.trim() === '') {
        return text;
      }
      return <span className="chip-name min-w-0 max-w-[200px] truncate">{text}</span>;
    }
    return kind;
  });
}

/** Eine Chip-Form: 36 px Fläche, 48 px Treffer, 12 px innen, Text 14/20, Symbol 16 px. */
export function Chip({
  aktiv,
  onClick,
  children,
  farbe,
  className = '',
  name,
  gesperrt = false,
  haken = true,
  einzeilig = true,
  href,
}: ChipFelder & ({ href?: undefined; onClick: () => void } | { href: string; onClick?: () => void })) {
  const voll = className.includes('w-full');
  const gewaehlt = aktiv && !gesperrt;
  const flaeche = [
    'chip-flaeche inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm leading-5',
    voll ? 'w-full max-w-none justify-center' : '',
    gewaehlt ? 'chip-aktiv border-transparent text-haupt' : 'border-rand text-leise',
    gewaehlt && !farbe ? 'bg-akzent/15' : '',
    gesperrt ? 'opacity-40' : '',
  ].join(' ');
  const stil = gewaehlt && farbe ? { backgroundColor: `color-mix(in srgb, ${farbe} 18%, transparent)` } : undefined;
  const zugang = name ?? nameAus(children);
  const inhalt = (
    <span className={flaeche} style={stil}>
      {haken && gewaehlt ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
      {chipKinder(children, einzeilig)}
    </span>
  );
  const treffer = `chip inline-flex h-12 items-center ${voll ? 'w-full min-w-0' : 'shrink-0'} ${className}`;
  if (href) {
    return (
      <a
        href={href}
        aria-current={aktiv ? 'true' : undefined}
        aria-label={zugang || undefined}
        onClick={onClick}
        className={`${treffer} no-underline`}
      >
        {inhalt}
      </a>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={aktiv}
      aria-disabled={gesperrt || undefined}
      aria-label={zugang || undefined}
      onClick={onClick}
      className={treffer}
    >
      {inhalt}
    </button>
  );
}

export function SchalterBahn({ an }: { an: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="schalter-bahn relative h-6 w-11 shrink-0 rounded-full border-2 transition-colors"
      style={{
        backgroundColor: an ? 'var(--schalter-an)' : 'var(--schalter-aus)',
        borderColor: an ? 'var(--schalter-an)' : 'var(--feldrand)',
      }}
    >
      <span
        className="schalter-knopf absolute top-0 size-5 rounded-full transition-all"
        style={{
          backgroundColor: an ? 'var(--schalter-knopf-an)' : 'var(--schalter-knopf-aus)',
          left: an ? 'calc(100% - 1.25rem)' : '0px',
        }}
      />
    </span>
  );
}

export function Schalter({
  an,
  onAendern,
  label,
  beschreibung,
  icon,
  deaktiviert = false,
  kompakt = false,
  umbruch = false,
}: {
  an: boolean;
  onAendern: (an: boolean) => void;
  label: ReactNode;
  beschreibung?: string;
  icon?: ReactNode;
  deaktiviert?: boolean;
  kompakt?: boolean;
  /** Früher einzeilig. Englische Labels dürfen umbrechen. */
  umbruch?: boolean;
}) {
  const labelText = typeof label === 'string' ? tx(label) : label;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={an}
      aria-label={kompakt && typeof labelText === 'string' ? labelText : undefined}
      onClick={() => onAendern(!an)}
      disabled={deaktiviert}
      className={`items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
        kompakt ? 'inline-flex shrink-0' : 'flex min-h-12 w-full justify-between'
      }`}
    >
      {!kompakt && (
        <span className="flex min-w-0 items-center gap-3">
          {icon}
          <span className="min-w-0">
            <span className={`block text-sm font-medium text-balance break-words ${umbruch ? '' : ''}`}>{labelText}</span>
            {beschreibung && <span className="block text-xs text-balance break-words text-leise">{tx(beschreibung)}</span>}
          </span>
        </span>
      )}
      <SchalterBahn an={an} />
    </button>
  );
}
