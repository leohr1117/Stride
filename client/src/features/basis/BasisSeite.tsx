import { tx } from '../../text.ts';
import { Archive, Plus } from 'lucide-react';
import { useState } from 'react';
import type { BasisAufgabe } from '../../../../shared/api/index.ts';
import { BasisFormular, BasisListe, useBasisAufgaben } from './Basis.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { SchnellZeile } from '../../components/SchnellAktion.tsx';
import { archivBeschriftung, Fehlermeldung, Karte, Knopf, Ladeanzeige, Ueberschrift } from '../../ui/index.ts';
import { useEbenen } from '../../funktionen.ts';

type Bearbeitung = { aufgabe: BasisAufgabe | null } | null;

interface ProjektGruppe {
  schluessel: string;
  projektName: string;
  aufgaben: BasisAufgabe[];
}

function gruppiereNachProjekt(aufgaben: BasisAufgabe[]): ProjektGruppe[] {
  const gruppen = new Map<string, ProjektGruppe>();
  for (const aufgabe of aufgaben) {
    const schluessel = aufgabe.projektId === null ? 'frei' : String(aufgabe.projektId);
    const gruppe = gruppen.get(schluessel) ?? {
      schluessel,
      projektName: aufgabe.projektName ?? tx("Ohne Projekt"),
      aufgaben: [],
    };
    gruppe.aufgaben.push(aufgabe);
    gruppen.set(schluessel, gruppe);
  }
  return [...gruppen.values()];
}

export function BasisSeite() {
  const ebenen = useEbenen();
  const { data: aufgaben, error, isPending } = useBasisAufgaben();
  const [bearbeitung, setBearbeitung] = useState<Bearbeitung>(null);

  if (isPending) {
    return <Ladeanzeige />;
  }
  if (error) {
    return <Fehlermeldung fehler={error} />;
  }

  const aktive = aufgaben.filter((aufgabe) => !aufgabe.archiviert);
  const gruppen = ebenen.projekte ? gruppiereNachProjekt(aktive) : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{tx("Basis")}</h1>
        <Knopf variante="primaer" onClick={() => setBearbeitung({ aufgabe: null })}>
          <Plus className="size-4" />
          {tx("Aufgabe")}
        </Knopf>
      </header>

      {aktive.length === 0 && <Karte className="py-10 text-center text-sm text-leise">{tx("Noch keine Basis-Aufgaben.")}</Karte>}

      {!ebenen.projekte && aktive.length > 0 && (
        <Karte>
          <BasisListe aufgaben={aktive} mitProjekt={false} onBearbeiten={(aufgabe) => setBearbeitung({ aufgabe })} />
        </Karte>
      )}

      {gruppen.map((gruppe) => (
        <Karte key={gruppe.schluessel}>
          <Ueberschrift titel={gruppe.projektName} />
          <BasisListe
            aufgaben={gruppe.aufgaben}
            mitProjekt={false}
            onBearbeiten={(aufgabe) => setBearbeitung({ aufgabe })}
          />
        </Karte>
      ))}

      <BasisArchiv aufgaben={aufgaben.filter((aufgabe) => aufgabe.archiviert)} />

      <Dialog
        offen={bearbeitung !== null}
        titel={bearbeitung?.aufgabe ? tx("Aufgabe bearbeiten") : tx("Neue Aufgabe")}
        onSchliessen={() => setBearbeitung(null)}
      >
        {bearbeitung && (
          <BasisFormular
            key={bearbeitung.aufgabe?.id ?? 'neu'}
            aufgabe={bearbeitung.aufgabe}
            onFertig={() => setBearbeitung(null)}
          />
        )}
      </Dialog>
    </div>
  );
}

function BasisArchiv({ aufgaben }: { aufgaben: BasisAufgabe[] }) {
  const ebenen = useEbenen();
  const [offen, setOffen] = useState(false);

  if (aufgaben.length === 0) {
    return null;
  }
  return (
    <section className="space-y-2">
      <div className="flex justify-center">
        <Knopf variante="leise" onClick={() => setOffen(!offen)}>
          <Archive className="size-4" />
          {archivBeschriftung(offen, aufgaben.length)}
        </Knopf>
      </div>
      {offen &&
        aufgaben.map((aufgabe) => (
          <SchnellZeile
            key={aufgabe.id}
            className="rounded-xl border border-rand"
            ziel={{ art: 'basis', id: aufgabe.id, name: aufgabe.name, archiviert: true, loeschbar: aufgabe.loeschbar }}
          >
            {(menue) => (
              <div className="flex items-center justify-between py-1 pr-1 pl-4">
                <span className="text-sm">
                  {aufgabe.name}
                  {ebenen.projekte && aufgabe.projektName && <span className="text-leise"> · {aufgabe.projektName}</span>}
                </span>
                {menue}
              </div>
            )}
          </SchnellZeile>
        ))}
    </section>
  );
}
