import { Dumbbell } from 'lucide-react';
import type { TrainingHeute } from '../../../../shared/api/training.ts';
import { tx } from '../../text.ts';
import { Knopf } from '../../ui/index.ts';
import { tageText } from './zieltext.ts';

export function trainingSach(zeile: Pick<TrainingHeute, 'wochentage' | 'uebungNamen'>): string {
  const tage = tageText(zeile.wochentage);
  const namen = zeile.uebungNamen.filter((name) => name.trim() !== '').join(', ');
  if (tage && namen) {
    return `${tage} · ${namen}`;
  }
  return tage ?? namen;
}

export function TrainingHeuteListe({
  zeilen,
  startet,
  onStart,
  onOeffnen,
}: {
  zeilen: readonly TrainingHeute[];
  startet: boolean;
  onStart: (zeile: TrainingHeute) => void;
  onOeffnen: (zeile: TrainingHeute) => void;
}) {
  if (zeilen.length === 0) {
    return null;
  }
  return (
    <ul className="space-y-1">
      {zeilen.map((zeile) => {
        const sach = trainingSach(zeile);
        const oeffnen = zeile.aktion === 'oeffnen' && zeile.einheitId !== null;
        return (
          <li key={zeile.planId} className="flex min-h-11 items-center gap-2">
            <Dumbbell className="size-4 shrink-0 text-akzent" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{zeile.name}</p>
              {sach ? <p className="text-xs break-words text-leise">{sach}</p> : null}
            </div>
            {oeffnen ? (
              <Knopf variante="primaer" className="shrink-0 !min-h-11 !px-3 !py-2" onClick={() => onOeffnen(zeile)}>
                {tx('Öffnen')}
              </Knopf>
            ) : (
              <Knopf
                variante="primaer"
                className="shrink-0 !min-h-11 !px-3 !py-2"
                disabled={startet}
                onClick={() => onStart(zeile)}
              >
                {tx('Starten')}
              </Knopf>
            )}
          </li>
        );
      })}
    </ul>
  );
}
