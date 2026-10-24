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
    <Link
      to={pfad}
      replace
      state={zustand}
      data-zurueck=""
      className="inline-flex items-center gap-1 text-sm text-leise hover:text-haupt"
    >
      <ArrowLeft className="size-4" />
      {tx(label)}
    </Link>
  );
}
