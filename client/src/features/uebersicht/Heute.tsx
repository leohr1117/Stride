import { tx } from '../../text.ts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Aufgabe } from '../../../../shared/api/aufgaben.ts';
import type { TrainingHeute } from '../../../../shared/api/training.ts';
import { datumInZone } from '../../../../shared/spiel/datum.ts';
import { erscheintAufHeute } from '../../../../shared/spiel/aufgabe.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { useFunktionen } from '../../funktionen.ts';
import { Fehlermeldung, Karte, Ueberschrift } from '../../ui/index.ts';
import { AufgabenListe, useAufgaben } from '../aufgaben/Aufgaben.tsx';
import { AufgabenFormular } from '../aufgaben/AufgabenDialog.tsx';
import { TrainingHeuteListe } from '../training/HeuteZeile.tsx';

const HEUTE_SICHTBAR = 5;

export function Heute() {
  const funktionen = useFunktionen();
  const aufgabenAn = funktionen.aufgaben;
  const trainingAn = funktionen.training;
  const { data: einstellungen } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const aufgabenQuery = useAufgaben(false, aufgabenAn);
  const trainingQuery = useQuery({
    queryKey: SCHLUESSEL.heute,
    queryFn: api.trainingHeute,
    enabled: trainingAn,
  });
  const [bearbeitung, setBearbeitung] = useState<Aufgabe | null>(null);
  const [startet, setStartet] = useState(false);
  const [startFehler, setStartFehler] = useState<unknown>(null);
  const navigiere = useNavigate();
  const client = useQueryClient();

  if (!aufgabenAn && !trainingAn) {
    return null;
  }

  const heute = datumInZone(new Date(), einstellungen?.zeitzone ?? null);
  const aufgaben = aufgabenAn && aufgabenQuery.data ? aufgabenQuery.data.filter((aufgabe) => erscheintAufHeute(aufgabe, heute)) : [];
  const training = trainingAn && trainingQuery.data ? trainingQuery.data : [];
  const aufgabenWarten = aufgabenAn && aufgabenQuery.isPending;
  const trainingWarten = trainingAn && trainingQuery.isPending;
  const aufgabenFehler = aufgabenAn && aufgabenQuery.isError;
  const trainingFehler = trainingAn && trainingQuery.isError;

  if (aufgabenWarten && (trainingWarten || (!trainingFehler && training.length === 0))) {
    return null;
  }
  if (trainingWarten && aufgaben.length === 0 && !aufgabenFehler) {
    return null;
  }
  if (!aufgabenFehler && !trainingFehler && !aufgabenWarten && !trainingWarten && aufgaben.length === 0 && training.length === 0) {
    return null;
  }
  if (aufgabenFehler && !trainingFehler && training.length === 0 && !trainingWarten) {
    return <Fehlermeldung fehler={aufgabenQuery.error} />;
  }

  const sichtbar = aufgaben.slice(0, HEUTE_SICHTBAR);

  async function starten(zeile: TrainingHeute) {
    setStartFehler(null);
    setStartet(true);
    try {
      await api.starteEinheit(zeile.planId);
      await client.invalidateQueries({ queryKey: SCHLUESSEL.heute });
    } catch (fehler) {
      setStartFehler(fehler);
    } finally {
      setStartet(false);
    }
  }

  function oeffnen(zeile: TrainingHeute) {
    if (zeile.einheitId === null) {
      return;
    }
    navigiere(`/training/einheiten/${zeile.einheitId}`, { state: { von: '/' } });
  }

  return (
    <Karte>
      <Ueberschrift
        titel={tx('Heute')}
        aktion={
          aufgaben.length > HEUTE_SICHTBAR ? (
            <Link to="/aufgaben" data-herkunft="/" state={{ herkunft: '/' }} className="text-sm font-medium text-akzent">
              {tx('Alle')}
            </Link>
          ) : null
        }
      />
      {aufgabenFehler ? <Fehlermeldung fehler={aufgabenQuery.error} /> : null}
      {sichtbar.length > 0 ? <AufgabenListe aufgaben={sichtbar} onBearbeiten={setBearbeitung} /> : null}
      <TrainingHeuteListe zeilen={training} startet={startet} onStart={(zeile) => void starten(zeile)} onOeffnen={oeffnen} />
      {trainingFehler ? (
        <div className="mt-2">
          <Fehlermeldung fehler={trainingQuery.error} />
        </div>
      ) : null}
      {startFehler ? (
        <div className="mt-2">
          <Fehlermeldung fehler={startFehler} />
        </div>
      ) : null}
      <Dialog offen={bearbeitung !== null} titel={tx('Aufgabe bearbeiten')} onSchliessen={() => setBearbeitung(null)}>
        {bearbeitung && (
          <AufgabenFormular key={bearbeitung.id} aufgabe={bearbeitung} onFertig={() => setBearbeitung(null)} />
        )}
      </Dialog>
    </Karte>
  );
}
