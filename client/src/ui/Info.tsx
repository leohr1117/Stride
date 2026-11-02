import { Info } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { tx } from '../text.ts';

export function InfoHinweis({
  text,
  name,
  label,
  icon,
  kompakt = false,
  knopfKlasse,
  abstand = true,
  amKasten = false,
}: {
  text: string;
  name?: string;
  label?: string;
  icon?: ReactNode;
  kompakt?: boolean;
  knopfKlasse?: string;
  /** Abstand zum vorausgehenden Namen. Das Ausrufezeichen sitzt bewusst direkt am Namen. */
  abstand?: boolean;
  /** Unter dem Kasten zentrieren, statt direkt unter dem Icon. Die Zahlen im Kasten bleiben frei. */
  amKasten?: boolean;
}) {
  const bezogenerName = name ? tx(name) : '';
  const labelText = label ? tx(label) : bezogenerName ? tx('Info zu {name}', { name: bezogenerName }) : tx('Info');
  const hinweis = tx(text);
  const [offen, setOffen] = useState(false);
  const [ort, setOrt] = useState<{ top: number; left: number } | null>(null);
  const rahmen = useRef<HTMLSpanElement>(null);
  const popup = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!offen) {
      return;
    }
    const zu = (ereignis: PointerEvent) => {
      const ziel = ereignis.target as Node;
      if (!rahmen.current?.contains(ziel) && !popup.current?.contains(ziel)) {
        setOffen(false);
      }
    };
    const taste = (ereignis: KeyboardEvent) => {
      if (ereignis.key === 'Escape') {
        ereignis.stopPropagation();
        setOffen(false);
      }
    };
    document.addEventListener('pointerdown', zu);
    document.addEventListener('keydown', taste);
    return () => {
      document.removeEventListener('pointerdown', zu);
      document.removeEventListener('keydown', taste);
    };
  }, [offen]);

  useLayoutEffect(() => {
    if (!offen) {
      setOrt(null);
      return;
    }
    const legeAus = () => {
      const knopf = rahmen.current?.getBoundingClientRect();
      const kasten = popup.current?.getBoundingClientRect();
      if (!knopf || !kasten) {
        return;
      }
      const rand = 8;
      const feld = amKasten ? rahmen.current?.closest('[data-info-kasten]')?.getBoundingClientRect() : null;
      const anker = feld ?? knopf;
      let left = feld ? anker.left + (anker.width - kasten.width) / 2 : anker.left;
      if (left + kasten.width > window.innerWidth - rand) {
        left = window.innerWidth - rand - kasten.width;
      }
      left = Math.max(rand, left);
      let top = anker.bottom + 4;
      if (top + kasten.height > window.innerHeight - rand) {
        const darueber = anker.top - kasten.height - 4;
        top = darueber >= rand ? darueber : rand;
      }
      setOrt({ top, left });
    };
    legeAus();
    window.addEventListener('resize', legeAus);
    window.addEventListener('scroll', legeAus, true);
    return () => {
      window.removeEventListener('resize', legeAus);
      window.removeEventListener('scroll', legeAus, true);
    };
  }, [offen, hinweis, amKasten]);

  const stil: CSSProperties = {
    position: 'fixed',
    top: ort?.top ?? 0,
    left: ort?.left ?? 0,
    zIndex: 100,
    visibility: ort ? 'visible' : 'hidden',
  };

  return (
    <span
      ref={rahmen}
      className={`pointer-events-auto relative z-10 flex shrink-0 items-center self-center leading-none ${abstand ? 'ms-1.5' : ''}`}
    >
      <button
        type="button"
        aria-label={labelText}
        aria-expanded={offen}
        onPointerDown={(ereignis) => ereignis.stopPropagation()}
        onClick={(ereignis) => {
          ereignis.stopPropagation();
          setOffen((wert) => !wert);
          if (ereignis.detail !== 0) {
            ereignis.currentTarget.blur();
          }
        }}
        className={knopfKlasse ?? 'inline-flex size-11 items-center justify-center rounded-full text-leise hover:text-haupt'}
      >
        {icon ?? <Info className="size-4" strokeWidth={1.75} />}
      </button>
      {offen &&
        createPortal(
          <span
            ref={popup}
            role="tooltip"
            style={stil}
            className={`${kompakt ? 'w-max' : 'w-56'} max-w-[calc(100vw-1rem)] rounded-xl border border-rand bg-flaeche p-3 text-left text-xs font-normal break-words tracking-normal text-haupt normal-case shadow-lg`}
          >
            {hinweis}
          </span>,
          document.body,
        )}
    </span>
  );
}

export function ZuNiedrigHinweis() {
  return (
    <InfoHinweis
      text={tx("Lvl zu niedrig")}
      label={tx("Lvl zu niedrig")}
      kompakt
      abstand={false}
      knopfKlasse="inline-flex size-8 items-center justify-center rounded-full"
      icon={
        <span aria-hidden="true" className="flex size-4 items-center justify-center rounded-full bg-gefahr text-[11px] leading-none font-bold text-gefahr-text">
          !
        </span>
      }
    />
  );
}
