import { zahl } from '../../format.ts';
import { tx } from '../../text.ts';
import { Flaeche } from '../../ui/index.ts';
import { vergleichSpalten } from './wochenvergleich.ts';

export function WochenvergleichAnsicht({ xp, vorwoche }: { xp: number; vorwoche: number }) {
  return (
    <Flaeche>
      <div className="grid grid-cols-2" data-wochenvergleich="">
        {vergleichSpalten(xp, vorwoche).map((spalte) => (
          <div
            key={spalte.seite}
            className={`min-w-0 px-3 py-3 text-center ${spalte.seite === 'diese' ? 'border-e border-rand' : ''}`}
            data-woche={spalte.seite}
          >
            <p className="zahl text-lg font-bold break-words text-fortschritt" data-wochen-xp="">
              +{zahl(spalte.xp)} XP
            </p>
            <p className="text-xs text-leise" data-wochen-label="">
              {spalte.seite === 'diese' ? tx('Diese Woche') : tx('Vorwoche')}
            </p>
          </div>
        ))}
      </div>
    </Flaeche>
  );
}
