import { Info } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { attributName, tx } from '../text.ts';
import { XpAbzug } from './Anzeige.tsx';

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

const HINWEIS = 'Lvl zu niedrig';
const HINWEIS_SCHRIFT = 'text-[13px] leading-[18px]';
const ZEICHEN_SCHRIFT = 'text-[16px] leading-none';
/** Der Name behält mindestens so viel, kürzere Namen bleiben ganz sichtbar. */
const NAME_MIN_PX = 48;

export function zustandNurZeichen(eingabe: {
  zeilenBreite: number;
  nameBreite: number;
  textBreite: number;
  zeichenBreite: number;
  abzugBreite: number;
  luecke: number;
}): boolean {
  const nameMin = Math.min(Math.max(0, eingabe.nameBreite), NAME_MIN_PX);
  const gruppen = 2 + (eingabe.abzugBreite > 0 ? 1 : 0);
  const aussen = eingabe.luecke * (gruppen - 1);
  const warnung = eingabe.zeichenBreite + eingabe.luecke + eingabe.textBreite;
  const frei = eingabe.zeilenBreite - aussen - warnung - eingabe.abzugBreite;
  return frei < nameMin;
}

function zustandZeichen() {
  return (
    <span aria-hidden="true" className={`shrink-0 text-gefahr ${ZEICHEN_SCHRIFT}`}>
      ⚠
    </span>
  );
}

export function ZuNiedrigHinweis({ nurZeichen = false }: { nurZeichen?: boolean }) {
  if (nurZeichen) {
    return (
      <span data-zustand="zu-niedrig" className={`inline-flex shrink-0 items-center whitespace-nowrap text-gefahr ${HINWEIS_SCHRIFT}`}>
        <InfoHinweis
          text="Lvl zu niedrig"
          label="Lvl zu niedrig"
          kompakt
          abstand={false}
          knopfKlasse="relative inline-flex shrink-0 items-center justify-center leading-none before:absolute before:-inset-4 before:content-['']"
          icon={zustandZeichen()}
        />
      </span>
    );
  }
  return (
    <span data-zustand="zu-niedrig" className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-gefahr ${HINWEIS_SCHRIFT}`}>
      {zustandZeichen()}
      <span className="text-gefahr">{tx(HINWEIS)}</span>
    </span>
  );
}

function missBreite(text: string, klasse: string): number {
  const probe = document.createElement('span');
  probe.className = klasse;
  probe.textContent = text;
  probe.style.position = 'fixed';
  probe.style.left = '0';
  probe.style.top = '0';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.whiteSpace = 'nowrap';
  document.body.append(probe);
  const breite = probe.offsetWidth;
  probe.remove();
  return breite;
}

function lueckeVon(knoten: HTMLElement): number {
  const wert = Number.parseFloat(getComputedStyle(knoten).columnGap);
  return Number.isFinite(wert) ? wert : 4;
}

export function AttributBezeichnung({
  name,
  kennung,
  prozent,
  zuNiedrig = false,
  schrift = 'text-sm',
}: {
  name: string;
  kennung?: string | null;
  prozent: number | null;
  zuNiedrig?: boolean;
  schrift?: string;
}) {
  const zeile = useRef<HTMLSpanElement>(null);
  const [nurZeichen, setNurZeichen] = useState(false);

  useLayoutEffect(() => {
    const knoten = zeile.current;
    if (!knoten || !zuNiedrig) {
      setNurZeichen(false);
      return;
    }
    const pruefe = () => {
      const nameEl = knoten.querySelector('[data-attribut-name]');
      if (!(nameEl instanceof HTMLElement)) {
        return;
      }
      const abzug = knoten.querySelector('[data-abzug="ziel"]');
      const nur = zustandNurZeichen({
        zeilenBreite: knoten.clientWidth,
        nameBreite: nameEl.scrollWidth,
        textBreite: missBreite(tx(HINWEIS), HINWEIS_SCHRIFT),
        zeichenBreite: missBreite('⚠', ZEICHEN_SCHRIFT),
        abzugBreite: abzug instanceof HTMLElement ? abzug.offsetWidth : 0,
        luecke: lueckeVon(knoten),
      });
      setNurZeichen((alt) => (alt === nur ? alt : nur));
    };
    pruefe();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const beobachter = new ResizeObserver(pruefe);
    beobachter.observe(knoten);
    let aktiv = true;
    void document.fonts.ready.then(() => {
      if (aktiv) {
        pruefe();
      }
    });
    return () => {
      aktiv = false;
      beobachter.disconnect();
    };
  }, [zuNiedrig, prozent, name, kennung, schrift]);

  const sichtbar = attributName({ name, kennung });
  return (
    <span ref={zeile} className="flex min-w-0 flex-1 flex-nowrap items-center gap-1">
      <span data-attribut-name="" className={`min-w-0 truncate ${schrift}`}>
        {sichtbar}
      </span>
      {zuNiedrig ? <ZuNiedrigHinweis nurZeichen={nurZeichen} /> : null}
      {prozent !== null ? <XpAbzug prozent={prozent} schrift="text-[13px] leading-[18px]" /> : null}
    </span>
  );
}
