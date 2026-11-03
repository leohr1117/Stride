import { useEffect, useId, useRef, useState } from 'react';
import { INVESTITION_GROESSEN, investitionsBonus } from '../../../../shared/spiel/xp.ts';
import type { BetragVorschlag, BetragZeitraum } from '../../../../shared/spiel/betragVorschlag.ts';
import { bonusProzent, zahl } from '../../format.ts';
import { tx } from '../../text.ts';
import { EINGABE_STIL } from '../../ui/index.ts';
import type { BetragProblem } from './zahlungAnzeige.ts';

function fehlerSatz(problem: BetragProblem, verfuegbar: number): string {
  if (problem === 'leer') {
    return tx('Betrag eingeben oder „Nichts“ wählen');
  }
  return tx('Nur {xp} XP verfügbar', { xp: zahl(verfuegbar) });
}

const ZEITRAUM: Record<BetragZeitraum, string> = {
  woche: '1 Woche',
  monat: '1 Monat',
  quartal: '3 Monate',
};

export function BonusSegment({ wert, onAendern }: { wert: number; onAendern: (groesse: number) => void }) {
  const id = useId();
  const schritt = (delta: number) => {
    onAendern(Math.min(INVESTITION_GROESSEN.length - 1, Math.max(0, wert + delta)));
  };
  return (
    <div className="mb-3 space-y-2">
      <span id={id} className="feld-label block text-sm leading-5 font-semibold">
        {tx('Bonus')}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={id}
        className="flex w-full min-w-0 gap-1 rounded-xl bg-flaeche-2 p-1"
        onKeyDown={(ereignis) => {
          if (ereignis.key !== 'ArrowLeft' && ereignis.key !== 'ArrowRight') {
            return;
          }
          ereignis.preventDefault();
          const delta = ereignis.key === 'ArrowRight' ? 1 : -1;
          const naechstes = Math.min(INVESTITION_GROESSEN.length - 1, Math.max(0, wert + delta));
          onAendern(naechstes);
          const knopf = ereignis.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[naechstes];
          knopf?.focus();
        }}
      >
        {INVESTITION_GROESSEN.map((anteil, index) => {
          const an = index === wert;
          return (
            <button
              key={anteil}
              type="button"
              role="radio"
              aria-checked={an}
              tabIndex={an ? 0 : -1}
              onClick={() => schritt(index - wert)}
              className={`flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-lg px-1 text-sm font-medium ${
                an ? 'bg-flaeche text-haupt shadow-sm' : 'text-leise'
              }`}
            >
              {bonusProzent(investitionsBonus(index))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BetragFeld({
  text,
  onText,
  geprueft,
  onGeprueft,
  problem,
  verfuegbar,
  vorschlaege,
  eingabeRef,
  feldId,
  fehlerId,
  hinweisId,
}: {
  text: string;
  onText: (text: string) => void;
  geprueft: boolean;
  onGeprueft: (an: boolean) => void;
  problem: BetragProblem | null;
  verfuegbar: number;
  vorschlaege: readonly BetragVorschlag[];
  eingabeRef: { current: HTMLInputElement | null };
  feldId: string;
  fehlerId: string;
  hinweisId: string;
}) {
  const gruppeId = useId();
  const [chipIndex, setChipIndex] = useState<number | null>(null);
  const vonChip = useRef(false);
  const zeigeFehler = geprueft && problem !== null;
  const beschrieben = [zeigeFehler ? fehlerId : '', hinweisId].filter(Boolean).join(' ');

  useEffect(() => {
    if (!vonChip.current || chipIndex === null) {
      return;
    }
    const vorschlag = vorschlaege[chipIndex];
    if (!vorschlag || vorschlag.xp > verfuegbar) {
      vonChip.current = false;
      setChipIndex(null);
      return;
    }
    const wert = String(vorschlag.xp);
    if (text !== wert) {
      onText(wert);
    }
  }, [vorschlaege, verfuegbar, chipIndex, text, onText]);

  const gewaehlt =
    chipIndex !== null &&
    vorschlaege[chipIndex] !== undefined &&
    String(vorschlaege[chipIndex].xp) === text &&
    vorschlaege[chipIndex].xp <= verfuegbar
      ? chipIndex
      : null;

  const waehle = (index: number) => {
    const vorschlag = vorschlaege[index];
    if (!vorschlag || vorschlag.xp > verfuegbar) {
      return;
    }
    vonChip.current = true;
    setChipIndex(index);
    onText(String(vorschlag.xp));
    onGeprueft(false);
  };

  return (
    <div className="feld block min-w-0 space-y-2" data-feld-fehler={zeigeFehler ? '' : undefined}>
      <span id={gruppeId} className="feld-label block text-sm leading-5 font-semibold">
        {tx('Betrag')}
      </span>
      <div role="group" aria-labelledby={gruppeId} className="flex min-w-0 flex-wrap items-end gap-2">
        <div className="grid min-w-0 basis-full grid-cols-3 gap-2 sm:basis-0 sm:flex-1">
        {vorschlaege.map((vorschlag, index) => {
          const zuTeuer = vorschlag.xp > verfuegbar;
          const neben = zuTeuer
            ? tx('fehlen {xp} XP', { xp: zahl(vorschlag.xp - verfuegbar) })
            : vorschlag.zeitraum
              ? tx(ZEITRAUM[vorschlag.zeitraum])
              : '';
          const xpText = tx('{xp} XP', { xp: zahl(vorschlag.xp) });
          const aktiv = gewaehlt === index;
          return (
            <button
              key={vorschlag.zeitraum ?? `fest-${vorschlag.xp}`}
              type="button"
              aria-pressed={aktiv}
              aria-disabled={zuTeuer || undefined}
              aria-label={neben ? `${xpText}, ${neben}` : xpText}
              onClick={() => waehle(index)}
              className="flex min-h-12 w-full min-w-0 items-center justify-center"
            >
              <span
                className={`flex h-9 w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-full border px-2 ${
                  zuTeuer
                    ? 'border-rand text-leise opacity-40'
                    : aktiv
                      ? 'border-transparent bg-akzent/15 text-haupt'
                      : 'border-rand text-leise'
                }`}
              >
                <span className="max-w-full truncate text-[12px] leading-[14px]">{xpText}</span>
                {neben ? <span className="max-w-full truncate text-[11px] leading-3 text-leise">{neben}</span> : null}
              </span>
            </button>
          );
        })}
        </div>
        <div className="w-36 shrink-0 space-y-1">
          <label htmlFor={feldId} className="feld-label block text-[13px] leading-[18px] text-leise">
            {tx('Eigener')}
          </label>
          <div className="relative min-w-0">
            <input
              ref={eingabeRef}
              id={feldId}
              className={`${EINGABE_STIL} pr-9 tabular-nums`}
              inputMode="numeric"
              autoComplete="off"
              value={text}
              aria-invalid={zeigeFehler || undefined}
              aria-describedby={beschrieben || undefined}
              onChange={(ereignis) => {
                vonChip.current = false;
                setChipIndex(null);
                onText(ereignis.target.value.replace(/\D/g, '').slice(0, 15));
              }}
              onBlur={() => onGeprueft(true)}
            />
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-sm text-leise">
              {tx('XP')}
            </span>
          </div>
        </div>
      </div>
      {zeigeFehler && problem ? (
        <p id={fehlerId} className="feld-fehler text-[13px] leading-[18px] break-words text-gefahr" role="alert">
          <span aria-hidden="true">⚠ </span>
          {fehlerSatz(problem, verfuegbar)}
        </p>
      ) : null}
      <p id={hinweisId} className="feld-hilfe truncate text-[13px] leading-[18px] text-leise">
        {tx('Verfügbar: {xp} XP', { xp: zahl(verfuegbar) })}
      </p>
    </div>
  );
}
