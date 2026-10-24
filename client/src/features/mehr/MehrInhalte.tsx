import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import type { Vorlage } from '../../../../shared/api/index.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { TaetigkeitFormular } from '../taetigkeiten/TaetigkeitFormular.tsx';
import { Zeile, ZeilenGruppe } from '../../components/Zeile.tsx';
import { TAETIGKEITEN_GESEHEN, merke } from '../../speicher.ts';
import { tx } from '../../text.ts';
import { verbindungsStand } from './verbindungsStand.ts';
import { VerbindungenBereich } from '../../pages/Verbindungen.tsx';
import { VorlagenVerwaltung } from './MehrVorlagen.tsx';
import { Bereich, INHALTE_HASH, INHALTE_ZURUECK, useHashWeiter } from './rahmen.tsx';

function InhalteListe() {
  const [bearbeitung, setBearbeitung] = useState<{ vorlage: Vorlage | null } | null>(null);
  useEffect(() => {
    merke(TAETIGKEITEN_GESEHEN, true);
  }, []);
  const { data: verbindungen } = useQuery({ queryKey: SCHLUESSEL.verbindungen, queryFn: api.verbindungen });
  const stand = verbindungen ? verbindungsStand(verbindungen) : null;
  return (
    <Bereich
      titel={tx("Inhalte")}
      kinder={
        <div className="space-y-8">
          <div id="taetigkeiten" className="scroll-mt-24">
            <VorlagenVerwaltung onBearbeiten={(vorlage) => setBearbeitung({ vorlage })} />
          </div>
          <ZeilenGruppe>
            <Zeile
              titel={tx("Verbindungen")}
              wert={stand?.text ?? tx("Nicht verbunden")}
              gefahr={stand?.fehler}
              nach="/mehr/inhalte/verbindungen"
            />
          </ZeilenGruppe>
          <Dialog
            offen={bearbeitung !== null}
            titel={bearbeitung?.vorlage ? tx("Tätigkeit bearbeiten") : tx("Neue Tätigkeit")}
            onSchliessen={() => setBearbeitung(null)}
          >
            {bearbeitung && (
              <TaetigkeitFormular
                key={bearbeitung.vorlage?.id ?? 'neu'}
                vorlage={bearbeitung.vorlage}
                onFertig={() => setBearbeitung(null)}
              />
            )}
          </Dialog>
        </div>
      }
    />
  );
}

export function MehrInhalteSeite() {
  const { teil } = useParams();
  useHashWeiter(INHALTE_HASH);
  if (teil === 'taetigkeiten') {
    return <Navigate to="/mehr/inhalte" replace />;
  }
  if (teil === 'verbindungen') {
    return <Bereich titel={tx("Verbindungen")} zurueck={INHALTE_ZURUECK} kinder={<VerbindungenBereich />} />;
  }
  if (teil) {
    return <Navigate to="/mehr/inhalte" replace />;
  }
  return <InhalteListe />;
}
