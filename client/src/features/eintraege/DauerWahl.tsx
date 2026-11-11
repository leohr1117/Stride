import { useEffect, useId, useRef, type RefObject } from 'react';
import { DAUER_OPTIONEN } from '../../../../shared/spiel/begriffe.ts';
import { tx } from '../../text.ts';
import { Chip, EINGABE_STIL } from '../../ui/index.ts';
import {
  SCHNELL_DAUER,
  bereinigeDauer,
  dauerTextZuZahl,
  schreibweiseAusRoh,
  type DauerStand,
} from '../dauerFeld.ts';

function labelFuer(stunden: number): string {
  const option = DAUER_OPTIONEN.find((eintrag) => eintrag.stunden === stunden);
  return tx(option?.label ?? String(stunden));
}

/**
 * Feste Dauerzeile. Der Innenabstand ist enger als beim normalen Chip,
 * damit fünf Beschriftungen und der Haken bei 390 px in einer Zeile bleiben.
 */
function DauerChip({ aktiv, name, onClick }: { aktiv: boolean; name: string; onClick: () => void }) {
  return (
    <Chip aktiv={aktiv} einzeilig={false} onClick={onClick}>
      <span className="-mx-1.5 whitespace-nowrap">{name}</span>
    </Chip>
  );
}

export function DauerWahl({
  stand,
  onAendern,
  fehler,
  eingabeRef,
}: {
  stand: DauerStand;
  onAendern: (stand: DauerStand) => void;
  fehler: string | null;
  eingabeRef: RefObject<HTMLInputElement | null>;
}) {
  const basis = useId();
  const labelId = `${basis}-dauer`;
  const feldId = `${basis}-feld`;
  const fehlerId = `${basis}-fehler`;
  const fokusInsFeld = useRef(false);

  useEffect(() => {
    if (!stand.eigene || !fokusInsFeld.current) {
      return;
    }
    fokusInsFeld.current = false;
    eingabeRef.current?.focus();
  }, [stand.eigene, eingabeRef]);

  const waehleSchnell = (stunden: number) => {
    fokusInsFeld.current = false;
    if (!stand.eigene && stand.stunden === stunden) {
      onAendern({ stunden: null, text: '', eigene: false });
      return;
    }
    onAendern({ stunden, text: '', eigene: false });
  };

  const waehleEigene = () => {
    if (stand.eigene) {
      fokusInsFeld.current = false;
      onAendern({ stunden: null, text: '', eigene: false });
      return;
    }
    fokusInsFeld.current = true;
    onAendern({ stunden: null, text: '', eigene: true });
  };

  return (
    <div className="space-y-2">
      <span id={labelId} className="feld-label block text-sm leading-5 font-semibold">
        {tx('Dauer')}
      </span>
      <div role="group" aria-labelledby={labelId} className="space-y-2">
        <div
          data-dauer-zeile=""
          className="flex min-w-0 max-w-full flex-nowrap items-center gap-2 overflow-x-clip touch-pan-y"
        >
          {SCHNELL_DAUER.map((stunden) => (
            <DauerChip
              key={stunden}
              aktiv={!stand.eigene && stand.stunden === stunden}
              name={labelFuer(stunden)}
              onClick={() => waehleSchnell(stunden)}
            />
          ))}
          <DauerChip aktiv={stand.eigene} name={tx('Eigene')} onClick={waehleEigene} />
        </div>
        {stand.eigene ? (
          <div className="space-y-1">
            <label htmlFor={feldId} className="feld-label block text-[13px] leading-[18px] text-leise">
              {tx('Dauer in Std')}
            </label>
            <input
              ref={eingabeRef}
              id={feldId}
              className={`${EINGABE_STIL} tabular-nums`}
              inputMode="decimal"
              autoComplete="off"
              value={stand.text}
              aria-invalid={fehler ? true : undefined}
              aria-describedby={fehler ? fehlerId : undefined}
              onChange={(ereignis) => {
                const text = schreibweiseAusRoh(ereignis.target.value);
                const pruefung = dauerTextZuZahl(bereinigeDauer(text));
                onAendern({ eigene: true, text, stunden: pruefung.stunden });
              }}
            />
            {fehler ? (
              <p id={fehlerId} className="feld-fehler text-[13px] leading-[18px] break-words text-gefahr" role="alert">
                <span aria-hidden="true">⚠ </span>
                {fehler}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
