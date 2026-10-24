import { Dumbbell } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import type { Trainingsplan } from '../../../../shared/api/training.ts';
import type { GewichtEinheit } from '../../../../shared/spiel/training.ts';
import { tx } from '../../text.ts';
import { Karte, Knopf } from '../../ui/index.ts';
import { tageText, warmupText, zielText } from './zieltext.ts';

export function PlanKarte({
  plan,
  einheit,
  offenId,
  startet,
  onStart,
  onWiederherstellen,
  oeffnenZustand = null,
}: {
  plan: Trainingsplan;
  einheit: GewichtEinheit;
  offenId: number | null;
  startet: boolean;
  onStart: (planId: number) => void;
  onWiederherstellen: (planId: number) => void;
  oeffnenZustand?: unknown;
}) {
  const navigiere = useNavigate();
  const tage = tageText(plan.wochentage);
  return (
    <Karte>
      <h2 className="text-lg font-semibold tracking-widest uppercase">{plan.name}</h2>
      {tage ? <p className="mt-1.5 text-sm tracking-wide text-leise">{tage}</p> : null}
      <ul className="mt-4 space-y-4">
        {plan.uebungen.map((uebung) => {
          const ziel = zielText(
            {
              art: uebung.art,
              saetze: uebung.zielSaetze,
              wiederholungen: uebung.zielWiederholungen,
              sekunden: uebung.zielSekunden,
              gewichtG: uebung.zielGewichtG,
            },
            einheit,
          );
          const warm = warmupText(uebung, einheit);
          return (
            <li key={uebung.id}>
              <div className="flex items-baseline gap-2.5">
                <Dumbbell className="size-4 shrink-0 translate-y-0.5 text-akzent" aria-hidden="true" />
                <span className="min-w-0 flex-1 font-medium break-words">{uebung.name}</span>
                {ziel ? <span className="zahl shrink-0 text-sm text-leise">{ziel}</span> : null}
              </div>
              {warm ? <p className="zahl ms-6 mt-1 text-sm text-leise">{warm}</p> : null}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-rand pt-3">
        <Link to={`/training/plaene/${plan.id}`} className="text-sm font-medium text-akzent">
          {tx('Bearbeiten')}
        </Link>
        {plan.archiviert ? (
          <Knopf variante="primaer" onClick={() => onWiederherstellen(plan.id)}>
            {tx('Wiederherstellen')}
          </Knopf>
        ) : offenId !== null ? (
          <Knopf variante="primaer" onClick={() => navigiere(`/training/einheiten/${offenId}`, { state: oeffnenZustand })}>
            {tx('Öffnen')}
          </Knopf>
        ) : (
          <Knopf variante="primaer" disabled={startet} onClick={() => onStart(plan.id)}>
            {tx('Starten')}
          </Knopf>
        )}
      </div>
    </Karte>
  );
}
