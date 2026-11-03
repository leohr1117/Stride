import { useEffect, useRef, useState } from 'react';
import { INVESTITION_GROESSEN, investitionsBonus } from '../../../../shared/spiel/xp.ts';
import { bonusProzent } from '../../format.ts';
import { tx } from '../../text.ts';
import { Regler } from '../../ui/index.ts';

function stufeVon(roh: number): number {
  if (!Number.isFinite(roh)) {
    return 0;
  }
  return Math.min(INVESTITION_GROESSEN.length - 1, Math.max(0, Math.round(roh)));
}

export function GroessenRegler({
  wert,
  onAendern,
  className = 'px-4 py-3',
}: {
  wert: number;
  onAendern: (groesse: number) => void;
  className?: string;
}) {
  const [lokal, setLokal] = useState(() => stufeVon(wert));
  const lokalRef = useRef(stufeVon(wert));
  const zieht = useRef(false);
  const onAendernRef = useRef(onAendern);
  const endeRef = useRef<(() => void) | null>(null);
  onAendernRef.current = onAendern;

  useEffect(() => {
    if (zieht.current) {
      return;
    }
    const naechstes = stufeVon(wert);
    lokalRef.current = naechstes;
    setLokal(naechstes);
  }, [wert]);

  useEffect(() => () => endeRef.current?.(), []);

  const setze = (roh: number) => {
    const naechstes = stufeVon(roh);
    lokalRef.current = naechstes;
    setLokal(naechstes);
    return naechstes;
  };

  const uebernehmen = () => {
    if (!zieht.current) {
      return;
    }
    zieht.current = false;
    endeRef.current = null;
    onAendernRef.current(lokalRef.current);
  };

  const beginne = () => {
    endeRef.current?.();
    zieht.current = true;
    const ende = () => {
      window.removeEventListener('pointerup', ende);
      window.removeEventListener('pointercancel', ende);
      uebernehmen();
    };
    endeRef.current = () => {
      window.removeEventListener('pointerup', ende);
      window.removeEventListener('pointercancel', ende);
    };
    window.addEventListener('pointerup', ende);
    window.addEventListener('pointercancel', ende);
  };

  const prozent = bonusProzent(investitionsBonus(lokal));
  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-leise">{tx("Größe")}</span>
        <span className="zahl font-medium">{prozent}</span>
      </div>
      <div className="touch-none">
        <Regler
          min={0}
          max={3}
          step={1}
          value={lokal}
          aria-label={tx("Größe")}
          aria-valuetext={prozent}
          onPointerDown={beginne}
          onChange={(ereignis) => {
            const naechstes = setze(Number(ereignis.target.value));
            if (!zieht.current) {
              onAendernRef.current(naechstes);
            }
          }}
          className="groesse-regler"
        />
        <div className="flex justify-between px-1" aria-hidden="true">
          {INVESTITION_GROESSEN.map((anteil, index) => (
            <span key={anteil} className={`size-1.5 rounded-full ${index <= lokal ? 'bg-akzent' : 'bg-flaeche-2'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
