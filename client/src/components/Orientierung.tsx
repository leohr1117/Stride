import { tx } from '../text.ts';
import { useState } from 'react';
import type { LevelBeispiel } from '../../../shared/spiel/orientierung.ts';
import { zahl } from '../format.ts';
import { useFunktionen } from '../funktionen.ts';

export function LevelBeispiele({
  beispiele,
  empfohlenAb,
  onWaehlen,
}: {
  beispiele: LevelBeispiel[];
  empfohlenAb?: number;
  onWaehlen: (level: number) => void;
}) {
  const funktionen = useFunktionen();
  const [offen, setOffen] = useState(false);
  if (!funktionen.handbuch) {
    return null;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOffen(!offen)}
        className="inline-flex min-h-12 items-center rounded-lg px-4 text-sm font-medium text-leise hover:bg-flaeche-2 hover:text-haupt"
      >
        {tx("Beispiele")}
      </button>
      {offen && (
        <div className="mt-2 space-y-2 rounded-xl bg-flaeche-2 p-3">
          {empfohlenAb !== undefined && (
            <p className="zahl text-xs text-leise break-words">{tx('Empfohlen ab Level {level}', { level: zahl(empfohlenAb) })}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {beispiele.map((beispiel) => (
              <button
                key={beispiel.titel}
                type="button"
                onClick={() => onWaehlen(beispiel.level)}
                className="rounded-lg border border-rand bg-flaeche px-2 py-1 text-xs transition hover:border-akzent"
              >
                {tx(beispiel.titel)}
                <span className="zahl text-leise"> · {zahl(beispiel.level)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
