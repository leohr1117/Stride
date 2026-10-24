import { Link } from 'react-router';
import { tx } from '../../text.ts';
import { FUNKTION_BILD } from '../../funktionsBild.tsx';
import { Karte } from '../../ui/index.ts';

export function AufgabenKarte({ an }: { an: boolean }) {
  if (!an) {
    return null;
  }
  const Icon = FUNKTION_BILD.aufgaben.icon;
  return (
    <Karte>
      <div data-handbuch-karte="aufgaben">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="size-4 shrink-0 text-akzent" aria-hidden />
            <h2 className="ueberschrift min-w-0 text-sm font-semibold tracking-wide text-leise uppercase">{tx('Aufgaben')}</h2>
          </div>
          <Link to="/aufgaben" className="shrink-0 text-sm font-medium text-akzent">
            {tx('Öffnen')}
          </Link>
        </div>
        <p className="mt-2 text-xs text-leise">{tx('Eigene Aufgaben. Eine Erledigung wird ein Eintrag.')}</p>
      </div>
    </Karte>
  );
}
