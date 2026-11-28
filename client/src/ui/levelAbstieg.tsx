import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { ChevronUp } from 'lucide-react';
import {
  effektDarfSichBewegen,
  effektStufe,
  levelAbstieg,
  levelAbstiegGroesse,
  wirksameEffektStufe,
} from '../../../shared/spiel/effekte.ts';
import { useFeierGroesse } from '../components/feierLage.ts';
import { gespeicherteEffektStufe } from '../features/darstellung/effektLauf.ts';
import { tx } from '../text.ts';

/** Die Marke bleibt, bis ein Test sie lesen kann. Die Bewegung selbst ist kürzer. */
const DAUER_MS = 2000;

function systemReduziert(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function gewaehlteStufe() {
  if (typeof document !== 'undefined') {
    const gesetzt = document.documentElement.dataset.effekte;
    if (gesetzt) {
      return effektStufe(gesetzt);
    }
  }
  return gespeicherteEffektStufe();
}

function aktuelleStufe() {
  return wirksameEffektStufe(gewaehlteStufe(), systemReduziert());
}

/** Still beim ersten Stand. Danach nur, wenn die Stufe sinkt und kein größerer Effekt läuft. */
export function useLevelAbstieg(level: number): { grau: boolean; bewegt: boolean } {
  const andere = useFeierGroesse();
  const andereRef = useRef(andere);
  const vorher = useRef<number | null>(null);
  const [aktiv, setAktiv] = useState(false);
  const stufe = aktuelleStufe();
  andereRef.current = andere;

  useEffect(() => {
    const alt = vorher.current;
    vorher.current = level;
    if (stufe === 'aus') {
      setAktiv((aktuell) => (aktuell ? false : aktuell));
      return;
    }
    if (alt === null || !levelAbstieg(alt, level)) {
      setAktiv((aktuell) => (aktuell ? false : aktuell));
      return;
    }
    const fremd = andereRef.current === null ? [] : [andereRef.current];
    if (!effektDarfSichBewegen(levelAbstiegGroesse(), fremd)) {
      return;
    }
    setAktiv(true);
    const timer = window.setTimeout(() => {
      setAktiv(false);
    }, DAUER_MS);
    return () => window.clearTimeout(timer);
  }, [level, stufe]);

  if (stufe === 'aus' || !aktiv) {
    return { grau: false, bewegt: false };
  }
  return { grau: true, bewegt: stufe === 'voll' };
}

type StufeProps = {
  level: number;
  className: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLSpanElement>, 'className' | 'children'>;

/** Die Stufe als Zahl. Sinkt sie, wird sie grau und ein Pfeil zeigt nach oben. */
export function LevelStufe({ level, className, children, style, ...rest }: StufeProps) {
  const { grau, bewegt } = useLevelAbstieg(level);
  const klasse = grau
    ? `${className} inline-flex items-center level-zurueck${bewegt ? ' level-zurueck-bewegung' : ''}`
    : className;
  return (
    <span
      {...rest}
      className={klasse}
      data-level-abstieg={grau ? '' : undefined}
      style={grau ? { ...style, color: 'var(--leise)' } : style}
    >
      {children}
      {grau ? (
        <ChevronUp
          className="level-weg ms-0.5 size-3 shrink-0"
          data-level-weg=""
          role="img"
          aria-label={tx('Zurück nach oben')}
        />
      ) : null}
    </span>
  );
}
