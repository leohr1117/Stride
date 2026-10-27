import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import type { Vorlage } from '../../../../shared/api/index.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { TaetigkeitFormular } from '../taetigkeiten/TaetigkeitFormular.tsx';
import { TAETIGKEITEN_GESEHEN, merke } from '../../speicher.ts';
import { tx } from '../../text.ts';
import { VerbindungenBereich } from '../../pages/Verbindungen.tsx';
import { VorlagenVerwaltung } from './MehrVorlagen.tsx';
import { Bereich, FUNKTIONEN_ZURUECK, INHALTE_HASH, useHashWeiter } from './rahmen.tsx';

function InhalteListe() {
  const [bearbeitung, setBearbeitung] = useState<{ vorlage: Vorlage | null } | null>(null);
  useEffect(() => {
    merke(TAETIGKEITEN_GESEHEN, true);
  }, []);
  return (
    <Bereich
      titel={tx("Tätigkeiten")}
      kinder={
        <div className="space-y-8">
          <div id="taetigkeiten" className="scroll-mt-24">
            <VorlagenVerwaltung onBearbeiten={(vorlage) => setBearbeitung({ vorlage })} />
          </div>
          <Dialog
            offen={bearbeitung !== null}
            titel={bearbeitung?.vorlage ? tx("Tätigkeit bearbeiten") : tx("Tätigkeit anlegen")}
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
    return <Bereich titel={tx("Verbindungen")} zurueck={FUNKTIONEN_ZURUECK} kinder={<VerbindungenBereich />} />;
  }
  if (teil) {
    return <Navigate to="/mehr/inhalte" replace />;
  }
  return <InhalteListe />;
}
