import type { CSSProperties } from 'react';
import { DREYFUS_STUFEN } from '../../../../shared/spiel/begriffe.ts';
import { tx } from '../../text.ts';
import { useSkillToene } from './skillToene.ts';

export function Rangleiste({ level, farbe }: { level: number; farbe: string }) {
  const toene = useSkillToene(farbe);
  let aktuell = 0;
  DREYFUS_STUFEN.forEach((stufe, index) => {
    if (level >= stufe.abLevel) {
      aktuell = index;
    }
  });
  const naechste = DREYFUS_STUFEN[aktuell + 1];

  return (
    <div className="relative">
      <div className="flex items-center">
        {DREYFUS_STUFEN.map((stufe, index) => {
          const erreicht = index <= aktuell;
          return (
            <div key={stufe.name} className="flex flex-1 items-center last:flex-none">
              <div
                data-rang={erreicht ? 'erreicht' : 'offen'}
                className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
                  erreicht ? (index === aktuell ? 'skill-leuchten' : '') : 'border-rand text-leise'
                }`}
                style={
                  erreicht
                    ? ({
                        backgroundColor: toene.tief,
                        backgroundImage: `linear-gradient(to bottom, ${toene.tief}, ${toene.tiefer})`,
                        borderColor: toene.tief,
                        color: '#ffffff',
                        '--skillfarbe': farbe,
                      } as CSSProperties)
                    : undefined
                }
                title={tx('{name} ab Level {level}', { name: tx(stufe.name), level: stufe.abLevel })}
              >
                {index + 1}
              </div>
              {index < DREYFUS_STUFEN.length - 1 && (
                <div
                  className="mx-1 h-0.5 flex-1 rounded-full"
                  style={{ backgroundColor: index < aktuell ? farbe : 'var(--rand)' }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3 text-sm">
        <span className="rang-name min-w-0 font-semibold break-words" style={{ color: toene.text }}>
          {tx(DREYFUS_STUFEN[aktuell].name)}
        </span>
        {naechste && (
          <span className="zahl min-w-0 text-right text-xs text-leise break-words">
            {tx('{name} ab Level {level}', { name: tx(naechste.name), level: naechste.abLevel })}
          </span>
        )}
      </div>
    </div>
  );
}
