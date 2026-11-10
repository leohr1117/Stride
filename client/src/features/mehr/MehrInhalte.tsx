import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router';
import type { Vorlage } from '../../../../shared/api/index.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { TaetigkeitFormular, TaetigkeitMenue } from '../taetigkeiten/TaetigkeitFormular.tsx';
import { TAETIGKEITEN_GESEHEN, merke } from '../../speicher.ts';
import { tx } from '../../text.ts';
import { VerbindungenBereich } from '../../pages/Verbindungen.tsx';
import { VorlagenVerwaltung } from './MehrVorlagen.tsx';
import { Bereich, INHALTE_HASH, useHashWeiter } from './rahmen.tsx';

function InhalteListe() {
  const [bearbeitung, setBearbeitung] = useState<{ vorlage: Vorlage | null } | null>(null);
  const ort = useLocation();
  const navigiere = useNavigate();
  const anlegen = (ort.state as { anlegen?: string } | null)?.anlegen;
  useEffect(() => {
    merke(TAETIGKEITEN_GESEHEN, true);
  }, []);
  useEffect(() => {
    if (anlegen !== 'taetigkeit') {
      return;
    }
    setBearbeitung({ vorlage: null });
    navigiere(ort.pathname, { replace: true, state: null });
  }, [anlegen, navigiere, ort.pathname]);
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
            menu={
              bearbeitung?.vorlage ? (
                <TaetigkeitMenue vorlage={bearbeitung.vorlage} onErledigt={() => setBearbeitung(null)} />
              ) : undefined
            }
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
  const { teil, verbinder } = useParams();
  useHashWeiter(INHALTE_HASH);
  if (teil === 'taetigkeiten') {
    return <Navigate to="/mehr/inhalte" replace />;
  }
  if (teil === 'verbindungen') {
    if (verbinder === 'todoist' || verbinder === 'kalender') {
      const titel = verbinder === 'todoist' ? tx('Todoist') : tx('Kalender');
      return <Bereich titel={titel} kinder={<VerbindungenBereich ansicht={verbinder} />} />;
    }
    if (verbinder) {
      return <Navigate to="/mehr/inhalte/verbindungen" replace />;
    }
    return <Bereich titel={tx('Verbindungen')} kinder={<VerbindungenBereich ansicht="uebersicht" />} />;
  }
  if (teil) {
    return <Navigate to="/mehr/inhalte" replace />;
  }
  return <InhalteListe />;
}
