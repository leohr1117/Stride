import { Check } from 'lucide-react';
import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Dialog } from '../../components/Dialog.tsx';
import { Zeile } from '../../components/Zeile.tsx';
import { tx } from '../../text.ts';

export interface WahlOption {
  wert: string;
  name: string;
  gruppe?: string;
}

export function EinzelWahl({
  feld,
  wertName,
  optionen,
  wert,
  onWaehlen,
}: {
  feld: string;
  wertName: string;
  optionen: WahlOption[];
  wert: string;
  onWaehlen: (wert: string) => void;
}) {
  const [offen, setOffen] = useState(false);
  const listeRef = useRef<HTMLDivElement>(null);
  const gruppen = new Set(optionen.flatMap((option) => (option.gruppe ? [option.gruppe] : [])));
  const zeigeGruppen = gruppen.size > 1;
  let letzteGruppe = '';

  const beiTaste = (ereignis: ReactKeyboardEvent<HTMLDivElement>) => {
    const liste = Array.from(listeRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    const index = liste.indexOf(document.activeElement as HTMLElement);
    if (ereignis.key === 'ArrowDown' || ereignis.key === 'ArrowUp') {
      ereignis.preventDefault();
      const richtung = ereignis.key === 'ArrowDown' ? 1 : -1;
      const naechstes = liste[index + richtung] ?? (richtung > 0 ? liste[0] : liste[liste.length - 1]);
      naechstes?.focus();
    }
  };

  return (
    <>
      <Zeile titel={tx(feld)} name={`${tx(feld)} · ${wertName}`} wert={wertName} onKlick={() => setOffen(true)} />
      <Dialog offen={offen} titel={tx(feld)} onSchliessen={() => setOffen(false)}>
        <div
          ref={listeRef}
          role="listbox"
          aria-label={tx(feld)}
          className="dialog-auswahl-liste"
          onKeyDown={beiTaste}
        >
          {optionen.map((option) => {
            const kopf =
              zeigeGruppen && option.gruppe && option.gruppe !== letzteGruppe ? (
                <p className="px-2 pt-3 text-[13px] leading-[18px] font-semibold text-leise">{tx(option.gruppe)}</p>
              ) : null;
            if (option.gruppe) {
              letzteGruppe = option.gruppe;
            }
            const aktiv = option.wert === wert;
            return (
              <div key={option.wert}>
                {kopf}
                <button
                  type="button"
                  role="option"
                  aria-selected={aktiv}
                  className="flex min-h-12 w-full items-center gap-3 px-2 text-left text-sm"
                  onClick={() => {
                    onWaehlen(option.wert);
                    setOffen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{option.name}</span>
                  {aktiv ? <Check className="size-5 shrink-0 text-haupt" aria-hidden /> : <span className="size-5 shrink-0" aria-hidden />}
                </button>
              </div>
            );
          })}
        </div>
      </Dialog>
    </>
  );
}
