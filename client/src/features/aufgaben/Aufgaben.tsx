import { tx } from '../../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Aufgabe } from '../../../../shared/api/aufgaben.ts';
import { datumInZone } from '../../../../shared/spiel/datum.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useFeiern } from '../../components/Belohnung.tsx';
import { Icon } from '../../components/Icons.tsx';
import { dauerText, kurzesDatum } from '../../format.ts';
import { useEbenen } from '../../funktionen.ts';
import { Fehlermeldung } from '../../ui/index.ts';

export function useAufgaben(archiv = false, aktiv = true) {
  return useQuery({
    queryKey: [...SCHLUESSEL.aufgaben, archiv],
    queryFn: () => api.aufgaben(archiv),
    enabled: aktiv,
  });
}

function useAufgabenAktionen() {
  const queryClient = useQueryClient();
  const feiern = useFeiern();
  const erledigen = useMutation({
    mutationFn: (id: number) => api.erledigeAufgabe(id),
    onSuccess: (ergebnis) => {
      void queryClient.invalidateQueries();
      feiern(ergebnis.belohnung);
    },
  });
  const rueckgaengig = useMutation({
    mutationFn: (eintragId: number) => api.loescheEintrag(eintragId),
    onSuccess: () => void queryClient.invalidateQueries(),
  });
  return {
    erledigen: (id: number) => erledigen.mutate(id),
    rueckgaengig: (eintragId: number) => rueckgaengig.mutate(eintragId),
    laeuft: erledigen.isPending || rueckgaengig.isPending,
    fehler: erledigen.error ?? rueckgaengig.error,
  };
}

function datumAnzeige(faelligAm: string | null, heute: string): string | null {
  if (faelligAm === null || faelligAm === heute) {
    return null;
  }
  return kurzesDatum(`${faelligAm}T12:00:00`);
}

function prioText(wert: number | null): string | null {
  if (wert === 1) {
    return tx('p1');
  }
  if (wert === 2) {
    return tx('p2');
  }
  if (wert === 3) {
    return tx('p3');
  }
  if (wert === 4) {
    return tx('p4');
  }
  return null;
}

function kampfText(aufgabe: Aufgabe): string | null {
  if (aufgabe.boss) {
    return tx('Boss');
  }
  if (aufgabe.gegner) {
    return tx('Gegner');
  }
  return null;
}

function Sachzeile({ teile }: { teile: { key: string; knoten: ReactNode }[] }) {
  if (teile.length === 0) {
    return null;
  }
  return (
    <p className="hidden truncate text-xs text-leise md:block">
      {teile.map((teil, index) => (
        <span key={teil.key}>
          {index > 0 ? ' · ' : ''}
          {teil.knoten}
        </span>
      ))}
    </p>
  );
}

function AufgabenZeile({
  aufgabe,
  heute,
  mitProjekt,
  laeuft,
  onErledigen,
  onRueckgaengig,
  onBearbeiten,
}: {
  aufgabe: Aufgabe;
  heute: string;
  mitProjekt: boolean;
  laeuft: boolean;
  onErledigen: () => void;
  onRueckgaengig: (eintragId: number) => void;
  onBearbeiten: () => void;
}) {
  const erledigt = aufgabe.heuteEintragId !== null;
  const datum = datumAnzeige(aufgabe.faelligAm, heute);
  const zeit = aufgabe.faelligUm;
  const taetigkeit = aufgabe.vorlageName === '' ? null : aufgabe.vorlageName;
  const dauer = aufgabe.stunden === null ? null : dauerText(aufgabe.stunden);
  const projekt = mitProjekt ? aufgabe.projektName : null;
  const prio = prioText(aufgabe.prioritaet);
  const kampf = kampfText(aufgabe);
  const rechts = zeit ?? datum;
  const sach = [
    taetigkeit === null ? null : { key: 'taetigkeit', knoten: taetigkeit },
    zeit === null ? null : { key: 'zeit', knoten: zeit },
    datum === null ? null : { key: 'datum', knoten: datum },
    projekt === null ? null : { key: 'projekt', knoten: projekt },
    dauer === null ? null : { key: 'dauer', knoten: dauer },
    prio === null ? null : { key: 'prio', knoten: <span data-prio={aufgabe.prioritaet} className="prio-farbe">{prio}</span> },
    kampf === null ? null : { key: 'kampf', knoten: <span className="text-gefahr">{kampf}</span> },
  ].filter((teil) => teil !== null);

  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        disabled={laeuft}
        aria-label={erledigt ? tx('Rückgängig') : tx('Erledigt')}
        onClick={() => {
          if (aufgabe.heuteEintragId !== null) {
            onRueckgaengig(aufgabe.heuteEintragId);
            return;
          }
          onErledigen();
        }}
        className="flex size-11 shrink-0 items-center justify-center"
      >
        <span
          data-an={erledigt ? '1' : '0'}
          data-prio={erledigt || aufgabe.prioritaet === null ? undefined : aufgabe.prioritaet}
          className={`aufgaben-kreis flex size-[22px] items-center justify-center rounded-full border-[1.5px] ${
            erledigt ? 'border-transparent bg-xp text-akzent-text' : aufgabe.prioritaet === null ? 'border-current text-leise' : ''
          }`}
        >
          <Check className="aufgaben-haken size-3.5" strokeWidth={2.5} />
        </span>
      </button>
      <Icon name="clipboard-list" className="size-4 shrink-0 text-akzent" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center">
          <button
            type="button"
            aria-label={aufgabe.name}
            onClick={onBearbeiten}
            className={`min-w-0 truncate text-left text-sm ${erledigt ? 'text-leise' : 'font-medium'}`}
          >
            {aufgabe.name}
          </button>
          {prio && (
            <span data-prio={aufgabe.prioritaet} className="prio-farbe ms-1.5 shrink-0 text-[11px] md:hidden">
              {prio}
            </span>
          )}
          {kampf && <span className="ms-1.5 shrink-0 text-[11px] text-gefahr md:hidden">{kampf}</span>}
        </div>
        {taetigkeit && <p className="truncate text-xs text-leise md:hidden">{taetigkeit}</p>}
        <Sachzeile teile={sach} />
      </div>
      {rechts && <span className="shrink-0 text-xs text-leise md:hidden">{rechts}</span>}
    </li>
  );
}

export function AufgabenListe({
  aufgaben,
  onBearbeiten,
}: {
  aufgaben: Aufgabe[];
  onBearbeiten: (aufgabe: Aufgabe) => void;
}) {
  const ebenen = useEbenen();
  const aktionen = useAufgabenAktionen();
  const { data: einstellungen } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const heute = datumInZone(new Date(), einstellungen?.zeitzone ?? null);

  return (
    <>
      <ul className="space-y-1">
        {aufgaben.map((aufgabe) => (
          <AufgabenZeile
            key={aufgabe.id}
            aufgabe={aufgabe}
            heute={heute}
            mitProjekt={ebenen.projekte}
            laeuft={aktionen.laeuft}
            onErledigen={() => aktionen.erledigen(aufgabe.id)}
            onRueckgaengig={aktionen.rueckgaengig}
            onBearbeiten={() => onBearbeiten(aufgabe)}
          />
        ))}
      </ul>
      <Fehlermeldung fehler={aktionen.fehler} />
    </>
  );
}
