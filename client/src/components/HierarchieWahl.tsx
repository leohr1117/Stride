import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { gewaehlterName, type WahlKnoten } from '../projektHierarchie.ts';
import { Dialog } from './Dialog.tsx';
import { EINGABE_STIL, Farbpunkt } from '../ui/index.ts';

export function HierarchieWahl({
  label,
  wert,
  knoten,
  onAendern,
  disabled = false,
}: {
  label: string;
  wert: string;
  knoten: WahlKnoten[];
  onAendern: (wert: string) => void;
  disabled?: boolean;
}) {
  const [offen, setOffen] = useState(false);
  const anzeige = gewaehlterName(knoten, wert) ?? label;
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
        onClick={() => setOffen(true)}
      >
        <span className="min-w-0 flex-1 truncate">{anzeige}</span>
        <ChevronDown className="size-4 shrink-0 text-leise" aria-hidden />
      </button>
      <Dialog offen={offen} titel={label} onSchliessen={() => setOffen(false)}>
        <div role="listbox" aria-label={label} className="space-y-1">
          {knoten.map((eintrag) => (
            <Ast
              key={eintrag.schluessel}
              knoten={eintrag}
              wert={wert}
              onWahl={(naechstes) => {
                onAendern(naechstes);
                setOffen(false);
              }}
            />
          ))}
        </div>
      </Dialog>
    </>
  );
}

function Ast({
  knoten,
  wert,
  onWahl,
}: {
  knoten: WahlKnoten;
  wert: string;
  onWahl: (wert: string) => void;
}) {
  const punkt = knoten.ast === 'vision' || knoten.ast === 'organisation';
  const name = (
    <>
      {punkt && knoten.farbe ? <Farbpunkt farbe={knoten.farbe} /> : null}
      <span className="min-w-0 flex-1 truncate">{knoten.name}</span>
    </>
  );
  return (
    <div data-ast={knoten.ast}>
      {knoten.waehlbar ? (
        <button
          type="button"
          role="option"
          aria-selected={knoten.wert === wert}
          className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm ${knoten.wert === wert ? 'bg-flaeche-2' : ''}`}
          onClick={() => onWahl(knoten.wert)}
        >
          {name}
        </button>
      ) : (
        <h3 className="flex min-h-8 items-center gap-2 px-2 pt-2 text-sm font-medium">{name}</h3>
      )}
      {knoten.kinder.length > 0 ? (
        <div className="ms-3">
          {knoten.kinder.map((kind) => (
            <Ast key={kind.schluessel} knoten={kind} wert={wert} onWahl={onWahl} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
