import { tx } from '../../text.ts';
import { Check } from 'lucide-react';
import { useState } from 'react';
import type { BasisAufgabe } from '../../../../shared/api/index.ts';
import { BasisFormular, useBasisAktionen, useBasisAufgaben } from './Basis.tsx';
import { Abschnitt } from '../../components/Ausklappbar.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { Icon } from '../../components/Icons.tsx';
import { SchnellZeile } from '../../components/SchnellAktion.tsx';
import { AnlegeZeile, Liste } from '../../components/Zeile.tsx';
import { dauerText, zahl } from '../../format.ts';
import { useEbenen } from '../../funktionen.ts';
import { AbschnittKopf, Fehlermeldung, Knopf, Ladeanzeige, Leer } from '../../ui/index.ts';

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

function BasisZeile({
  aufgabe,
  mitProjekt,
  laeuft,
  onErledigen,
  onRueckgaengig,
  onBearbeiten,
}: {
  aufgabe: BasisAufgabe;
  mitProjekt: boolean;
  laeuft: boolean;
  onErledigen: () => void;
  onRueckgaengig: (eintragId: number) => void;
  onBearbeiten: () => void;
}) {
  const heuteEintragId = aufgabe.heuteEintragId;
  const details = [mitProjekt ? aufgabe.projektName : null, aufgabe.stunden !== null ? dauerText(aufgabe.stunden) : null]
    .filter((teil) => teil !== null)
    .join(' · ');

  return (
    <SchnellZeile
      hintergrund="bg-transparent"
      eintraege={[{ art: 'archivieren', id: 'bearbeiten', label: 'Bearbeiten' }]}
      onEintrag={onBearbeiten}
      ziel={{ art: 'basis', id: aufgabe.id, name: aufgabe.name, archiviert: aufgabe.archiviert, loeschbar: aufgabe.loeschbar }}
    >
      {(menue) => (
        <div className="flex min-h-12 items-center gap-2 py-1 pr-1 pl-4">
          <Icon name={aufgabe.icon} className="size-5 shrink-0" style={{ color: aufgabe.farbe }} />
          <div className="min-w-0 flex-1">
            <p className={`truncate text-base ${heuteEintragId !== null ? 'text-leise' : ''}`}>{aufgabe.name}</p>
            {details ? <p className="truncate text-[13px] leading-[18px] text-leise">{details}</p> : null}
          </div>
          {menue}
          {heuteEintragId !== null ? (
            <button
              type="button"
              onClick={() => onRueckgaengig(heuteEintragId)}
              disabled={laeuft}
              aria-label={tx("Rückgängig")}
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-xp/20 text-xp active:scale-90"
            >
              <Check className="size-5" strokeWidth={3} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onErledigen}
              disabled={laeuft}
              aria-label={tx("Erledigt")}
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-akzent text-akzent-text active:scale-90"
            >
              <Check className="size-5" strokeWidth={3} />
            </button>
          )}
        </div>
      )}
    </SchnellZeile>
  );
}

export function BasisSeite() {
  const ebenen = useEbenen();
  const { data: aufgaben, error, isPending } = useBasisAufgaben();
  const aktionen = useBasisAktionen();
  const [bearbeitung, setBearbeitung] = useState<Bearbeitung>(null);

  if (isPending) {
    return <Ladeanzeige />;
  }
  if (error) {
    return <Fehlermeldung fehler={error} />;
  }

  const aktive = aufgaben.filter((aufgabe) => !aufgabe.archiviert);
  const archiv = aufgaben.filter((aufgabe) => aufgabe.archiviert);
  const gruppen = ebenen.projekte ? gruppiereNachProjekt(aktive) : [];
  const oeffne = (aufgabe: BasisAufgabe | null) => setBearbeitung({ aufgabe });

  const zeile = (aufgabe: BasisAufgabe, mitProjekt: boolean) => (
    <BasisZeile
      key={aufgabe.id}
      aufgabe={aufgabe}
      mitProjekt={mitProjekt}
      laeuft={aktionen.laeuft}
      onErledigen={() => aktionen.erledigen(aufgabe.id)}
      onRueckgaengig={aktionen.rueckgaengig}
      onBearbeiten={() => oeffne(aufgabe)}
    />
  );

  return (
    <div className="space-y-6">
      <Fehlermeldung fehler={aktionen.fehler} />

      {aktive.length === 0 ? (
        <Leer
          text={tx("Noch keine Basis-Aufgaben.")}
          aktion={<Knopf onClick={() => oeffne(null)}>{tx("Basis-Aufgabe anlegen")}</Knopf>}
        />
      ) : ebenen.projekte ? (
        <>
          {gruppen.map((gruppe) => (
            <section key={gruppe.schluessel}>
              <AbschnittKopf titel={gruppe.projektName} />
              <Liste>{gruppe.aufgaben.map((aufgabe) => zeile(aufgabe, false))}</Liste>
            </section>
          ))}
          <Liste>
            <AnlegeZeile text="Basis-Aufgabe" onKlick={() => oeffne(null)} />
          </Liste>
        </>
      ) : (
        <Liste>
          {aktive.map((aufgabe) => zeile(aufgabe, false))}
          <AnlegeZeile text="Basis-Aufgabe" onKlick={() => oeffne(null)} />
        </Liste>
      )}

      {archiv.length > 0 && (
        <Abschnitt titel="Archiv" zusatz={`(${zahl(archiv.length)})`} kennung="basis-archiv" anfangEingeklappt>
          <Liste>
            {archiv.map((aufgabe) => (
              <SchnellZeile
                key={aufgabe.id}
                hintergrund="bg-transparent"
                ziel={{ art: 'basis', id: aufgabe.id, name: aufgabe.name, archiviert: true, loeschbar: aufgabe.loeschbar }}
              >
                {(menue) => (
                  <div className="flex min-h-12 items-center gap-3 px-4 py-3">
                    <Icon name={aufgabe.icon} className="size-5 shrink-0" style={{ color: aufgabe.farbe }} />
                    <span className="min-w-0 flex-1 truncate text-base">
                      {aufgabe.name}
                      {ebenen.projekte && aufgabe.projektName ? <span className="text-leise"> · {aufgabe.projektName}</span> : null}
                    </span>
                    {menue}
                  </div>
                )}
              </SchnellZeile>
            ))}
          </Liste>
        </Abschnitt>
      )}

      <Dialog offen={bearbeitung !== null} titel={tx("Basis-Aufgabe")} onSchliessen={() => setBearbeitung(null)}>
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
