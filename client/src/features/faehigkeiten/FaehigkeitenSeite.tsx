import { tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { ArchivListe } from '../../components/ArchivListe.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { FaehigkeitFormular } from '../../components/FaehigkeitFormular.tsx';
import { SchnellZeile } from '../../components/SchnellAktion.tsx';
import { AnlegeZeile, Liste, Zeile } from '../../components/Zeile.tsx';
import { Fehlermeldung, Knopf, Ladeanzeige, Leer, LevelRing } from '../../ui/index.ts';

export function FaehigkeitenSeite() {
  const { data: faehigkeiten, error, isPending } = useQuery({ queryKey: SCHLUESSEL.faehigkeiten, queryFn: api.faehigkeiten });
  const [neuOffen, setNeuOffen] = useState(false);
  const navigieren = useNavigate();
  const ort = useLocation();
  const anlegen = (ort.state as { anlegen?: string } | null)?.anlegen;
  useEffect(() => {
    if (anlegen !== 'faehigkeit') {
      return;
    }
    setNeuOffen(true);
    navigieren(ort.pathname, { replace: true, state: null });
  }, [anlegen, navigieren, ort.pathname]);
  const liste = faehigkeiten ?? [];
  const aktive = liste.filter((faehigkeit) => !faehigkeit.archiviert);
  const archiv = liste.filter((faehigkeit) => faehigkeit.archiviert);

  if (isPending) {
    return <Ladeanzeige />;
  }

  return (
    <div className="space-y-6">
      <Fehlermeldung fehler={error} />
      {aktive.length === 0 ? (
        <Leer text={tx('Noch keine Fähigkeiten.')} aktion={<Knopf onClick={() => setNeuOffen(true)}>{`+ ${tx('Fähigkeit anlegen')}`}</Knopf>} />
      ) : (
        <Liste>
          {aktive.map((faehigkeit) => (
            <SchnellZeile
              key={faehigkeit.id}
              ziel={{
                art: 'faehigkeit',
                id: faehigkeit.id,
                name: faehigkeit.name,
                archiviert: faehigkeit.archiviert,
                loeschbar: faehigkeit.loeschbar,
              }}
            >
              {(menue) => (
                <Zeile
                  nach={`/faehigkeiten/${faehigkeit.id}`}
                  name={faehigkeit.name}
                  symbol={<LevelRing level={faehigkeit.level.level} anteil={faehigkeit.level.fortschritt} groesse={56} />}
                  symbolKlasse="pointer-events-none flex shrink-0 items-center justify-center"
                  titel={faehigkeit.name}
                  menue={menue}
                />
              )}
            </SchnellZeile>
          ))}
          <AnlegeZeile text="Fähigkeit anlegen" onKlick={() => setNeuOffen(true)} />
        </Liste>
      )}
      <ArchivListe
        eintraege={archiv.map((faehigkeit) => ({
          schluessel: `f-${faehigkeit.id}`,
          name: faehigkeit.name,
          icon: faehigkeit.icon,
          farbe: faehigkeit.farbe,
          ziel: {
            art: 'faehigkeit' as const,
            id: faehigkeit.id,
            name: faehigkeit.name,
            archiviert: true,
            loeschbar: faehigkeit.loeschbar,
          },
        }))}
      />
      <Dialog offen={neuOffen} titel={tx('Fähigkeit')} onSchliessen={() => setNeuOffen(false)}>
        {neuOffen && (
          <FaehigkeitFormular
            faehigkeit={null}
            onFertig={(gespeichert) => {
              setNeuOffen(false);
              void navigieren(`/faehigkeiten/${gespeichert.id}`);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
