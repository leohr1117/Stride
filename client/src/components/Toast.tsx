import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { tx } from '../text.ts';

const ANZEIGE_MS = 5000;

/** Kurze Rückmeldung mit höchstens einer Aktion. Fokus hält die Zeit an, der Zeiger nur wenn gewünscht. */
export function Toast({
  text,
  rolle,
  aktion,
  aktionLabel,
  onEnde,
  dauerMs = ANZEIGE_MS,
  pauseBeiZeiger = false,
  wurzelId = 'toast-wurzel',
  markierung,
}: {
  text: string;
  rolle: 'status' | 'alert';
  aktion?: () => void;
  aktionLabel?: string;
  onEnde: () => void;
  dauerMs?: number;
  pauseBeiZeiger?: boolean;
  wurzelId?: string;
  markierung?: string;
}) {
  const ende = useRef(onEnde);
  ende.current = onEnde;

  useEffect(() => {
    let timer = 0;
    let pause = false;
    let fokus = false;
    let zeiger = false;
    let rest = dauerMs;
    let start = 0;
    const plan = () => {
      start = performance.now();
      timer = window.setTimeout(() => ende.current(), rest);
    };
    const halte = () => {
      const aktiv = fokus || zeiger;
      if (aktiv && !pause) {
        pause = true;
        window.clearTimeout(timer);
        rest = Math.max(0, rest - (performance.now() - start));
        return;
      }
      if (!aktiv && pause) {
        pause = false;
        plan();
      }
    };
    const wurzel = () => document.getElementById(wurzelId);
    const beiFokus = (ereignis: FocusEvent) => {
      const kasten = wurzel();
      if (!kasten?.contains(ereignis.target as Node)) {
        return;
      }
      fokus = true;
      halte();
    };
    const beiBlur = (ereignis: FocusEvent) => {
      const kasten = wurzel();
      const neu = ereignis.relatedTarget;
      if (neu instanceof Node && kasten?.contains(neu)) {
        return;
      }
      if (!fokus) {
        return;
      }
      fokus = false;
      halte();
    };
    const beiEnter = () => {
      zeiger = true;
      halte();
    };
    const beiLeave = () => {
      zeiger = false;
      halte();
    };
    plan();
    document.addEventListener('focusin', beiFokus);
    document.addEventListener('focusout', beiBlur);
    const kasten = wurzel();
    if (pauseBeiZeiger && kasten) {
      kasten.addEventListener('mouseenter', beiEnter);
      kasten.addEventListener('mouseleave', beiLeave);
    }
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('focusin', beiFokus);
      document.removeEventListener('focusout', beiBlur);
      kasten?.removeEventListener('mouseenter', beiEnter);
      kasten?.removeEventListener('mouseleave', beiLeave);
    };
  }, [dauerMs, pauseBeiZeiger, wurzelId]);

  return createPortal(
    <div className="toast-lage pointer-events-none fixed inset-x-0 flex justify-center px-4">
      <div
        id={wurzelId}
        role={rolle}
        data-dauer={dauerMs}
        data-update-hinweis={markierung === 'update' ? '' : undefined}
        className="pointer-events-auto flex min-w-0 max-w-[min(100%,28rem)] items-center gap-3 rounded-2xl border border-rand bg-flaeche px-4 py-2 shadow-lg"
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
