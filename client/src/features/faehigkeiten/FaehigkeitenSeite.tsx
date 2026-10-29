import { tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { ArchivListe } from '../../components/ArchivListe.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { FaehigkeitFormular } from '../../components/FaehigkeitFormular.tsx';
import { SchnellZeile } from '../../components/SchnellAktion.tsx';
import { AnlegeZeile, Liste } from '../../components/Zeile.tsx';
import { Fehlermeldung, Knopf, Ladeanzeige, Leer, LevelRing } from '../../ui/index.ts';

export function FaehigkeitenSeite() {
  const { data: faehigkeiten, error, isPending } = useQuery({ queryKey: SCHLUESSEL.faehigkeiten, queryFn: api.faehigkeiten });
  const [neuOffen, setNeuOffen] = useState(false);
  const navigieren = useNavigate();
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
        <Leer text={tx('Noch keine Fähigkeiten.')} aktion={<Knopf onClick={() => setNeuOffen(true)}>{tx('Fähigkeit anlegen')}</Knopf>} />
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
                <div className="relative flex items-center gap-3 px-4 py-3">
                  <LevelRing level={faehigkeit.level.level} anteil={faehigkeit.level.fortschritt} groesse={56} />
                  <Link to={`/faehigkeiten/${faehigkeit.id}`} aria-label={faehigkeit.name} className="absolute inset-0 z-0" />
                  <span className="pointer-events-none min-w-0 flex-1">
                    <span className="block truncate text-base leading-6">{faehigkeit.name}</span>
                    <span className="block truncate text-[13px] leading-[18px] text-leise">
                      {tx('Lvl {level}', { level: faehigkeit.level.level })}
                      {' · '}
                      {tx(faehigkeit.stufe)}
                    </span>
                  </span>
                  <span className="pointer-events-auto relative z-10">{menue}</span>
                  <ChevronRight className="pointer-events-none size-5 shrink-0 text-leise" aria-hidden />
                </div>
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
      <Dialog offen={neuOffen} titel={tx('Neue Fähigkeit')} onSchliessen={() => setNeuOffen(false)}>
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
