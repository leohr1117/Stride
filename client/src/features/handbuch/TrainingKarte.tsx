import { Link } from 'react-router';
import { tx } from '../../text.ts';
import { FUNKTION_BILD } from '../../funktionsBild.tsx';
import { Karte } from '../../ui/index.ts';

export function TrainingKarte({ an }: { an: boolean }) {
  if (!an) {
    return null;
  }
  const Icon = FUNKTION_BILD.training.icon;
  return (
    <Karte>
      <div data-handbuch-karte="training" className="flex items-center gap-2 md:items-start">
        <Icon className="size-4 shrink-0 text-akzent" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{tx('Training')}</p>
          <p className="mt-0.5 text-xs text-leise">{tx('Eine Einheit ist ein Eintrag. Aufwärmen zählt nicht zum Bestwert.')}</p>
        </div>
        <Link to="/training" className="shrink-0 text-sm font-medium text-akzent">
          {tx('Öffnen')}
        </Link>
      </div>
    </Karte>
  );
}
