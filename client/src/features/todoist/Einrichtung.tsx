import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TodoistStatus, Vorlage } from '../../../../shared/api/index.ts';
import { api } from '../../api/index.ts';
import { tx } from '../../text.ts';
import { EINGABE_STIL, Fehlermeldung, InfoHinweis } from '../../ui/index.ts';
import { merkeStatus, useTodoistBlick } from './gemeinsam.ts';

const TODOIST_TOKEN_SEITE = 'https://app.todoist.com/app/settings/integrations/developer';
const KEINE_AUSWAHL = '';

const HINWEIS_OHNE = 'Erledigte Aufgaben ohne Zuordnung zählen als diese Tätigkeit oder gar nicht.';

export function TodoistTokenSchritte() {
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm marker:text-leise">
      <li>
        {tx('Öffne die Entwicklerseite in Todoist.')}{' '}
        <a
          href={TODOIST_TOKEN_SEITE}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-wrap items-center gap-1 text-akzent hover:underline"
        >
          {tx('Token in Todoist öffnen')}
          <ExternalLink className="size-3.5 shrink-0" />
        </a>
      </li>
      <li>{tx('Kopiere den API-Token.')}</li>
      <li>{tx('Füge ihn hier ein und tippe auf Verbinden.')}</li>
    </ol>
  );
}

function TaetigkeitWahl({
  taetigkeiten,
  wert,
  onAendern,
}: {
  taetigkeiten: Vorlage[];
  wert: number | null;
  onAendern: (id: number) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{tx('Standard-Tätigkeit')}</span>
      <select
        className={EINGABE_STIL}
        value={wert ?? KEINE_AUSWAHL}
        onChange={(ereignis) => {
          if (ereignis.target.value !== KEINE_AUSWAHL) {
            onAendern(Number(ereignis.target.value));
          }
        }}
      >
        <option value={KEINE_AUSWAHL}>{tx('Tätigkeit')}</option>
        {taetigkeiten.map((vorlage) => (
          <option key={vorlage.id} value={vorlage.id}>
            {vorlage.projektName ? `${vorlage.name} · ${vorlage.projektName}` : vorlage.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function OhneZuordnung({ status }: { status: TodoistStatus }) {
  const { taetigkeiten } = useTodoistBlick();
  const client = useQueryClient();
  const [wahl, setWahl] = useState(status.ohneZuordnung);
  useEffect(() => {
    setWahl(status.ohneZuordnung);
  }, [status.ohneZuordnung]);
  const speichern = useMutation({
    mutationFn: (daten: { art: 'keine' | 'standard'; vorlageId: number | null }) => api.setzeTodoistOhne(daten.art, daten.vorlageId),
    onSuccess: (neu) => merkeStatus(client, neu),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center">
        <h3 className="text-sm font-medium">{tx('Aufgaben ohne Zuordnung')}</h3>
        <InfoHinweis text={HINWEIS_OHNE} />
      </div>
      <select
        className={EINGABE_STIL}
        aria-label={tx('Aufgaben ohne Zuordnung')}
        value={wahl}
        onChange={(ereignis) => {
          const naechstes = ereignis.target.value === 'standard' ? 'standard' : 'keine';
          setWahl(naechstes);
          if (naechstes === 'keine') {
            speichern.mutate({ art: 'keine', vorlageId: null });
          } else if (status.standardVorlageId !== null) {
            speichern.mutate({ art: 'standard', vorlageId: status.standardVorlageId });
          }
        }}
      >
        <option value="keine">{tx('Nicht zählen')}</option>
        <option value="standard">{tx('Zählen als Standard-Tätigkeit')}</option>
      </select>
      {wahl === 'standard' ? (
        <TaetigkeitWahl
          taetigkeiten={taetigkeiten}
          wert={status.standardVorlageId}
          onAendern={(id) => speichern.mutate({ art: 'standard', vorlageId: id })}
        />
      ) : null}
      <Fehlermeldung fehler={speichern.error} />
    </div>
  );
}

export function TodoistEinrichtung({ status }: { status: TodoistStatus }) {
  return <OhneZuordnung status={status} />;
}
