import { Check, Eye, EyeOff } from 'lucide-react';
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { FARBEN } from '../../../shared/spiel/begriffe.ts';
import { tx } from '../text.ts';
import { Fehlermeldung } from './Anzeige.tsx';

type KnopfVariante = 'primaer' | 'sekundaer' | 'leise' | 'gefahr' | 'warnung';

const KNOPF_STIL: Record<KnopfVariante, string> = {
  primaer: 'min-h-12 rounded-lg bg-aktion px-4 text-aktion-text hover:brightness-110',
  sekundaer: 'min-h-12 rounded-lg border border-rand bg-flaeche-2 px-4 text-haupt hover:brightness-95 dark:hover:brightness-125',
  leise: 'min-h-12 rounded-lg px-4 text-leise hover:bg-flaeche-2 hover:text-haupt',
  gefahr: 'min-h-12 rounded-lg px-4 text-gefahr hover:bg-gefahr/10',
  warnung: 'min-h-12 rounded-lg bg-gefahr px-4 text-gefahr-text hover:brightness-110',
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
      className={`knopf knopf-${variante} inline-flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${KNOPF_STIL[variante]} ${className}`}
      {...props}
    />
  );
}

const OHNE_TEXT = new Set(['range', 'checkbox', 'radio', 'file', 'color', 'hidden', 'button', 'submit']);

type EingabeProps = {
  id?: string;
  type?: string;
  children?: ReactNode;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
};

function istTextEingabe(kind: ReactNode): kind is ReactElement<EingabeProps> {
  if (!isValidElement(kind)) {
    return false;
  }
  if (kind.type === 'textarea' || kind.type === 'select') {
    return true;
  }
  if (kind.type !== 'input') {
    return false;
  }
  const typ = (kind.props as EingabeProps).type ?? 'text';
  return !OHNE_TEXT.has(typ);
}

function beschriftung(bisher: string | undefined, neu: string | undefined): string | undefined {
  const text = [neu, bisher].filter(Boolean).join(' ');
  return text || undefined;
}

function reichere(kind: ReactNode, angaben: { id: string; invalid: boolean; beschrieben?: string }, nurErste: { offen: boolean }): ReactNode {
  if (!isValidElement(kind) || !nurErste.offen) {
    return kind;
  }
  if (istTextEingabe(kind)) {
    nurErste.offen = false;
    return cloneElement(kind, {
      id: kind.props.id ?? angaben.id,
      'aria-invalid': angaben.invalid ? true : undefined,
      'aria-describedby': beschriftung(kind.props['aria-describedby'], angaben.beschrieben),
    });
  }
  const kinder = (kind.props as EingabeProps).children;
  if (kinder === undefined) {
    return kind;
  }
  return cloneElement(kind as ReactElement<EingabeProps>, {}, Children.map(kinder, (enk) => reichere(enk, angaben, nurErste)));
}

function hatTextEingabe(knoten: ReactNode): boolean {
  return Children.toArray(knoten).some((kind) => {
    if (istTextEingabe(kind)) {
      return true;
    }
    if (!isValidElement(kind)) {
      return false;
    }
    return hatTextEingabe((kind.props as EingabeProps).children);
  });
}

function ersteId(knoten: ReactNode): string | undefined {
  for (const kind of Children.toArray(knoten)) {
    if (istTextEingabe(kind) && kind.props.id) {
      return kind.props.id;
    }
    if (isValidElement(kind)) {
      const tief = ersteId((kind.props as EingabeProps).children);
      if (tief) {
        return tief;
      }
    }
  }
  return undefined;
}

export function Feld({
  label,
  hinweis,
  fehler,
  children,
}: {
  label: ReactNode;
  hinweis?: string;
  fehler?: string | null;
  children: ReactNode;
}) {
  const basis = useId();
  const wurzel = useRef<HTMLDivElement>(null);
  const feldId = ersteId(children) ?? `${basis}-feld`;
  const fehlerId = fehler ? `${basis}-fehler` : undefined;
  const hinweisId = hinweis ? `${basis}-hinweis` : undefined;
  const beschrieben = [fehlerId, hinweisId].filter(Boolean).join(' ') || undefined;
  const labelText = typeof label === 'string' ? tx(label) : label;
  const fehlerText = fehler ? tx(fehler) : '';
  const kinder = reichere(children, { id: feldId, invalid: Boolean(fehler), beschrieben }, { offen: true });
  const eine = hatTextEingabe(children);

  useLayoutEffect(() => {
    if (!fehler || !wurzel.current) {
      return;
    }
    const form = wurzel.current.closest('form') ?? document.body;
    const erste = form.querySelector('[data-feld-fehler]');
    if (erste !== wurzel.current) {
      return;
    }
    const eingabe = wurzel.current.querySelector('input, textarea, select');
    if (eingabe instanceof HTMLElement && document.activeElement !== eingabe) {
      eingabe.focus();
    }
  }, [fehler]);

  return (
    <div ref={wurzel} className="feld block space-y-2" data-feld-fehler={fehler ? '' : undefined}>
      {eine ? (
        <label htmlFor={feldId} className="feld-label block text-sm leading-5 font-semibold text-balance break-words">
          {labelText}
        </label>
      ) : (
        <span className="feld-label block text-sm leading-5 font-semibold text-balance break-words">{labelText}</span>
      )}
      {kinder}
      {fehler ? (
        <p id={fehlerId} className="feld-fehler text-[13px] leading-[18px] break-words text-gefahr" role="alert">
          <span aria-hidden="true">⚠ </span>
          {fehlerText}
        </p>
      ) : null}
      {hinweis ? <p id={hinweisId} className="feld-hilfe truncate text-[13px] leading-[18px] text-leise">{tx(hinweis)}</p> : null}
    </div>
  );
}

export const EINGABE_STIL =
  'feld-eingabe w-full rounded-lg border border-[color:var(--feldrand)] bg-flaeche px-4 text-base leading-6 outline-none transition placeholder:text-leise';

export function PasswortFeld({
  label,
  hinweis,
  fehler,
  bezeichnung,
  className,
  id,
  autoCapitalize,
  autoCorrect,
  spellCheck,
  benutzername,
  passwordRules,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  hinweis?: string;
  fehler?: string | null;
  bezeichnung?: string;
  benutzername?: string;
  passwordRules?: string;
}) {
  const generiert = useId();
  const feldId = id ?? generiert;
  const sichtbarLabel = tx(label);
  const name = bezeichnung ?? sichtbarLabel;
  const [sichtbar, setSichtbar] = useState(false);
  return (
    <Feld label={sichtbarLabel} hinweis={hinweis} fehler={fehler}>
      <span className="relative block">
        <input
          {...rest}
          {...(passwordRules !== undefined
            ? ({ passwordrules: passwordRules } as InputHTMLAttributes<HTMLInputElement>)
            : null)}
          id={feldId}
          type={sichtbar ? 'text' : 'password'}
          autoCapitalize={autoCapitalize ?? 'none'}
          autoCorrect={autoCorrect ?? 'off'}
          spellCheck={spellCheck ?? false}
          className={`${EINGABE_STIL} pr-12 ${className ?? ''}`}
        />
        <button
          type="button"
          aria-label={tx(sichtbar ? '{name} ausblenden' : '{name} einblenden', { name })}
          aria-pressed={sichtbar}
          onMouseDown={(ereignis) => ereignis.preventDefault()}
          onClick={() => setSichtbar((wert) => !wert)}
          className="absolute top-0 right-0 flex h-12 w-12 items-center justify-center text-leise hover:text-haupt"
        >
          {sichtbar ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
        </button>
        {benutzername !== undefined ? (
          <input type="hidden" id="username" name="username" autoComplete="username" value={benutzername} readOnly />
        ) : null}
      </span>
    </Feld>
  );
}

export function Optionsliste<T extends string | number>({
  optionen,
  wert,
  onAendern,
  name,
}: {
  optionen: { wert: T; label: ReactNode }[];
  wert: T;
  onAendern: (wert: T) => void;
  name?: string;
}) {
  return (
    <div className="liste -mx-4 bg-flaeche md:mx-0 md:max-w-[720px] md:overflow-hidden md:rounded-lg md:border md:border-rand" role="radiogroup" aria-label={name}>
      {optionen.map((option) => {
        const label = typeof option.label === 'string' ? tx(option.label) : option.label;
        const gewaehlt = option.wert === wert;
        return (
          <button
            key={String(option.wert)}
            type="button"
            role="radio"
            aria-checked={gewaehlt}
            onClick={() => onAendern(option.wert)}
            className="zeile flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left"
          >
            <span className="min-w-0 flex-1 text-base leading-6">{label}</span>
            {gewaehlt ? <Check className="size-5 shrink-0 text-haupt" aria-hidden="true" /> : <span className="size-5 shrink-0" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

export function Segmentauswahl<T extends string | number>({
  optionen,
  wert,
  onAendern,
  dicht = false,
  name,
}: {
  optionen: { wert: T; label: ReactNode }[];
  wert: T;
  onAendern: (wert: T) => void;
  dicht?: boolean;
  name?: string;
}) {
  if (optionen.length > 4) {
    return <Optionsliste optionen={optionen} wert={wert} onAendern={onAendern} name={name} />;
  }
  return (
    <div className="flex gap-1 rounded-xl bg-flaeche-2 p-1">
      {optionen.map((option) => (
        <button
          key={String(option.wert)}
          type="button"
          onClick={() => onAendern(option.wert)}
          className={`flex min-h-12 flex-1 items-center justify-center rounded-lg py-2 text-sm font-medium transition ${dicht ? 'px-1.5 whitespace-nowrap' : 'px-3'} ${
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
