import { useEffect, useRef, type InputHTMLAttributes, type PointerEvent as ReactPointerEvent } from 'react';

function istTextfeld(ziel: EventTarget | null): ziel is HTMLElement {
  if (ziel instanceof HTMLTextAreaElement) {
    return true;
  }
  if (!(ziel instanceof HTMLInputElement)) {
    return ziel instanceof HTMLElement && ziel.isContentEditable;
  }
  return (
    ziel.type !== 'range' &&
    ziel.type !== 'checkbox' &&
    ziel.type !== 'radio' &&
    ziel.type !== 'button' &&
    ziel.type !== 'submit' &&
    ziel.type !== 'file' &&
    ziel.type !== 'color' &&
    ziel.type !== 'hidden'
  );
}

function blendeTextfeldAus(regler: HTMLInputElement): void {
  const aktiv = document.activeElement;
  if (aktiv instanceof HTMLElement && aktiv !== regler && istTextfeld(aktiv)) {
    aktiv.blur();
  }
}

export function Regler({
  className = '',
  onPointerDown,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode'>) {
  const endeRef = useRef<(() => void) | null>(null);

  useEffect(() => () => endeRef.current?.(), []);

  const beginne = (ereignis: ReactPointerEvent<HTMLInputElement>) => {
    const regler = ereignis.currentTarget;
    endeRef.current?.();
    // iOS lässt beim Schieben den Fokus im Textfeld und öffnet die Tastatur.
    blendeTextfeldAus(regler);
    let sperre = false;
    const beiFokus = (fokus: FocusEvent) => {
      if (sperre || fokus.target === regler || !istTextfeld(fokus.target)) {
        return;
      }
      sperre = true;
      fokus.target.blur();
      sperre = false;
    };
    const ende = () => {
      window.removeEventListener('pointerup', ende);
      window.removeEventListener('pointercancel', ende);
      document.removeEventListener('focusin', beiFokus, true);
      if (endeRef.current === ende) {
        endeRef.current = null;
      }
      blendeTextfeldAus(regler);
    };
    endeRef.current = ende;
    document.addEventListener('focusin', beiFokus, true);
    window.addEventListener('pointerup', ende);
    window.addEventListener('pointercancel', ende);
    onPointerDown?.(ereignis);
  };

  return (
    <input
      {...rest}
      type="range"
      inputMode="none"
      onPointerDown={beginne}
      className={className === '' ? 'regler' : `regler ${className}`}
    />
  );
}

const ANTEIL_MIN = -100;
const ANTEIL_MAX = 100;
const GRIFF_BREITE_PX = 20;
const WAAGRECHT_SCHWELLE_PX = 8;
const WAAGRECHT_ZU_SENKRECHT = 2;

type GesteArt = 'offen' | 'waagrecht' | 'griff' | 'senkrecht';

interface AnteilGeste {
  id: number;
  x: number;
  y: number;
  wert: number;
  letzter: number;
  art: GesteArt;
  griff: boolean;
  scrollStart: number;
  geaendert: boolean;
}

function rasteAnteil(roh: number, step: number): number {
  if (!(step > 0) || !Number.isFinite(roh)) {
    return 0;
  }
  const schritte = Math.round((roh - ANTEIL_MIN) / step);
  const wert = Math.min(ANTEIL_MAX, Math.max(ANTEIL_MIN, ANTEIL_MIN + schritte * step));
  if (Math.abs(wert) < 1e-9) {
    return 0;
  }
  return wert;
}

function wertAusFinger(clientX: number, kasten: DOMRect, step: number): number {
  if (kasten.width <= 0) {
    return 0;
  }
  const anteil = Math.min(1, Math.max(0, (clientX - kasten.left) / kasten.width));
  return rasteAnteil(ANTEIL_MIN + anteil * (ANTEIL_MAX - ANTEIL_MIN), step);
}

function aufGriff(clientX: number, kasten: DOMRect, wert: number): boolean {
  if (kasten.width <= 0) {
    return false;
  }
  const anteil = (wert - ANTEIL_MIN) / (ANTEIL_MAX - ANTEIL_MIN);
  return Math.abs(clientX - (kasten.left + anteil * kasten.width)) <= GRIFF_BREITE_PX / 2;
}

function scrollFeld(start: HTMLElement): HTMLElement | null {
  let knoten = start.parentElement;
  while (knoten) {
    const stil = getComputedStyle(knoten);
    if ((stil.overflowY === 'auto' || stil.overflowY === 'scroll') && knoten.scrollHeight > knoten.clientHeight + 1) {
      return knoten;
    }
    knoten = knoten.parentElement;
  }
  return null;
}

function schiebeFormular(regler: HTMLElement, geste: AnteilGeste, clientY: number): void {
  const feld = scrollFeld(regler);
  if (!feld) {
    return;
  }
  const ziel = geste.scrollStart - (clientY - geste.y);
  if (Math.abs(feld.scrollTop - ziel) > 0.5) {
    feld.scrollTop = ziel;
  }
}

function erkenneRichtung(geste: AnteilGeste, dx: number, dy: number): GesteArt | null {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (geste.griff) {
    if (absY >= WAAGRECHT_SCHWELLE_PX && absY >= absX) {
      return 'senkrecht';
    }
    if (absX >= WAAGRECHT_SCHWELLE_PX && absX > absY) {
      return 'griff';
    }
    return null;
  }
  if (absX >= WAAGRECHT_SCHWELLE_PX && absX > absY * WAAGRECHT_ZU_SENKRECHT) {
    return 'waagrecht';
  }
  if (absY >= WAAGRECHT_SCHWELLE_PX && absY >= absX) {
    return 'senkrecht';
  }
  return null;
}

const ANTEIL_STIL = `
.regler.anteil-regler {
  touch-action: pan-y;
}
html[data-eingabe='tastatur'] .anteil-regler:focus-visible {
  outline: 2px solid var(--fokus);
  outline-offset: -4px;
}
.anteil-regler {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  height: 48px;
  margin: 0;
  cursor: pointer;
}
.anteil-regler::-webkit-slider-runnable-track {
  height: 48px;
  background: transparent;
  border: 0;
}
.anteil-regler::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  margin-top: 14px;
  border: 0;
  border-radius: 999px;
  background: var(--anteil-farbe, var(--akzent));
}
.anteil-regler::-moz-range-track {
  height: 48px;
  background: transparent;
  border: 0;
}
.anteil-regler::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 999px;
  background: var(--anteil-farbe, var(--akzent));
}
`;

export function AnteilReglerStil() {
  return <style>{ANTEIL_STIL}</style>;
}

export function AnteilRegler({
  wert,
  farbe,
  schritt,
  beschreibung,
  onAendern,
  ...rest
}: {
  wert: number;
  farbe: string;
  schritt: number;
  beschreibung: string;
  onAendern: (wert: number) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode' | 'value' | 'onChange' | 'min' | 'max' | 'step'>) {
  const breite = Math.abs(wert) / 2;
  const links = wert >= 0 ? 50 : 50 - breite;
  const aendernRef = useRef(onAendern);
  const schrittRef = useRef(schritt);
  const wertRef = useRef(wert);
  const gesteRef = useRef<AnteilGeste | null>(null);
  const endeRef = useRef<(() => void) | null>(null);
  const unterdrueckeRef = useRef(false);
  aendernRef.current = onAendern;
  schrittRef.current = schritt;
  wertRef.current = wert;

  useEffect(() => () => endeRef.current?.(), []);

  const setzeFinger = (regler: HTMLInputElement, geste: AnteilGeste, clientX: number) => {
    const naechster = wertAusFinger(clientX, regler.getBoundingClientRect(), schrittRef.current);
    if (naechster === geste.letzter) {
      return;
    }
    geste.letzter = naechster;
    geste.geaendert = true;
    regler.value = String(naechster);
    aendernRef.current(naechster);
  };

  const beiZeiger = (ereignis: ReactPointerEvent<HTMLInputElement>) => {
    if (ereignis.pointerType !== 'touch' || !ereignis.isTrusted) {
      return;
    }
    const regler = ereignis.currentTarget;
    ereignis.preventDefault();
    endeRef.current?.();
    unterdrueckeRef.current = true;
    const startWert = wertRef.current;
    if (regler.value !== String(startWert)) {
      regler.value = String(startWert);
    }
    const geste: AnteilGeste = {
      id: ereignis.pointerId,
      x: ereignis.clientX,
      y: ereignis.clientY,
      wert: startWert,
      letzter: startWert,
      art: 'offen',
      griff: aufGriff(ereignis.clientX, regler.getBoundingClientRect(), startWert),
      scrollStart: scrollFeld(regler)?.scrollTop ?? 0,
      geaendert: false,
    };
    gesteRef.current = geste;
    const passend = (e: PointerEvent) => e.pointerId === geste.id && e.pointerType === 'touch';
    let fertig = false;
    const raeume = () => {
      if (fertig) {
        return;
      }
      fertig = true;
      window.removeEventListener('pointermove', bewege);
      window.removeEventListener('pointerup', ende);
      window.removeEventListener('pointercancel', abbruch);
      if (regler.hasPointerCapture(geste.id)) {
        regler.releasePointerCapture(geste.id);
      }
      if (endeRef.current === raeume) {
        endeRef.current = null;
      }
      gesteRef.current = null;
      queueMicrotask(() => {
        if (gesteRef.current === null) {
          unterdrueckeRef.current = false;
        }
      });
    };
    const bewege = (e: PointerEvent) => {
      if (!passend(e) || fertig) {
        return;
      }
      if (geste.art === 'offen') {
        if (regler.value !== String(geste.wert)) {
          regler.value = String(geste.wert);
        }
        const ziel = erkenneRichtung(geste, e.clientX - geste.x, e.clientY - geste.y);
        if (ziel === null) {
          e.preventDefault();
          return;
        }
        geste.art = ziel;
        if (ziel === 'waagrecht' || ziel === 'griff') {
          if (!regler.hasPointerCapture(e.pointerId)) {
            regler.setPointerCapture(e.pointerId);
          }
        }
      }
      e.preventDefault();
      if (geste.art === 'senkrecht') {
        if (regler.value !== String(geste.wert)) {
          regler.value = String(geste.wert);
        }
        schiebeFormular(regler, geste, e.clientY);
        return;
      }
      setzeFinger(regler, geste, e.clientX);
    };
    const ende = (e: PointerEvent) => {
      if (!passend(e)) {
        return;
      }
      if (geste.art === 'offen') {
        setzeFinger(regler, geste, e.clientX);
      }
      raeume();
    };
    const abbruch = (e: PointerEvent) => {
      if (!passend(e)) {
        return;
      }
      if (geste.geaendert && geste.letzter !== geste.wert) {
        regler.value = String(geste.wert);
        aendernRef.current(geste.wert);
      }
      raeume();
    };
    endeRef.current = raeume;
    window.addEventListener('pointermove', bewege, { passive: false });
    window.addEventListener('pointerup', ende);
    window.addEventListener('pointercancel', abbruch);
  };

  return (
    <div className="relative flex h-12 w-full items-center">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-flaeche-2">
        <span
          className="absolute top-0 h-full rounded-full"
          style={{ left: `${links}%`, width: `${breite}%`, backgroundColor: farbe }}
        />
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2"
        style={{ backgroundColor: 'var(--leise)' }}
      />
      <Regler
        {...rest}
        min={ANTEIL_MIN}
        max={ANTEIL_MAX}
        step={schritt}
        value={wert}
        aria-valuetext={beschreibung}
        onPointerDown={beiZeiger}
        onChange={(ereignis) => {
          if (unterdrueckeRef.current) {
            const geste = gesteRef.current;
            ereignis.currentTarget.value = String(geste ? geste.letzter : wertRef.current);
            if (!geste) {
              unterdrueckeRef.current = false;
            }
            return;
          }
          onAendern(Number(ereignis.target.value));
        }}
        className="anteil-regler relative w-full"
        style={{ ['--anteil-farbe' as string]: farbe }}
      />
    </div>
  );
}
