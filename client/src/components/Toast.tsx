import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { tx } from '../text.ts';

const ANZEIGE_MS = 5000;

/** Kurze Rückmeldung mit höchstens einer Aktion. Fokus hält die Zeit an. */
export function Toast({
  text,
  rolle,
  aktion,
  aktionLabel,
  onEnde,
}: {
  text: string;
  rolle: 'status' | 'alert';
  aktion?: () => void;
  aktionLabel?: string;
  onEnde: () => void;
}) {
  const ende = useRef(onEnde);
  ende.current = onEnde;

  useEffect(() => {
    let timer = 0;
    let pause = false;
    let rest = ANZEIGE_MS;
    let start = 0;
    const plan = () => {
      start = performance.now();
      timer = window.setTimeout(() => ende.current(), rest);
    };
    const wurzel = () => document.getElementById('toast-wurzel');
    const beiFokus = (ereignis: FocusEvent) => {
      const kasten = wurzel();
      if (!kasten?.contains(ereignis.target as Node) || pause) {
        return;
      }
      pause = true;
      window.clearTimeout(timer);
      rest = Math.max(0, rest - (performance.now() - start));
    };
    const beiBlur = (ereignis: FocusEvent) => {
      const kasten = wurzel();
      const neu = ereignis.relatedTarget;
      if (!pause || (neu instanceof Node && kasten?.contains(neu))) {
        return;
      }
      pause = false;
      plan();
    };
    plan();
    document.addEventListener('focusin', beiFokus);
    document.addEventListener('focusout', beiBlur);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('focusin', beiFokus);
      document.removeEventListener('focusout', beiBlur);
    };
  }, []);

  return createPortal(
    <div className="toast-lage pointer-events-none fixed inset-x-0 flex justify-center px-4">
      <div
        id="toast-wurzel"
        role={rolle}
        className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-rand bg-flaeche px-4 py-2 shadow-lg"
      >
        <span className="min-w-0 flex-1 text-sm break-words">{tx(text)}</span>
        {aktion && aktionLabel ? (
          <button
            type="button"
            className="inline-flex min-h-12 shrink-0 items-center px-2 text-sm font-medium text-akzent"
            onClick={aktion}
          >
            {tx(aktionLabel)}
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
