import { tx, txMenge } from '../text.ts';
import type { Projekt } from '../../../shared/api/index.ts';
import { KettenFlamme } from './KettenFlamme.tsx';

export function KettenAnzeige({ kette, className = '' }: { kette: Projekt['kette']; className?: string }) {
  if (kette.laenge < 2) {
    return null;
  }
  return (
    <span
      className={`zahl flex items-center gap-1 text-xs font-medium ${kette.angeknackst ? 'text-leise' : 'text-streak'} ${className}`}
      title={kette.angeknackst ? tx("Gestern ausgesetzt") : tx("Tage in Folge")}
    >
      <KettenFlamme laenge={kette.laenge} className="size-3.5" />
      {txMenge(kette.laenge, '{tage} Tage', { tage: kette.laenge })}
      {kette.angeknackst ? ` · ${tx('angeknackst')}` : ''}
    </span>
  );
}
