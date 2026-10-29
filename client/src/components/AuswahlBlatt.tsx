import { Check, ChevronDown } from 'lucide-react';
import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { tx } from '../text.ts';
import { Dialog } from './Dialog.tsx';
import { EINGABE_STIL, Farbpunkt, Knopf } from '../ui/index.ts';

export interface AuswahlOption {
  wert: string;
  name: string;
  farbe?: string;
  symbol?: ReactNode;
  ebene?: number;
  waehlbar?: boolean;
}

interface Gemeinsam {
  label: string;
  optionen: AuswahlOption[];
  disabled?: boolean;
  anzeige?: string;
  leerText?: string;
  leerAktion?: { label: string; href: string };
  alleText?: string;
  zahlText?: (anzahl: number) => string;
}

type Props = Gemeinsam &
  (
    | { modus: 'einzeln'; wert: string; onAendern: (wert: string) => void }
    | { modus: 'filter' | 'formular'; wert: string[]; onAendern: (wert: string[]) => void }
  );

function namenFuer(optionen: AuswahlOption[], werte: string[]): string[] {
  return werte.flatMap((wert) => {
    const name = optionen.find((option) => option.wert === wert)?.name;
    return name ? [name] : [];
  });
}

export function AuswahlBlatt(props: Props) {
  const { label, optionen, disabled, leerText, leerAktion } = props;
  const [offen, setOffen] = useState(false);
  const [entwurf, setEntwurf] = useState<string[]>([]);
  const listeRef = useRef<HTMLDivElement>(null);
  const mehrfach = props.modus !== 'einzeln';
  const gewaehlt = mehrfach ? (offen && props.modus === 'filter' ? entwurf : props.wert) : [];
  const waehlbar = optionen.some((option) => option.waehlbar !== false);

  const triggerText = () => {
    if (props.anzeige && props.modus === 'einzeln') {
      return props.anzeige;
    }
    if (props.modus === 'einzeln') {
      return optionen.find((option) => option.wert === props.wert)?.name ?? label;
    }
    const namen = namenFuer(optionen, props.wert);
    if (namen.length === 0) {
      return props.alleText ?? tx('Alle');
    }
    if (namen.length >= 3) {
      return props.zahlText ? props.zahlText(namen.length) : String(namen.length);
    }
    return namen.join(', ');
  };

  const oeffnen = () => {
    if (props.modus !== 'einzeln') {
      setEntwurf([...props.wert]);
    }
    setOffen(true);
  };

  const setze = (naechste: string[]) => {
    setEntwurf(naechste);
    if (props.modus === 'formular') {
      props.onAendern(naechste);
    }
  };

  const waehle = (wert: string) => {
    if (props.modus === 'einzeln') {
      props.onAendern(wert);
      setOffen(false);
      return;
    }
    const bisher = props.modus === 'filter' ? entwurf : props.wert;
    const naechste = bisher.includes(wert) ? bisher.filter((eintrag) => eintrag !== wert) : [...bisher, wert];
    setze(naechste);
  };

  const beiTaste = (ereignis: ReactKeyboardEvent<HTMLDivElement>) => {
    const liste = Array.from(listeRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    const index = liste.indexOf(document.activeElement as HTMLElement);
    if (ereignis.key === 'ArrowDown' || ereignis.key === 'ArrowUp') {
      ereignis.preventDefault();
      const richtung = ereignis.key === 'ArrowDown' ? 1 : -1;
      const ziel = liste[index + richtung] ?? (richtung > 0 ? liste[0] : liste[liste.length - 1]);
      ziel?.focus();
      return;
    }
    if (ereignis.key === ' ' && document.activeElement instanceof HTMLElement && liste.includes(document.activeElement)) {
      ereignis.preventDefault();
      document.activeElement.click();
    }
  };

  const zeile = (option: AuswahlOption) => {
    const einzug = (option.ebene ?? 0) * 16;
    const stil = { paddingInlineStart: einzug > 0 ? `${einzug}px` : undefined };
    const inhalt = (
      <>
        {option.symbol ?? (option.farbe ? <Farbpunkt farbe={option.farbe} /> : <span className="size-[10px] shrink-0" aria-hidden />)}
        <span className="min-w-0 flex-1 truncate">{option.name}</span>
      </>
    );
    if (option.waehlbar === false) {
      return (
        <p key={option.wert} className="flex min-h-12 items-center gap-3 px-2 text-[13px] text-leise" style={stil}>
          {inhalt}
        </p>
      );
    }
    const aktiv = props.modus === 'einzeln' ? props.wert === option.wert : gewaehlt.includes(option.wert);
    return (
      <button
        key={option.wert}
        type="button"
        role="option"
        aria-selected={aktiv}
        className="flex min-h-12 w-full items-center gap-3 px-2 text-left text-sm"
        style={stil}
        onClick={() => waehle(option.wert)}
      >
        {inhalt}
        {aktiv ? <Check className="size-5 shrink-0 text-haupt" aria-hidden /> : <span className="size-5 shrink-0" aria-hidden />}
      </button>
    );
  };

  return (
    <>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={offen}
        aria-haspopup="dialog"
        disabled={disabled}
        className={`${EINGABE_STIL} flex min-w-0 items-center justify-between gap-2 text-left`}
        onClick={oeffnen}
      >
        <span className="min-w-0 flex-1 truncate">{triggerText()}</span>
        <ChevronDown className="size-4 shrink-0 text-leise" aria-hidden />
      </button>
      <Dialog offen={offen} titel={label} onSchliessen={() => setOffen(false)}>
        <div className="dialog-auswahl">
          {!waehlbar ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-leise">{leerText}</p>
              {leerAktion ? (
                <Link to={leerAktion.href} className="inline-flex min-h-12 items-center text-sm font-medium text-akzent">
                  {leerAktion.label}
                </Link>
              ) : null}
            </div>
          ) : (
            <div
              ref={listeRef}
              role="listbox"
              aria-label={label}
              aria-multiselectable={mehrfach ? true : undefined}
              className="dialog-auswahl-liste"
              onKeyDown={beiTaste}
            >
              {mehrfach ? (
                <>
                  <button
                    type="button"
                    role="option"
                    aria-selected={gewaehlt.length === 0}
                    className="flex min-h-12 w-full items-center gap-3 px-2 text-left text-sm"
                    onClick={() => setze([])}
                  >
                    <span className="min-w-0 flex-1 truncate">{tx('Alle')}</span>
                    {gewaehlt.length === 0 ? <Check className="size-5 shrink-0 text-haupt" aria-hidden /> : <span className="size-5 shrink-0" />}
                  </button>
                  <div className="mb-1 border-b border-rand" />
                </>
              ) : null}
              {optionen.map(zeile)}
            </div>
          )}
          {props.modus === 'filter' && waehlbar ? (
            <div className="dialog-aktionen shrink-0 pt-4">
              <Knopf onClick={() => setEntwurf([])}>{tx('Zurücksetzen')}</Knopf>
              <Knopf
                variante="primaer"
                onClick={() => {
                  props.onAendern(entwurf);
                  setOffen(false);
                }}
              >
                {tx('Anwenden')}
              </Knopf>
            </div>
          ) : null}
          {props.modus === 'formular' && waehlbar ? (
            <div className="dialog-aktionen shrink-0 pt-4">
              <Knopf variante="primaer" className="w-full" onClick={() => setOffen(false)}>
                {tx('Fertig')}
              </Knopf>
            </div>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
