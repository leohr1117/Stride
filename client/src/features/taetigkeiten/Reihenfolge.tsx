import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { Vorlage } from '../../../../shared/api/index.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { Icon } from '../../components/Icons.tsx';
import { Fehlermeldung, Knopf } from '../../ui/index.ts';
import { tx } from '../../text.ts';

const INFO = 'Die oberste Tätigkeit steht zuerst, auch beim Eintragen.';

function geordnet(bisher: Vorlage[], ids: number[]): Vorlage[] {
  const nachId = new Map(bisher.map((vorlage) => [vorlage.id, vorlage]));
  const aktiv = ids.flatMap((id) => {
    const vorlage = nachId.get(id);
    return vorlage ? [vorlage] : [];
  });
  return [...aktiv, ...bisher.filter((vorlage) => vorlage.archiviert)];
}

export function ReihenfolgeKnopf({ vorlagen }: { vorlagen: Vorlage[] }) {
  const aktiv = vorlagen.filter((vorlage) => !vorlage.archiviert);
  const [offen, setOffen] = useState(false);
  const client = useQueryClient();
  const reihenfolge = useMutation({
    mutationFn: (ids: number[]) => api.ordneVorlagen(ids),
    onMutate: async (ids) => {
      await client.cancelQueries({ queryKey: SCHLUESSEL.vorlagen });
      const bisher = client.getQueryData<Vorlage[]>(SCHLUESSEL.vorlagen);
      if (bisher) {
        client.setQueryData(SCHLUESSEL.vorlagen, geordnet(bisher, ids));
      }
      return { bisher };
    },
    onError: (_fehler, _ids, kontext) => {
      if (kontext?.bisher) {
        client.setQueryData(SCHLUESSEL.vorlagen, kontext.bisher);
      }
    },
    onSuccess: (neu) => {
      client.setQueryData(SCHLUESSEL.vorlagen, neu);
    },
  });

  if (aktiv.length < 2) {
    return null;
  }

  const verschiebe = (id: number, richtung: -1 | 1) => {
    if (reihenfolge.isPending) {
      return;
    }
    const ids = aktiv.map((vorlage) => vorlage.id);
    const index = ids.indexOf(id);
    const ziel = index + richtung;
    if (index < 0 || ziel < 0 || ziel >= ids.length) {
      return;
    }
    const [entfernt] = ids.splice(index, 1);
    if (entfernt === undefined) {
      return;
    }
    ids.splice(ziel, 0, entfernt);
    reihenfolge.mutate(ids);
  };

  return (
    <>
      <Knopf className="w-full md:w-auto" onClick={() => setOffen(true)}>
        {tx('Reihenfolge')}
      </Knopf>
      <Dialog offen={offen} titel={tx('Reihenfolge')} info={INFO} onSchliessen={() => setOffen(false)}>
        <Fehlermeldung fehler={reihenfolge.error} />
        <div className="divide-y divide-rand">
          {aktiv.map((vorlage, index) => (
            <div key={vorlage.id} data-reihenfolge={vorlage.id} className="flex items-center gap-2 py-2">
              <span className="zahl w-4 shrink-0 text-center text-xs text-leise">{index + 1}</span>
              <Icon name={vorlage.icon} className="size-5 shrink-0 text-leise" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{vorlage.name}</p>
                {vorlage.projektName ? <p className="truncate text-xs text-leise">{vorlage.projektName}</p> : null}
              </div>
              <button
                type="button"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-flaeche-2 text-haupt disabled:opacity-30"
                aria-label={tx('{name} nach oben', { name: vorlage.name })}
                disabled={reihenfolge.isPending || index === 0}
                onClick={() => verschiebe(vorlage.id, -1)}
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                type="button"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-flaeche-2 text-haupt disabled:opacity-30"
                aria-label={tx('{name} nach unten', { name: vorlage.name })}
                disabled={reihenfolge.isPending || index === aktiv.length - 1}
                onClick={() => verschiebe(vorlage.id, 1)}
              >
                <ChevronDown className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </Dialog>
    </>
  );
}
