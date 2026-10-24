import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Einstellungen } from '../../../../shared/api/index.ts';
import { GEWICHT_EINHEITEN, STANDARD_GEWICHT_EINHEIT, type GewichtEinheit } from '../../../../shared/spiel/training.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { tx } from '../../text.ts';

export function useGewichtEinheit() {
  const client = useQueryClient();
  const abfrage = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const speichern = useMutation({
    mutationFn: (einheit: GewichtEinheit) => api.aendereEinstellungen({ gewichtEinheit: einheit }),
    onMutate: async (einheit) => {
      await client.cancelQueries({ queryKey: SCHLUESSEL.einstellungen });
      const bisher = client.getQueryData<Einstellungen>(SCHLUESSEL.einstellungen);
      if (bisher) {
        client.setQueryData<Einstellungen>(SCHLUESSEL.einstellungen, { ...bisher, gewichtEinheit: einheit });
      }
      return { bisher };
    },
    onError: (_fehler, _einheit, kontext) => {
      if (kontext?.bisher) {
        client.setQueryData(SCHLUESSEL.einstellungen, kontext.bisher);
      }
    },
    onSuccess: (neu) => {
      client.setQueryData(SCHLUESSEL.einstellungen, neu);
    },
  });
  return {
    einheit: abfrage.data?.gewichtEinheit ?? STANDARD_GEWICHT_EINHEIT,
    bereit: abfrage.isSuccess,
    speichern,
  };
}

export function GewichtKapsel() {
  const { einheit, speichern } = useGewichtEinheit();
  return (
    <div role="group" aria-label={tx('Gewicht')} className="inline-flex rounded-full border border-rand p-0.5 text-sm">
      {GEWICHT_EINHEITEN.map((eintrag) => {
        const an = einheit === eintrag;
        return (
          <button
            key={eintrag}
            type="button"
            aria-pressed={an}
            disabled={speichern.isPending && !an}
            onClick={() => {
              if (!an) {
                speichern.mutate(eintrag);
              }
            }}
            className={`rounded-full px-2.5 py-1 ${an ? 'bg-akzent/15 text-haupt' : 'text-leise'}`}
          >
            {eintrag === 'lb' ? tx('lb') : tx('kg')}
          </button>
        );
      })}
    </div>
  );
}
