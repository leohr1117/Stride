import { ICONS } from '../../../shared/spiel/begriffe.ts';
import { Icon } from './Icons.tsx';

export function IconAuswahl({
  wert,
  farbe,
  onAendern,
}: {
  wert: string;
  farbe: string;
  onAendern: (icon: (typeof ICONS)[number]) => void;
}) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {ICONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onAendern(option)}
          aria-label={option}
          className={`flex aspect-square items-center justify-center rounded-lg border transition ${
            option === wert ? 'border-akzent bg-akzent/10' : 'border-rand text-leise hover:text-haupt'
          }`}
          style={option === wert ? { color: farbe } : undefined}
        >
          <Icon name={option} className="size-4" />
        </button>
      ))}
    </div>
  );
}
