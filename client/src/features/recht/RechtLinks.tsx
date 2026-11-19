import { tx } from '../../text.ts';
import { RECHT_SEITEN } from '../../../../shared/recht/seiten.ts';
import { rechtTitel } from './titel.ts';

export function RechtLinks({ className = '' }: { className?: string }) {
  return (
    <nav aria-label={tx('Rechtliches')} className={className}>
      <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {RECHT_SEITEN.map((seite) => (
          <li key={seite.pfad}>
            <a href={seite.pfad} className="text-[13px] leading-[18px] text-leise underline">
              {rechtTitel(seite.id)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
