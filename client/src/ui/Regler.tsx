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

const ANTEIL_STIL = `
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
        min={-100}
        max={100}
        step={schritt}
        value={wert}
        aria-valuetext={beschreibung}
        onChange={(ereignis) => onAendern(Number(ereignis.target.value))}
        className="anteil-regler relative w-full"
        style={{ ['--anteil-farbe' as string]: farbe }}
      />
    </div>
  );
}
