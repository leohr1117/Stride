import { ArrowLeft } from 'lucide-react';
import { type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { geheZurueck } from '../herkunft.tsx';
import { tx } from '../text.ts';

export function ZurueckZumMehr({
  pfad = '/mehr',
  label = tx("Mehr"),
  zustand,
}: {
  pfad?: string;
  label?: string;
  zustand?: unknown;
}) {
  const navigiere = useNavigate();
  const klick = (ereignis: MouseEvent<HTMLAnchorElement>) => {
    if (ereignis.button !== 0 || ereignis.metaKey || ereignis.ctrlKey || ereignis.shiftKey || ereignis.altKey) {
      return;
    }
    ereignis.preventDefault();
    geheZurueck(navigiere, pfad);
  };
  return (
    <div className="zurueck-zeile sticky top-[var(--mobilkopf-hoehe,4.1rem)] z-20 -mx-4 mb-6 bg-grund/90 px-4 py-1 backdrop-blur md:static md:top-auto md:mx-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
      <Link
        to={pfad}
        state={zustand}
        data-zurueck=""
        onClick={klick}
        className="inline-flex items-center gap-1 text-sm text-leise hover:text-haupt"
      >
        <ArrowLeft className="size-4 shrink-0" />
        {tx(label)}
      </Link>
    </div>
  );
}
