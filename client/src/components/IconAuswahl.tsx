import { ChevronRight } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ICONS } from '../../../shared/spiel/begriffe.ts';
import { tx } from '../text.ts';
import { EINGABE_STIL } from '../ui/index.ts';
import { Dialog } from './Dialog.tsx';
import { Icon } from './Icons.tsx';

const SPALTEN = 8;

function zellenKlasse(gewaehlt: boolean): string {
  return `flex aspect-square items-center justify-center rounded-lg border transition ${
    gewaehlt ? 'border-akzent bg-akzent/10' : 'border-rand text-leise hover:text-haupt'
  }`;
}

function IconRaster({
  wert,
  farbe,
  onAendern,
  mitTastatur = false,
}: {
  wert: string;
  farbe: string;
  onAendern: (icon: (typeof ICONS)[number]) => void;
  mitTastatur?: boolean;
}) {
  const rasterRef = useRef<HTMLDivElement>(null);
  const hatWahl = ICONS.some((option) => option === wert);

  useLayoutEffect(() => {
    if (!mitTastatur) {
      return;
    }
    const ziel =
      rasterRef.current?.querySelector<HTMLElement>('[aria-selected="true"]') ??
      rasterRef.current?.querySelector<HTMLElement>('[role="gridcell"]');
    ziel?.focus();
  }, [mitTastatur]);

  const beiTaste = (ereignis: ReactKeyboardEvent<HTMLDivElement>) => {
    const pfeil =
      ereignis.key === 'ArrowLeft' ||
      ereignis.key === 'ArrowRight' ||
      ereignis.key === 'ArrowUp' ||
      ereignis.key === 'ArrowDown';
    if (!pfeil) {
      return;
    }
    const zellen = Array.from(ereignis.currentTarget.querySelectorAll<HTMLButtonElement>('[role="gridcell"]'));
    const index = zellen.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) {
      return;
    }
    ereignis.preventDefault();
    const spalte = index % SPALTEN;
    let ziel = index;
    if (ereignis.key === 'ArrowLeft') {
      if (spalte === 0) {
        return;
      }
      ziel = index - 1;
    } else if (ereignis.key === 'ArrowRight') {
      if (spalte === SPALTEN - 1) {
        return;
      }
      ziel = index + 1;
    } else if (ereignis.key === 'ArrowUp') {
      ziel = index - SPALTEN;
    } else {
      ziel = index + SPALTEN;
    }
    const knopf = zellen[ziel];
    if (!knopf) {
      return;
    }
    for (const zelle of zellen) {
      zelle.tabIndex = -1;
    }
    knopf.tabIndex = 0;
    knopf.focus();
  };

  return (
    <div
      ref={rasterRef}
      className="grid grid-cols-8 gap-1.5"
      role={mitTastatur ? 'grid' : undefined}
      aria-label={mitTastatur ? tx('Symbol') : undefined}
      onKeyDown={mitTastatur ? beiTaste : undefined}
    >
      {ICONS.map((option, index) => {
        const gewaehlt = option === wert;
        const fokus = hatWahl ? gewaehlt : index === 0;
        return (
          <button
            key={option}
            type="button"
            role={mitTastatur ? 'gridcell' : undefined}
            aria-selected={mitTastatur ? gewaehlt : undefined}
            aria-label={option}
            tabIndex={mitTastatur ? (fokus ? 0 : -1) : undefined}
            autoFocus={mitTastatur && fokus ? true : undefined}
            onClick={() => onAendern(option)}
            className={zellenKlasse(gewaehlt)}
            style={gewaehlt ? { color: farbe } : undefined}
          >
            <Icon name={option} className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

function SymbolFeld({
  wert,
  farbe,
  onAendern,
}: {
  wert: string;
  farbe: string;
  onAendern: (icon: (typeof ICONS)[number]) => void;
}) {
  const [offen, setOffen] = useState(false);
  const waehle = (icon: (typeof ICONS)[number]) => {
    onAendern(icon);
    setOffen(false);
  };

  return (
    <>
      <button
        type="button"
        role="combobox"
        aria-label={`${tx('Symbol')} · ${wert}`}
        aria-expanded={offen}
        aria-haspopup="dialog"
        data-zeilen="1"
        className={`${EINGABE_STIL} zeile flex h-12 w-full items-center gap-3 text-left`}
        onClick={() => setOffen(true)}
      >
        <span className="min-w-0 flex-1 truncate">{tx('Symbol')}</span>
        <Icon name={wert} className="size-5 shrink-0" style={{ color: farbe }} aria-hidden />
        <ChevronRight className="zeile-pfeil size-5 shrink-0 text-leise" aria-hidden />
      </button>
      <Dialog offen={offen} titel={tx('Symbol')} onSchliessen={() => setOffen(false)}>
        <div className="dialog-auswahl">
          <div className="dialog-auswahl-liste">
            <IconRaster wert={wert} farbe={farbe} onAendern={waehle} mitTastatur />
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function IconAuswahl({
  wert,
  farbe,
  onAendern,
  raster = false,
}: {
  wert: string;
  farbe: string;
  onAendern: (icon: (typeof ICONS)[number]) => void;
  raster?: boolean;
}) {
  if (raster) {
    return <IconRaster wert={wert} farbe={farbe} onAendern={onAendern} />;
  }
  return <SymbolFeld wert={wert} farbe={farbe} onAendern={onAendern} />;
}
