import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { Vorhaben } from '../../../../shared/api/index.ts';
import { BOSS_DATUM_INFO } from '../../../../shared/spiel/xp.ts';
import { api } from '../../api/index.ts';
import { lokalesDatum } from '../../format.ts';
import { feldLeer, tx } from '../../text.ts';
import { EINGABE_STIL, Fehlermeldung, Feld, Formular, InfoHinweis, Knopf } from '../../ui/index.ts';

export function BossFormular({ vorhaben, onFertig }: { vorhaben: Vorhaben; onFertig: () => void }) {
  const queryClient = useQueryClient();
  const heute = lokalesDatum(new Date());
  const [deadline, setDeadline] = useState(vorhaben.boss?.deadline ?? '');
  const [datumFehler, setDatumFehler] = useState<string | null>(null);
  const deadlineGueltig = /^\d{4}-\d{2}-\d{2}$/.test(deadline);
  const minDatum = deadlineGueltig && deadline < heute ? deadline : heute;

  const speichern = useMutation({
    mutationFn: (beenden: boolean) =>
      api.aendereVorhaben(vorhaben.id, {
        boss: beenden ? null : { deadline },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onFertig();
    },
  });

  const absenden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (!deadlineGueltig) {
      setDatumFehler(feldLeer('Deadline'));
      return;
    }
    if (speichern.isPending) {
      return;
    }
    setDatumFehler(null);
    speichern.mutate(false);
  };

  return (
    <Formular onAbsenden={absenden}>
      <p className="font-medium">{vorhaben.titel}</p>
      <Feld
        label={
          <span className="inline-flex items-center">
            {tx("Deadline")}
            <InfoHinweis name="Deadline" text={BOSS_DATUM_INFO} />
          </span>
        }
        fehler={datumFehler}
      >
        <input
          type="date"
          min={minDatum}
          className={EINGABE_STIL}
          value={deadline}
          onChange={(ereignis) => {
            setDeadline(ereignis.target.value);
            setDatumFehler(null);
          }}
          autoFocus
        />
      </Feld>
      <Fehlermeldung fehler={speichern.error} />
      <div className="flex gap-2">
        {vorhaben.boss && (
          <Knopf variante="gefahr" onClick={() => speichern.mutate(true)} disabled={speichern.isPending}>
            {tx("Kein Boss mehr")}
          </Knopf>
        )}
        <Knopf type="submit" variante="primaer" className="flex-1" aria-busy={speichern.isPending || undefined}>
          {tx("Speichern")}
        </Knopf>
      </div>
    </Formular>
  );
}
