import { Check } from 'lucide-react';
import { tx } from '../../text.ts';

export function AbhakKreis({
  name,
  erledigt,
  laeuft,
  onUmschalten,
}: {
  name: string;
  erledigt: boolean;
  laeuft: boolean;
  onUmschalten: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={erledigt}
      aria-label={tx('{name} abhaken', { name })}
      disabled={laeuft}
      onClick={onUmschalten}
      className="flex size-12 shrink-0 items-center justify-center"
    >
      <span
        aria-hidden="true"
        data-abhak={erledigt ? 'erledigt' : 'offen'}
        className={
          erledigt
            ? 'flex size-6 items-center justify-center rounded-full bg-erfolg text-erfolg-text'
            : 'box-border size-6 rounded-full border-2 border-[color:var(--feldrand)]'
        }
      >
        {erledigt ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}
