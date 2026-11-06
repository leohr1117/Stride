import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { tx } from '../../text.ts';

const AUSLASSUNG = '…';

/** Längste zuerst. Die erste Fassung ist der volle Text. */
export function waehleFassung(fassungen: readonly string[], passt: (text: string) => boolean): string {
  const voll = fassungen[0] ?? '';
  for (const text of fassungen) {
    if (passt(text)) return text;
  }
  return aufZeichen(voll, passt);
}

export function staerktFassungen(teile: readonly string[]): readonly string[] {
  const voll = tx('Stärkt: {liste}', { liste: teile.join(' · ') });
  const fassungen = [voll];
  for (let anzahl = teile.length - 1; anzahl >= 1; anzahl--) {
    fassungen.push(tx('Stärkt: {liste}', { liste: `${teile.slice(0, anzahl).join(' · ')} · ${AUSLASSUNG}` }));
  }
  const nur = tx('Stärkt: {liste}', { liste: AUSLASSUNG });
  if (fassungen[fassungen.length - 1] !== nur) fassungen.push(nur);
  return fassungen;
}

export function satzFassungen(voll: string): readonly string[] {
  const fassungen = [voll];
  const woerter = voll.split(/\s+/u).filter((wort) => wort.length > 0);
  for (let anzahl = woerter.length - 1; anzahl >= 1; anzahl--) {
    fassungen.push(`${woerter.slice(0, anzahl).join(' ')} ${AUSLASSUNG}`);
  }
  if (fassungen[fassungen.length - 1] !== AUSLASSUNG) fassungen.push(AUSLASSUNG);
  return fassungen;
}

function stammBis(voll: string, max: number): string {
  const roh = voll.slice(0, Math.max(0, max)).replace(/[\s·]+$/u, '');
  if (roh.length < 12) return roh;
  const bruch = Math.max(roh.lastIndexOf(' '), roh.lastIndexOf('·'));
  if (bruch >= 8) return roh.slice(0, bruch).replace(/[\s·]+$/u, '');
  return roh;
}

function aufZeichen(voll: string, passt: (text: string) => boolean): string {
  if (!passt(AUSLASSUNG)) return voll;
  let beste = AUSLASSUNG;
  let unten = 1;
  let oben = voll.length;
  while (unten <= oben) {
    const mitte = (unten + oben) >> 1;
    const stamm = stammBis(voll, mitte);
    const text = `${stamm}${AUSLASSUNG}`;
    if (stamm.length > 0 && passt(text)) {
      beste = text;
      unten = mitte + 1;
    } else {
      oben = mitte - 1;
    }
  }
  return beste;
}

function imElement(el: HTMLElement, fassungen: readonly string[]): string {
  const breite = el.clientWidth;
  if (breite <= 0) return fassungen[0] ?? '';
  const passt = (text: string) => {
    el.textContent = text;
    return el.scrollWidth <= breite;
  };
  const gewaehlt = waehleFassung(fassungen, passt);
  el.textContent = gewaehlt;
  return gewaehlt;
}

export function GekuerzteNebenzeile({
  fassungen,
  className,
  als = 'p',
  anteile = false,
}: {
  fassungen: readonly string[];
  className: string;
  als?: 'p' | 'span';
  anteile?: boolean;
}) {
  const voll = fassungen[0] ?? '';
  const schluessel = fassungen.join('\u0000');
  const ref = useRef<HTMLElement>(null);
  const [stand, setStand] = useState({ schluessel, text: voll });
  if (stand.schluessel !== schluessel) {
    setStand({ schluessel, text: voll });
  }
  const sichtbar = stand.schluessel === schluessel ? stand.text : voll;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let aktiv = true;
    const waehle = () => {
      if (!aktiv || !ref.current) return;
      const text = imElement(ref.current, fassungen);
      setStand((alt) => (alt.schluessel === schluessel && alt.text === text ? alt : { schluessel, text }));
    };
    waehle();
    const beobachter = new ResizeObserver(waehle);
    beobachter.observe(el);
    void document.fonts?.ready.then(waehle);
    return () => {
      aktiv = false;
      beobachter.disconnect();
    };
  }, [schluessel, fassungen]);

  const merkmal = anteile ? { 'data-anteile-text': '' } : {};
  if (als === 'span') {
    return (
      <span ref={ref as RefObject<HTMLSpanElement>} className={className} aria-label={voll} {...merkmal}>
        {sichtbar}
      </span>
    );
  }
  return (
    <p ref={ref as RefObject<HTMLParagraphElement>} className={className} aria-label={voll} {...merkmal}>
      {sichtbar}
    </p>
  );
}
