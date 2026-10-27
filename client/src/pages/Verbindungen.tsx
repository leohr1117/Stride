import { tx } from '../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ListChecks, Pencil, Plus, RefreshCw } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { type Kalender, type TodoistStatus } from '../../../shared/api/index.ts';
import { istAn } from '../../../shared/spiel/sichtbarkeit.ts';
import { api, SCHLUESSEL } from '../api/index.ts';
import { useSichtbarkeit } from '../funktionen.ts';
import { Dialog } from '../components/Dialog.tsx';
import { SchnellZeile } from '../components/SchnellAktion.tsx';
import { Fehlermeldung, Formular, InfoHinweis, Karte, Knopf, Ladeanzeige, PasswortFeld, Ueberschrift } from '../ui/index.ts';
import { KalenderFormular } from '../features/kalender/Einrichtung.tsx';
import { TodoistEinrichtung, TodoistTokenSchritte } from '../features/todoist/Einrichtung.tsx';
import { TodoistZuordnungen } from '../features/todoist/Zuordnungen.tsx';
import { kurzesDatum, uhrzeit, zahl } from '../format.ts';

function zeitpunktText(iso: string | null): string | null {
  return iso ? `${kurzesDatum(iso)}, ${uhrzeit(iso)}` : null;
}

function useProjekte() {
  const { data: ziele } = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele });
  return (ziele?.projekte ?? []).filter((projekt) => projekt.aktiv);
}

function Status({ letzter, fehler, zusatz }: { letzter: string | null; fehler: string | null; zusatz?: ReactNode }) {
  const zeit = zeitpunktText(letzter);
  return (
    <div className="space-y-1 text-xs">
      {(zeit || zusatz) && (
        <p className="text-leise">
          {zeit && tx('Abgeglichen {zeit}', { zeit })}
          {zeit && zusatz && ' · '}
          {zusatz}
        </p>
      )}
      {fehler && <p className="text-gefahr">{fehler}</p>}
    </div>
  );
}

export function VerbindungenBereich() {
  const queryClient = useQueryClient();
  const { data, error, isPending } = useQuery({ queryKey: SCHLUESSEL.verbindungen, queryFn: api.verbindungen });
  const abgleichen = useMutation({
    mutationFn: api.gleicheAb,
    onSuccess: () => void queryClient.invalidateQueries(),
  });

  if (isPending) {
    return <Ladeanzeige />;
  }
  if (error) {
    return <Fehlermeldung fehler={error} />;
  }

  const verbunden = data.todoist.verbunden || data.kalender.length > 0;

  return (
    <div className="space-y-4">
      {verbunden ? (
        <div className="flex justify-end">
          <Knopf onClick={() => abgleichen.mutate()} disabled={abgleichen.isPending}>
            <RefreshCw className={`size-4 ${abgleichen.isPending ? 'animate-spin' : ''}`} />
            {tx("Jetzt abgleichen")}
          </Knopf>
        </div>
      ) : null}
      {abgleichen.data && (
        <p className="text-sm text-leise">
          {abgleichen.data.neu === 0
            ? tx("Keine neuen Einträge.")
            : tx('{zahl} neue Einträge übernommen.', { zahl: zahl(abgleichen.data.neu) })}
        </p>
      )}
      <Fehlermeldung fehler={abgleichen.error} />

      <TodoistKarte status={data.todoist} />
      <KalenderKarte kalender={data.kalender} />
    </div>
  );
}

function TodoistKarte({ status }: { status: TodoistStatus }) {
  const projekteAn = istAn('projekte', useSichtbarkeit());
  const queryClient = useQueryClient();
  const [token, setToken] = useState('');
  const aktualisieren = () => void queryClient.invalidateQueries({ queryKey: SCHLUESSEL.verbindungen });
  const verbinden = useMutation({
    mutationFn: () => api.verbindeTodoist(token.trim()),
    onSuccess: () => {
      setToken('');
      aktualisieren();
    },
  });
  const absenden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    verbinden.mutate();
  };

  return (
    <Karte className="space-y-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center">
          <h2 className="ueberschrift text-sm font-semibold tracking-wide text-leise uppercase">{tx("Todoist")}</h2>
          <InfoHinweis text="Erledigte Aufgaben werden zu Einträgen, sobald du verbunden bist. Tagsüber alle 15 Minuten, zwischen 23 und 6 Uhr alle 3 Stunden." />
        </div>
      </div>
      {status.verbunden ? (
        <>
          <SchnellZeile ziel={{ art: 'todoist', id: 0, name: tx("Todoist") }}>
            {(menue) => (
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-akzent/15 text-akzent">
                  <ListChecks className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{status.nutzer}</p>
                  <Status letzter={status.letzterAbgleich} fehler={status.fehler} />
                </div>
                {menue}
              </div>
            )}
          </SchnellZeile>
          <TodoistEinrichtung status={status} />
          {projekteAn ? <TodoistZuordnungen status={status} /> : null}
        </>
      ) : (
        <Formular onAbsenden={absenden} abstand="space-y-3">
          <TodoistTokenSchritte />
          <PasswortFeld
            label={tx("API-Token")}
            autoComplete="off"
            value={token}
            onChange={(ereignis) => setToken(ereignis.target.value)}
          />
          <div className="flex justify-end">
            <Knopf type="submit" variante="primaer" disabled={token.trim() === '' || verbinden.isPending}>
              {verbinden.isPending ? tx("Prüfe …") : tx("Verbinden")}
            </Knopf>
          </div>
          <Fehlermeldung fehler={verbinden.error} />
        </Formular>
      )}
    </Karte>
  );
}

function KalenderKarte({ kalender }: { kalender: Kalender[] }) {
  const projekteAn = istAn('projekte', useSichtbarkeit());
  const [dialog, setDialog] = useState<{ kalender: Kalender | null } | null>(null);
  const projekte = useProjekte();
  const projektName = new Map(projekte.map((projekt) => [projekt.id, projekt.name]));

  return (
    <Karte className="space-y-4">
      <Ueberschrift
        titel={tx("Kalender")}
        aktion={
          projekteAn ? (
            <Knopf variante="leise" className="px-2 py-1" onClick={() => setDialog({ kalender: null })}>
              <Plus className="size-4" />
              {tx("Kalender")}
            </Knopf>
          ) : undefined
        }
      />
      {kalender.length > 0 ? (
        <div className="divide-y divide-rand">
          {kalender.map((eintrag) => (
            <SchnellZeile key={eintrag.id} ziel={{ art: 'kalender', id: eintrag.id, name: eintrag.name }}>
              {(menue) => (
                <div className="flex items-center gap-3 py-1">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-akzent/15 text-akzent">
                    <CalendarDays className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{eintrag.name}</p>
                    {(projekteAn || eintrag.filter) && (
                      <p className="truncate text-xs text-leise">
                        {[projekteAn ? (projektName.get(eintrag.projektId) ?? tx("Projekt archiviert")) : null, eintrag.filter || null]
                          .filter((teil) => teil)
                          .join(' · ')}
                      </p>
                    )}
                    <Status
                      letzter={eintrag.letzterAbgleich}
                      fehler={eintrag.fehler}
                      zusatz={tx('{anzahl} übernommen', { anzahl: zahl(eintrag.uebernommen) })}
                    />
                  </div>
                  {menue}
                  <Knopf
                    variante="leise"
                    className="p-2"
                    aria-label={tx('{name} bearbeiten', { name: eintrag.name })}
                    onClick={() => setDialog({ kalender: eintrag })}
                  >
                    <Pencil className="size-4" />
                  </Knopf>
                </div>
              )}
            </SchnellZeile>
          ))}
        </div>
      ) : null}
      <Dialog
        offen={dialog !== null}
        titel={dialog?.kalender ? dialog.kalender.name : tx("Kalender verbinden")}
        onSchliessen={() => setDialog(null)}
      >
        {dialog && <KalenderFormular key={dialog.kalender?.id ?? 'neu'} kalender={dialog.kalender} onFertig={() => setDialog(null)} />}
      </Dialog>
    </Karte>
  );
}
