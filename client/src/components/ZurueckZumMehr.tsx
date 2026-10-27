import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
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
  return (
    <div className="zurueck-zeile sticky top-[var(--mobilkopf-hoehe,4.1rem)] z-20 -mx-4 bg-grund/90 px-4 py-1 backdrop-blur md:static md:top-auto md:mx-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
      <Link
        to={pfad}
        replace
        state={zustand}
        data-zurueck=""
        className="inline-flex items-center gap-1 text-sm text-leise hover:text-haupt"
      >
        <ArrowLeft className="size-4 shrink-0" />
        {tx(label)}
      </Link>
    </div>
  );
}
