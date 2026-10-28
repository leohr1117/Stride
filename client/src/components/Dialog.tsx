import { tx } from '../text.ts';
import { AnimatePresence, usePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { InfoHinweis } from '../ui/Info.tsx';

const offeneDialoge: symbol[] = [];
const AUSBLENDEN_MS = 180;

interface VerlaufDialog {
  id: string;
  href: string;
  schliessen: () => void;
  vomVerlauf: boolean;
}

const verlauf: VerlaufDialog[] = [];
let laufnummer = 0;
let eigenesPop = false;

function istOberster(kennung: symbol): boolean {
  return offeneDialoge[offeneDialoge.length - 1] === kennung;
}

function dialogId(zustand: unknown): string | null {
  if (typeof zustand !== 'object' || zustand === null) {
    return null;
  }
  const id = (zustand as { dialog?: unknown }).dialog;
  return typeof id === 'string' ? id : null;
}

function schreibeDialog(id: string, ersetzen: boolean): void {
  const basis = (history.state ?? {}) as Record<string, unknown>;
  const zustand = { ...basis, dialog: id };
  if (ersetzen) {
    history.replaceState(zustand, '');
  } else {
    history.pushState(zustand, '');
  }
}

function beiPop(ereignis: PopStateEvent): void {
  if (eigenesPop) {
    eigenesPop = false;
    ereignis.stopImmediatePropagation();
    const id = dialogId(history.state);
    if (id !== null && !verlauf.some((eintrag) => eintrag.id === id)) {
      eigenesPop = true;
      history.back();
    }
    return;
  }
  const oben = verlauf[verlauf.length - 1];
  if (oben && dialogId(history.state) !== oben.id && location.href === oben.href) {
    ereignis.stopImmediatePropagation();
    oben.vomVerlauf = true;
    oben.schliessen();
    return;
  }
  if (!oben && dialogId(history.state) !== null) {
    ereignis.stopImmediatePropagation();
    history.back();
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', beiPop, true);
}

function DialogSchicht({
  titel,
  info,
  vorTitel,
  onSchliessen,
  children,
}: {
  titel: string;
  info?: string;
  vorTitel?: ReactNode;
  onSchliessen: () => void;
  children: ReactNode;
}) {
  const [anwesend, entfernen] = usePresence();
  const entfernenRef = useRef(entfernen);
  entfernenRef.current = entfernen;
  const [bereit, setBereit] = useState(false);

  useEffect(() => {
    if (!anwesend) {
      const timer = window.setTimeout(() => entfernenRef.current?.(), AUSBLENDEN_MS);
      return () => window.clearTimeout(timer);
    }
    // Der Klick nach pointerup liegt in derselben Aufgabe. Erst danach Eingaben annehmen.
    const timer = window.setTimeout(() => setBereit(true), 0);
    return () => window.clearTimeout(timer);
  }, [anwesend]);

  const eingabe = anwesend && bereit;

  return (
    <div className={`fixed inset-0 z-[90] ${eingabe ? '' : 'pointer-events-none'}`}>
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-150 ${anwesend ? 'opacity-100' : 'opacity-0'}`}
        onPointerDown={(ereignis) => {
          if (eingabe && ereignis.target === ereignis.currentTarget) {
            onSchliessen();
          }
        }}
      />
      <div className="dialog-schicht pointer-events-none absolute inset-x-0 flex items-end justify-center md:items-center md:p-6">
        <div
          role={anwesend ? 'dialog' : undefined}
          aria-modal={anwesend ? true : undefined}
          aria-hidden={anwesend ? undefined : true}
          inert={anwesend ? undefined : true}
          aria-label={anwesend ? titel : undefined}
          className={`dialog-fenster pointer-events-auto relative flex w-full min-h-0 flex-col rounded-t-3xl border border-rand bg-flaeche transition duration-150 md:max-w-lg md:rounded-3xl ${
            anwesend ? 'translate-y-0 opacity-100' : 'translate-y-7 opacity-0'
          }`}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 px-5 pt-5 pb-3">
            <div className="flex min-w-0 items-center">
              <h2 className="min-w-0 text-lg font-semibold text-balance break-words">
                {vorTitel}
                <span>{titel}</span>
              </h2>
              {info ? <InfoHinweis text={info} /> : null}
            </div>
            <button
              type="button"
              onClick={onSchliessen}
              aria-label={tx('Schließen')}
              className="shrink-0 rounded-full p-1.5 text-leise transition hover:bg-flaeche-2 hover:text-haupt"
            >
              <X className="size-5" />
            </button>
          </header>
          <div className="dialog-koerper min-h-0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Dialog({
  offen,
  titel,
  info,
  vorTitel,
  onSchliessen,
  children,
}: {
  offen: boolean;
  titel: string;
  info?: string;
  vorTitel?: ReactNode;
  onSchliessen: () => void;
  children: ReactNode;
}) {
  const schliessen = useRef(onSchliessen);
  schliessen.current = onSchliessen;

  useLayoutEffect(() => {
    if (!offen) {
      return;
    }
    const kennung = Symbol('dialog');
    const id = `d${(laufnummer += 1)}`;
    const eintrag: VerlaufDialog = {
      id,
      href: location.href,
      schliessen: () => schliessen.current(),
      vomVerlauf: false,
    };
    const vorher = dialogId(history.state);
    schreibeDialog(id, vorher !== null && !verlauf.some((bekannt) => bekannt.id === vorher));
    verlauf.push(eintrag);
    offeneDialoge.push(kennung);
    const beiTaste = (ereignis: KeyboardEvent) => {
      if (ereignis.key === 'Escape' && istOberster(kennung)) {
        schliessen.current();
      }
    };
    const vorherigerUeberlauf = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', beiTaste);
    return () => {
      const index = verlauf.indexOf(eintrag);
      if (index >= 0) {
        verlauf.splice(index, 1);
      }
      offeneDialoge.splice(offeneDialoge.indexOf(kennung), 1);
      document.body.style.overflow = vorherigerUeberlauf;
      window.removeEventListener('keydown', beiTaste);
      if (eintrag.vomVerlauf) {
        return;
      }
      queueMicrotask(() => {
        if (dialogId(history.state) !== id) {
          return;
        }
        eigenesPop = true;
        history.back();
      });
    };
  }, [offen]);

  return createPortal(
    <AnimatePresence>
      {offen && (
        <DialogSchicht key="dialog" titel={titel} info={info} vorTitel={vorTitel} onSchliessen={onSchliessen}>
          {children}
        </DialogSchicht>
      )}
    </AnimatePresence>,
    document.body,
  );
}
