import { X } from 'lucide-react';
import { useId, useLayoutEffect, useState, type ReactNode } from 'react';
import { tx } from '../text.ts';
import { Fehlermeldung } from './Anzeige.tsx';

const FOKUS_WAHL = 'a[href], button, input, select, textarea, [tabindex]';

type Aktion = { label: string; onClick: () => void };
type Detail = { label: string; inhalt: ReactNode };
type Phase = 'zu' | 'auf' | 'offen';

type HinweisZeileProps = {
  text: string;
  onSchliessen: () => void;
  schliessenLabel?: string;
  fehler?: unknown;
} & ({ aktion: Aktion; detail?: never } | { detail: Detail; aktion?: never });

function sichtbar(element: HTMLElement): boolean {
  if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') {
    return false;
  }
  if (element.tabIndex < 0) {
    return false;
  }
  const stil = getComputedStyle(element);
  if (stil.display === 'none' || stil.visibility === 'hidden') {
    return false;
  }
  return element.getClientRects().length > 0;
}

function erstesFokussierbar(wurzel: ParentNode): HTMLElement | null {
  for (const element of wurzel.querySelectorAll<HTMLElement>(FOKUS_WAHL)) {
    if (sichtbar(element)) {
      return element;
    }
  }
  return null;
}

function naechstesNach(platz: HTMLElement): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>(FOKUS_WAHL)) {
    if (platz.contains(element) || !sichtbar(element)) {
      continue;
    }
    if (platz.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) {
      return element;
    }
  }
  return null;
}

function ueberschrift(): HTMLElement | null {
  const h1 = document.querySelector('main h1');
  if (!(h1 instanceof HTMLElement)) {
    return null;
  }
  h1.tabIndex = -1;
  return h1;
}

function fokusNachZeile(platz: HTMLElement): void {
  const ziel = erstesFokussierbar(platz) ?? naechstesNach(platz) ?? ueberschrift();
  ziel?.focus();
}

function planeFokus(platz: HTMLElement, knopf: HTMLButtonElement): void {
  let rest = 10;
  const versuch = () => {
    if (!platz.isConnected) {
      return;
    }
    if (knopf.isConnected && rest > 0) {
      rest -= 1;
      requestAnimationFrame(versuch);
      return;
    }
    if (!knopf.isConnected) {
      fokusNachZeile(platz);
    }
  };
  queueMicrotask(versuch);
}

function bewegungReduziert(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function HinweisZeile({ text, aktion, detail, onSchliessen, schliessenLabel, fehler }: HinweisZeileProps) {
  const detailId = useId();
  const [phase, setPhase] = useState<Phase>('zu');
  const label = schliessenLabel ?? tx('Hinweis ausblenden');

  useLayoutEffect(() => {
    if (phase !== 'auf') {
      return;
    }
    const rahmen = requestAnimationFrame(() => setPhase('offen'));
    return () => cancelAnimationFrame(rahmen);
  }, [phase]);

  const umschalten = () => {
    setPhase((bisher) => {
      if (bisher !== 'zu') {
        return 'zu';
      }
      return bewegungReduziert() ? 'offen' : 'auf';
    });
  };

  const schliessen = (knopf: HTMLButtonElement) => {
    const platz = knopf.closest('[data-hinweis-platz]');
    onSchliessen();
    if (platz instanceof HTMLElement) {
      planeFokus(platz, knopf);
    }
  };

  const aufgeklappt = phase === 'offen';

  return (
    <section aria-label={text} className="karte rounded-2xl border border-rand bg-flaeche">
      <div className="flex min-h-11 items-center">
        <p className="min-w-0 flex-1 py-1.5 pl-3 text-sm leading-5 break-words">{text}</p>
        {aktion ? (
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-sm font-medium text-akzent"
            onClick={aktion.onClick}
          >
            {aktion.label}
          </button>
        ) : null}
        {detail ? (
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-sm font-medium text-akzent"
            aria-expanded={phase !== 'zu'}
            aria-controls={detailId}
            onClick={umschalten}
          >
            {detail.label}
          </button>
        ) : null}
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center"
          aria-label={label}
          title={label}
          onClick={(ereignis) => schliessen(ereignis.currentTarget)}
        >
          <X className="size-[18px] text-leise" aria-hidden="true" />
        </button>
      </div>
      {detail ? (
        <div
          className={`grid motion-safe:transition-[grid-template-rows] motion-safe:duration-150 ${aufgeklappt ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
          hidden={phase === 'zu'}
        >
          <div className="min-h-0 overflow-hidden">
            <div id={detailId} className="border-t border-rand px-3 py-2">
              {detail.inhalt}
            </div>
          </div>
        </div>
      ) : null}
      {fehler ? (
        <div className="px-3 pb-2">
          <Fehlermeldung fehler={fehler} />
        </div>
      ) : null}
    </section>
  );
}
