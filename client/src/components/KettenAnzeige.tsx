import { tx } from '../text.ts';
import { Flame } from 'lucide-react';
import type { Projekt } from '../../../shared/api/index.ts';

export function KettenAnzeige({ kette, className = '' }: { kette: Projekt['kette']; className?: string }) {
  if (kette.laenge < 2) {
    return null;
  }
  return (
    <span
      className={`zahl flex items-center gap-1 text-xs font-medium ${kette.angeknackst ? 'text-leise' : 'text-streak'} ${className}`}
      title={kette.angeknackst ? tx("Gestern ausgesetzt") : tx("Tage in Folge")}
    >
      <Flame className="size-3.5" />
      {tx('{tage} Tage', { tage: kette.laenge })}
      {kette.angeknackst ? ` · ${tx('angeknackst')}` : ''}
    </span>
  );
}
