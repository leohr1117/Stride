import { useId } from 'react';
import { INVESTITION_GROESSEN, investitionsBonus } from '../../../../shared/spiel/xp.ts';
import { bonusProzent, zahl } from '../../format.ts';
import { tx } from '../../text.ts';
import { VorschlagFeld, type VorschlagOption } from '../../ui/index.ts';
import type { BetragProblem } from './zahlungAnzeige.ts';

function fehlerSatz(problem: BetragProblem, verfuegbar: number): string {
  if (problem === 'leer') {
    return tx('Betrag eingeben oder „Nichts“ wählen');
  }
  return tx('Nur {xp} XP verfügbar', { xp: zahl(verfuegbar) });
}

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

function optionenVon(betraege: readonly number[], verfuegbar: number): VorschlagOption[] {
  return betraege.map((xp) => {
    const zuTeuer = xp > verfuegbar;
    const fehlen = zuTeuer ? tx('fehlen {xp} XP', { xp: zahl(xp - verfuegbar) }) : '';
    const xpText = tx('{xp} XP', { xp: zahl(xp) });
    return {
      id: String(xp),
      wert: String(xp),
      zeile: xpText,
      neben: fehlen || undefined,
      name: fehlen ? `${xpText}, ${fehlen}` : xpText,
      gesperrt: zuTeuer,
    };
  });
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
  vorschlaege: readonly number[];
  eingabeRef: { current: HTMLInputElement | null };
  feldId: string;
  fehlerId: string;
  hinweisId: string;
}) {
  const zeigeFehler = geprueft && problem !== null;
  return (
    <VorschlagFeld
      label="Betrag"
      text={text}
      onText={onText}
      optionen={optionenVon(vorschlaege, verfuegbar)}
      einheit={tx('XP')}
      feldId={feldId}
      eingabeRef={eingabeRef}
      fehler={zeigeFehler && problem ? fehlerSatz(problem, verfuegbar) : null}
      fehlerId={fehlerId}
      hinweis={tx('Verfügbar: {xp} XP', { xp: zahl(verfuegbar) })}
      hinweisId={hinweisId}
      onUnscharf={() => onGeprueft(true)}
      onWahl={() => onGeprueft(false)}
      bereinige={(roh) => roh.replace(/\D/g, '').slice(0, 15)}
    />
  );
}
