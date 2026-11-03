import { useEffect, useId, useRef, useState, type Ref } from 'react';
import { tx } from '../text.ts';
import { EINGABE_STIL } from './Formular.tsx';
import { Chip } from './Schalter.tsx';

export interface VorschlagOption {
  id: string;
  wert: string;
  zeile: string;
  neben?: string;
  name?: string;
  gesperrt?: boolean;
}

function indexFuer(optionen: readonly VorschlagOption[], text: string): number | null {
  const index = optionen.findIndex((option) => !option.gesperrt && option.wert === text);
  return index >= 0 ? index : null;
}

function reiheSchrift(text: string): string {
  if (text.length > 10) {
    return 'text-[10px] leading-4';
  }
  if (text.length > 8) {
    return 'text-[11px] leading-4';
  }
  return 'text-[13px] leading-4 font-medium';
}

export function VorschlagFeld({
  label,
  text,
  onText,
  optionen,
  eigenLabel = 'Eigener',
  eigenName,
  einheit,
  feldId,
  eingabeRef,
  fehler,
  fehlerId,
  hinweis,
  hinweisId,
  hinweisSchnitt = true,
  onUnscharf,
  onWahl,
  onGesperrt,
  bereinige,
  platzhalter,
  eingabeModus = 'numeric',
  fokus = false,
  anordnung = 'standard',
  unterZeile,
}: {
  label: string;
  text: string;
  onText: (text: string) => void;
  optionen: readonly VorschlagOption[];
  eigenLabel?: string;
  /** Zugänglicher Name, wenn mehrere Felder sonst gleich heißen. */
  eigenName?: string;
  einheit?: string;
  feldId?: string;
  eingabeRef?: Ref<HTMLInputElement>;
  fehler?: string | null;
  fehlerId?: string;
  hinweis?: string | null;
  hinweisId?: string;
  hinweisSchnitt?: boolean;
  onUnscharf?: () => void;
  onWahl?: () => void;
  onGesperrt?: (option: VorschlagOption) => void;
  bereinige?: (roh: string) => string;
  platzhalter?: string;
  eingabeModus?: 'numeric' | 'decimal';
  fokus?: boolean;
  anordnung?: 'standard' | 'reihe';
  unterZeile?: string | null;
}) {
  const generiert = useId();
  const gruppeId = `${generiert}-gruppe`;
  const eigeneId = feldId ?? `${generiert}-feld`;
  const fehlerZiel = fehlerId ?? `${generiert}-fehler`;
  const hinweisZiel = hinweisId ?? `${generiert}-hinweis`;
  const [chipIndex, setChipIndex] = useState<number | null>(() => indexFuer(optionen, text));
  const vonChip = useRef(false);
  const beschrieben = [fehler ? fehlerZiel : '', hinweis ? hinweisZiel : ''].filter(Boolean).join(' ');

  useEffect(() => {
    if (!vonChip.current || chipIndex === null) {
      return;
    }
    const option = optionen[chipIndex];
    if (!option || option.gesperrt) {
      vonChip.current = false;
      setChipIndex(null);
      return;
    }
    if (text !== option.wert) {
      onText(option.wert);
    }
  }, [optionen, chipIndex, text, onText]);

  const gewaehlt =
    chipIndex !== null && optionen[chipIndex] !== undefined && !optionen[chipIndex].gesperrt && optionen[chipIndex].wert === text
      ? chipIndex
      : null;

  const waehle = (index: number) => {
    const option = optionen[index];
    if (!option || option.gesperrt) {
      if (option?.gesperrt) {
        onGesperrt?.(option);
      }
      return;
    }
    vonChip.current = true;
    setChipIndex(index);
    onText(option.wert);
    onWahl?.();
  };

  const reihe = anordnung === 'reihe';

  return (
    <div className="feld block min-w-0 space-y-2" data-feld-fehler={fehler ? '' : undefined}>
      <span id={gruppeId} className="feld-label block text-sm leading-5 font-semibold">
        {tx(label)}
      </span>
      <div
        role="group"
        aria-labelledby={gruppeId}
        className={reihe ? 'grid min-w-0 grid-cols-4 gap-2' : 'flex min-w-0 flex-wrap items-end gap-2'}
      >
        {reihe ? (
          optionen.map((option, index) => {
            const aktiv = gewaehlt === index;
            const fehltId = option.gesperrt && option.neben ? `${generiert}-fehlt-${option.id}` : undefined;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={aktiv}
                aria-disabled={option.gesperrt || undefined}
                aria-label={option.zeile}
                aria-describedby={fehltId}
                onClick={() => waehle(index)}
                className={`flex h-12 min-w-0 items-center justify-center overflow-hidden rounded-lg border px-0.5 ${reiheSchrift(option.zeile)} ${
                  option.gesperrt
                    ? 'border-rand text-leise opacity-40'
                    : aktiv
                      ? 'border-transparent bg-akzent/15 text-haupt'
                      : 'border-rand text-leise'
                }`}
              >
                <span className="max-w-full whitespace-nowrap">{option.zeile}</span>
                {fehltId ? (
                  <span id={fehltId} className="sr-only">
                    {option.neben}
                  </span>
                ) : null}
              </button>
            );
          })
        ) : (
          <div className="grid min-w-0 basis-full grid-cols-3 gap-2 sm:basis-0 sm:flex-1">
            {optionen.map((option, index) => {
              const aktiv = gewaehlt === index;
              const name = option.name ?? (option.neben ? `${option.zeile}, ${option.neben}` : option.zeile);
              return (
                <Chip
                  key={option.id}
                  aktiv={aktiv}
                  gesperrt={option.gesperrt}
                  haken={false}
                  einzeilig={false}
                  name={name}
                  onClick={() => waehle(index)}
                  className="w-full"
                >
                  <span className="flex w-full min-w-0 flex-col items-center justify-center overflow-hidden">
                    <span className="max-w-full truncate text-[12px] leading-[14px]">{option.zeile}</span>
                    {option.neben ? <span className="max-w-full truncate text-[11px] leading-3 text-leise">{option.neben}</span> : null}
                  </span>
                </Chip>
              );
            })}
          </div>
        )}
        {reihe ? (
          <div className="relative min-w-0">
            <input
              ref={eingabeRef}
              id={eigeneId}
              className={`${EINGABE_STIL} h-12 min-w-0 px-1 pr-5 tabular-nums placeholder:text-[12px]`}
              style={{ paddingLeft: 4, paddingRight: 18 }}
              inputMode={eingabeModus}
              autoComplete="off"
              autoFocus={fokus}
              value={text}
              placeholder={platzhalter}
              aria-label={eigenName}
              aria-invalid={fehler ? true : undefined}
              aria-describedby={beschrieben || undefined}
              onChange={(ereignis) => {
                vonChip.current = false;
                setChipIndex(null);
                onText(bereinige ? bereinige(ereignis.target.value) : ereignis.target.value);
              }}
              onBlur={() => onUnscharf?.()}
            />
            {einheit ? (
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-[11px] leading-none text-leise">
                {einheit}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="w-36 shrink-0 space-y-1">
            <label htmlFor={eigeneId} className="feld-label block text-[13px] leading-[18px] text-leise">
              {tx(eigenLabel)}
            </label>
            <div className="relative min-w-0">
              <input
                ref={eingabeRef}
                id={eigeneId}
                className={`${EINGABE_STIL} ${einheit ? 'pr-9' : ''} tabular-nums`}
                inputMode={eingabeModus}
                autoComplete="off"
                autoFocus={fokus}
                value={text}
                placeholder={platzhalter}
                aria-label={eigenName}
                aria-invalid={fehler ? true : undefined}
                aria-describedby={beschrieben || undefined}
                onChange={(ereignis) => {
                  vonChip.current = false;
                  setChipIndex(null);
                  onText(bereinige ? bereinige(ereignis.target.value) : ereignis.target.value);
                }}
                onBlur={() => onUnscharf?.()}
              />
              {einheit ? (
                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-sm text-leise">
                  {einheit}
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>
      {unterZeile ? <p className="text-[13px] leading-[18px] break-words text-haupt">{unterZeile}</p> : null}
      {fehler ? (
        <p id={fehlerZiel} className="feld-fehler text-[13px] leading-[18px] break-words text-gefahr" role="alert">
          <span aria-hidden="true">⚠ </span>
          {fehler}
        </p>
      ) : null}
      {hinweis ? (
        <p id={hinweisZiel} className={`feld-hilfe text-[13px] leading-[18px] text-leise ${hinweisSchnitt ? 'truncate' : 'break-words'}`}>
          {hinweis}
        </p>
      ) : null}
    </div>
  );
}
