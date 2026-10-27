import { Check, Eye, EyeOff } from 'lucide-react';
import {
  Children,
  isValidElement,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { FARBEN } from '../../../shared/spiel/begriffe.ts';
import { tx } from '../text.ts';
import { Fehlermeldung } from './Anzeige.tsx';

type KnopfVariante = 'primaer' | 'sekundaer' | 'leise' | 'gefahr';

const KNOPF_STIL: Record<KnopfVariante, string> = {
  primaer: 'bg-akzent text-akzent-text hover:brightness-110',
  sekundaer: 'bg-flaeche-2 text-haupt hover:brightness-95 dark:hover:brightness-125',
  leise: 'text-leise hover:text-haupt hover:bg-flaeche-2',
  gefahr: 'text-gefahr hover:bg-gefahr/10',
};

function istFehler(knoten: ReactNode): boolean {
  return isValidElement(knoten) && knoten.type === Fehlermeldung;
}

function enthaeltAbsenden(knoten: ReactNode): boolean {
  if (!isValidElement(knoten)) {
    return false;
  }
  const props = knoten.props as { type?: string; children?: ReactNode };
  if (props.type === 'submit') {
    return true;
  }
  const typ = knoten.type;
  if (typeof typ === 'function' && (typ as { fuss?: boolean }).fuss === true) {
    return true;
  }
  return Children.toArray(props.children).some(enthaeltAbsenden);
}

function teileFuss(kinder: ReactNode[]): { felder: ReactNode[]; fuss: ReactNode[] } {
  let aktion = -1;
  for (let index = kinder.length - 1; index >= 0; index -= 1) {
    if (enthaeltAbsenden(kinder[index])) {
      aktion = index;
      break;
    }
  }
  if (aktion <= 0) {
    return { felder: kinder, fuss: [] };
  }
  const start = istFehler(kinder[aktion - 1]) ? aktion - 1 : aktion;
  return { felder: kinder.slice(0, start), fuss: kinder.slice(start) };
}

/** Formular mit festem Fuß: die Aktionszeile bleibt sichtbar, die Felder scrollen. */
export function Formular({
  onAbsenden,
  className = '',
  abstand = 'space-y-4',
  children,
}: {
  onAbsenden: (ereignis: FormEvent<HTMLFormElement>) => void;
  className?: string;
  abstand?: string;
  children: ReactNode;
}) {
  const { felder, fuss } = teileFuss(Children.toArray(children));
  return (
    <form onSubmit={onAbsenden} className={`formular min-h-0 ${className}`}>
      {felder.length > 0 ? <div className={`formular-felder min-h-0 ${abstand}`}>{felder}</div> : null}
      {fuss.length > 0 ? <div className="formular-fuss shrink-0 space-y-4">{fuss}</div> : null}
    </form>
  );
}

export function Knopf({
  variante = 'sekundaer',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: KnopfVariante }) {
  return (
    <button
      type="button"
      className={`knopf knopf-${variante} inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${KNOPF_STIL[variante]} ${className}`}
      {...props}
    />
  );
}

function istEingabe(kind: ReactNode): boolean {
  return isValidElement(kind) && (kind.type === 'input' || kind.type === 'textarea' || kind.type === 'select');
}

export function Feld({ label, hinweis, children }: { label: ReactNode; hinweis?: string; children: ReactNode }) {
  const labelText = typeof label === 'string' ? tx(label) : label;
  // Eine Hülle aus label würde die erste Schaltfläche mit dem ganzen Feldtext benennen.
  const Huelle = Children.toArray(children).some(istEingabe) ? 'label' : 'div';
  return (
    <Huelle className="block space-y-1.5">
      <span className="block text-sm font-medium text-balance break-words">{labelText}</span>
      {children}
      {hinweis && <span className="block text-xs text-balance break-words text-leise">{tx(hinweis)}</span>}
    </Huelle>
  );
}

export const EINGABE_STIL =
  'w-full rounded-xl border border-rand bg-flaeche-2 px-3 py-2.5 text-sm outline-none transition placeholder:text-leise focus:border-akzent';

export function PasswortFeld({
  label,
  hinweis,
  bezeichnung,
  className,
  id,
  autoCapitalize,
  autoCorrect,
  spellCheck,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string; hinweis?: string; bezeichnung?: string }) {
  const generiert = useId();
  const feldId = id ?? generiert;
  const sichtbarLabel = tx(label);
  const name = bezeichnung ?? sichtbarLabel;
  const [sichtbar, setSichtbar] = useState(false);
  return (
    <div className="block space-y-1.5">
      <label htmlFor={feldId} className="block text-sm font-medium">
        {sichtbarLabel}
      </label>
      <span className="relative block">
        <input
          {...rest}
          id={feldId}
          type={sichtbar ? 'text' : 'password'}
          autoCapitalize={autoCapitalize ?? 'none'}
          autoCorrect={autoCorrect ?? 'off'}
          spellCheck={spellCheck ?? false}
          className={`${EINGABE_STIL} pr-11 ${className ?? ''}`}
        />
        <button
          type="button"
          aria-label={tx(sichtbar ? tx("{name} ausblenden") : tx("{name} einblenden"), { name })}
          aria-pressed={sichtbar}
          onMouseDown={(ereignis) => ereignis.preventDefault()}
          onClick={() => setSichtbar((wert) => !wert)}
          className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-leise hover:text-haupt"
        >
          {sichtbar ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
      </span>
      {hinweis && <span className="block text-xs text-leise">{tx(hinweis)}</span>}
    </div>
  );
}

export function Segmentauswahl<T extends string | number>({
  optionen,
  wert,
  onAendern,
  dicht = false,
}: {
  optionen: { wert: T; label: ReactNode }[];
  wert: T;
  onAendern: (wert: T) => void;
  dicht?: boolean;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-flaeche-2 p-1">
      {optionen.map((option) => (
        <button
          key={String(option.wert)}
          type="button"
          onClick={() => onAendern(option.wert)}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${dicht ? 'px-1.5 whitespace-nowrap' : 'px-3'} ${
            option.wert === wert ? 'bg-flaeche text-haupt shadow-sm' : 'text-leise hover:text-haupt'
          }`}
        >
          {typeof option.label === 'string' ? tx(option.label) : option.label}
        </button>
      ))}
    </div>
  );
}

export function Farbauswahl({ wert, onAendern }: { wert: string; onAendern: (farbe: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {FARBEN.map((farbe) => (
        <button
          key={farbe}
          type="button"
          aria-label={tx('Farbe {farbe}', { farbe })}
          onClick={() => onAendern(farbe)}
          className="flex size-8 items-center justify-center rounded-full transition hover:scale-110"
          style={{ backgroundColor: farbe }}
        >
          {farbe === wert && <Check className="size-4 text-white" strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}
