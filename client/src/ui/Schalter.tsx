import { type ReactNode } from 'react';
import { tx } from '../text.ts';

export function Chip({
  aktiv,
  onClick,
  children,
  farbe,
  className = '',
  umbruch = false,
  hoch = false,
}: {
  aktiv: boolean;
  onClick: () => void;
  children: ReactNode;
  farbe?: string;
  className?: string;
  umbruch?: boolean;
  /** 48 px, für Ziele im Dialog. */
  hoch?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={aktiv}
      onClick={onClick}
      className={`chip ${hoch ? 'min-h-12' : 'min-h-9'} rounded-full border px-3 py-1.5 text-sm transition ${
        umbruch ? 'inline-block max-w-full text-left whitespace-normal' : 'flex shrink-0 items-center gap-1.5'
      } ${
        aktiv ? 'chip-aktiv border-transparent text-haupt' : 'border-rand text-leise hover:text-haupt'
      } ${aktiv && !farbe ? 'bg-akzent/15' : ''} ${className}`}
      style={aktiv && farbe ? { backgroundColor: `color-mix(in srgb, ${farbe} 18%, transparent)` } : undefined}
    >
      {children}
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
