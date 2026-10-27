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
