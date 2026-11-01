import { useQuery, useQueryClient } from '@tanstack/react-query';
import { tx } from '../../text.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { Fehlermeldung, Karte } from '../../ui/index.ts';
import {
  beginneBewertung,
  bewertungFehler,
  bewertungGespeichert,
  bewertungIstFaellig,
  bewertungSchlugFehl,
} from './bewertungStand.ts';

const ZAHLEN = [1, 2, 3, 4, 5] as const;

export function BewertungKarte() {
  const client = useQueryClient();
  const { data: zeigen } = useQuery({
    queryKey: SCHLUESSEL.bewertung,
    queryFn: bewertungIstFaellig,
    initialData: false,
    staleTime: Infinity,
  });
  if (!zeigen) {
    return null;
  }

  const frage = tx('Wie hilfreich ist Stride gerade?');
  const speichern = (eingabe: { wert: number } | { nie: true }) => {
    if (!beginneBewertung(client)) {
      return;
    }
    void api.bewerte(eingabe).then(
      () => bewertungGespeichert(),
      () => bewertungSchlugFehl(client),
    );
  };

  return (
    <Karte label={frage} className="space-y-3">
      <p className="text-base">{frage}</p>
      <div className="flex gap-1 rounded-lg bg-flaeche-2 p-1" role="group" aria-label={frage}>
        {ZAHLEN.map((wert) => (
          <button
            key={wert}
            type="button"
            className="knopf flex min-h-12 flex-1 items-center justify-center rounded-lg py-2 text-sm font-medium text-leise hover:text-haupt"
            onClick={() => speichern({ wert })}
          >
            {wert}
          </button>
        ))}
      </div>
      <button type="button" className="knopf self-start px-0 py-1 text-sm text-leise" onClick={() => speichern({ nie: true })}>
        {tx('Nicht fragen')}
      </button>
      <Fehlermeldung fehler={bewertungFehler()} />
    </Karte>
  );
}
