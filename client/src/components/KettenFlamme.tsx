import { useEffect, useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import {
  ketteDarfSichBewegen,
  ketteMoment,
  ketteMomentGroesse,
  type EffektStufe,
  type KetteMoment,
} from '../../../shared/spiel/effekte.ts';
import { useEffektStufe } from '../features/darstellung/effektLauf.ts';
import { useFeierGroesse } from './feierLage.ts';

/** Die CSS-Animation ist kürzer. Die Marke bleibt, bis sie gelesen werden kann. */
const DAUER_MS: Record<KetteMoment, number> = {
  zucken: 2000,
  meilenstein: 2000,
};

function useKetteFlamme(laenge: number, stufe: EffektStufe): KetteMoment | null {
  const andere = useFeierGroesse();
  const andereRef = useRef(andere);
  const vorher = useRef<number | null>(null);
  const [moment, setMoment] = useState<KetteMoment | null>(null);
  andereRef.current = andere;

  useEffect(() => {
    const alt = vorher.current;
    vorher.current = laenge;
    if (stufe === 'aus') {
      setMoment((aktuell) => (aktuell === null ? aktuell : null));
      return;
    }
    if (alt === null) {
      return;
    }
    const neu = ketteMoment(alt, laenge);
    if (neu === null) {
      setMoment((aktuell) => (aktuell === null ? aktuell : null));
      return;
    }
    const fremd = andereRef.current === null ? [] : [andereRef.current];
    if (!ketteDarfSichBewegen(ketteMomentGroesse(neu), fremd)) {
      return;
    }
    setMoment(neu);
    const timer = window.setTimeout(() => {
      setMoment((aktuell) => (aktuell === neu ? null : aktuell));
    }, DAUER_MS[neu]);
    return () => window.clearTimeout(timer);
  }, [laenge, stufe]);

  return stufe === 'aus' ? null : moment;
}

/** Die Flamme der Kette. Still im Ruhestand, ein Zucken bei plus eins, etwas größer bei 7, 30 und 100. */
export function KettenFlamme({ laenge, className }: { laenge: number; className: string }) {
  const stufe = useEffektStufe();
  const moment = useKetteFlamme(laenge, stufe);
  const bewegt = moment !== null && stufe === 'voll';
  const klasse = bewegt ? (moment === 'meilenstein' ? 'kette-meilenstein' : 'kette-zuckt') : '';
  return (
    <Flame
      className={klasse === '' ? className : `${className} ${klasse}`}
      data-kette-effekt={moment ?? undefined}
    />
  );
}
