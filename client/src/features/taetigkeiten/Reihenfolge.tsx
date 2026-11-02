import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, EllipsisVertical } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Vorlage } from '../../../../shared/api/index.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { Icon } from '../../components/Icons.tsx';
import { KopfAktion } from '../../components/Kopf.tsx';
import { Fehlermeldung, Knopf } from '../../ui/index.ts';
import { tx } from '../../text.ts';

function ReihenfolgeAusloeser({ onOeffnen }: { onOeffnen: () => void }) {
  const knopf = useRef<HTMLButtonElement>(null);
  const menue = useRef<HTMLDivElement>(null);
  const [anker, setAnker] = useState<{ x: number; y: number } | null>(null);
  const [stil, setStil] = useState({ top: 0, left: 0 });
  const schliessen = () => {
    setAnker(null);
    knopf.current?.focus();
  };
  useLayoutEffect(() => {
    if (!anker) {
      return;
    }
    const kasten = menue.current?.getBoundingClientRect();
    if (!kasten) {
      return;
    }
    let links = anker.x;
    let oben = anker.y;
    if (links + kasten.width > window.innerWidth - 8) {
      links = window.innerWidth - kasten.width - 8;
    }
    if (oben + kasten.height > window.innerHeight - 8) {
      oben = Math.max(8, anker.y - kasten.height);
    }
    setStil({ top: Math.max(8, oben), left: Math.max(8, links) });
  }, [anker]);
  useEffect(() => {
    if (!anker) {
      return;
    }
    menue.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const beiTaste = (ereignis: KeyboardEvent) => {
      if (ereignis.key !== 'Escape') {
        return;
      }
      ereignis.preventDefault();
      ereignis.stopPropagation();
      schliessen();
    };
    const beiZeiger = (ereignis: PointerEvent) => {
      const ziel = ereignis.target;
      if (ziel instanceof Node && (menue.current?.contains(ziel) || knopf.current?.contains(ziel))) {
        return;
      }
      setAnker(null);
    };
    window.addEventListener('keydown', beiTaste, true);
    document.addEventListener('pointerdown', beiZeiger);
    return () => {
      window.removeEventListener('keydown', beiTaste, true);
      document.removeEventListener('pointerdown', beiZeiger);
    };
  }, [anker]);
  const punkt = (inhalt: ReactNode, wahl: () => void) => (
    <button
      type="button"
      role="menuitem"
      className="block w-full px-3 py-2.5 text-left text-sm hover:bg-flaeche-2"
      onClick={() => {
        setAnker(null);
        wahl();
      }}
    >
      {inhalt}
    </button>
  );
  return (
    <>
      <KopfAktion>
        <button
          ref={knopf}
          type="button"
          className="inline-flex size-12 items-center justify-center text-haupt"
          aria-label={tx('Aktionen')}
          aria-haspopup="menu"
          aria-expanded={anker !== null}
          onClick={() => {
            const kasten = knopf.current?.getBoundingClientRect();
            setAnker(kasten ? { x: kasten.right - 176, y: kasten.bottom } : { x: 8, y: 48 });
          }}
        >
          <EllipsisVertical className="size-5" aria-hidden="true" />
        </button>
      </KopfAktion>
      {anker
        ? createPortal(
            <div
              ref={menue}
              role="menu"
              aria-label={tx('Aktionen')}
              style={stil}
              className="fixed z-[95] min-w-44 rounded-xl border border-rand bg-flaeche py-1 shadow-lg"
            >
              {punkt(tx('Reihenfolge'), onOeffnen)}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

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
      <ReihenfolgeAusloeser onOeffnen={() => setOffen(true)} />
      <Dialog offen={offen} titel={tx('Reihenfolge')} onSchliessen={() => setOffen(false)}>
        <p className="mb-3 text-[13px] leading-5 text-leise">{tx('Oben steht zuerst, auch beim Eintragen.')}</p>
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
                className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-flaeche-2 text-haupt disabled:opacity-30"
                aria-label={tx('{name} nach oben', { name: vorlage.name })}
                disabled={reihenfolge.isPending || index === 0}
                onClick={() => verschiebe(vorlage.id, -1)}
              >
                <ChevronUp className="size-5" />
              </button>
              <button
                type="button"
                className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-flaeche-2 text-haupt disabled:opacity-30"
                aria-label={tx('{name} nach unten', { name: vorlage.name })}
                disabled={reihenfolge.isPending || index === aktiv.length - 1}
                onClick={() => verschiebe(vorlage.id, 1)}
              >
                <ChevronDown className="size-5" />
              </button>
            </div>
          ))}
        </div>
        <Knopf className="mt-4 w-full" onClick={() => setOffen(false)}>
          {tx('Fertig')}
        </Knopf>
      </Dialog>
    </>
  );
}
