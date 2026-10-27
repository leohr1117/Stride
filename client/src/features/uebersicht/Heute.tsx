import { tx } from '../../text.ts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { TrainingHeute } from '../../../../shared/api/training.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useFunktionen } from '../../funktionen.ts';
import { Fehlermeldung, Karte, Ueberschrift } from '../../ui/index.ts';
import { TrainingHeuteListe } from '../training/HeuteZeile.tsx';

export function Heute() {
  const funktionen = useFunktionen();
  const trainingAn = funktionen.training;
  const trainingQuery = useQuery({
    queryKey: SCHLUESSEL.heute,
    queryFn: api.trainingHeute,
    enabled: trainingAn,
  });
  const [startet, setStartet] = useState(false);
  const [startFehler, setStartFehler] = useState<unknown>(null);
  const navigiere = useNavigate();
  const client = useQueryClient();

  if (!trainingAn) {
    return null;
  }

  const training = trainingQuery.data ?? [];
  if (trainingQuery.isPending) {
    return null;
  }
  if (!trainingQuery.isError && training.length === 0) {
    return null;
  }

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
      <Ueberschrift titel={tx('Heute')} />
      <TrainingHeuteListe zeilen={training} startet={startet} onStart={(zeile) => void starten(zeile)} onOeffnen={oeffnen} />
      {trainingQuery.isError ? (
        <div className={training.length > 0 ? 'mt-2' : undefined}>
          <Fehlermeldung fehler={trainingQuery.error} />
        </div>
      ) : null}
      {startFehler ? (
        <div className="mt-2">
          <Fehlermeldung fehler={startFehler} />
        </div>
      ) : null}
    </Karte>
  );
}
