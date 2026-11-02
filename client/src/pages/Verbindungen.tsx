import { tx } from '../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Pencil, Plus, RefreshCw } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { type Kalender, type TodoistStatus } from '../../../shared/api/index.ts';
import { istAn } from '../../../shared/spiel/sichtbarkeit.ts';
import { api, SCHLUESSEL } from '../api/index.ts';
import { useSichtbarkeit } from '../funktionen.ts';
import { Dialog } from '../components/Dialog.tsx';
import { SchnellZeile, useSchnellAktion } from '../components/SchnellAktion.tsx';
import { fehlerAnzeige } from '../features/mehr/verbindungsStand.ts';
import { Fehlermeldung, Formular, InfoHinweis, Karte, Knopf, Ladeanzeige, PasswortFeld } from '../ui/index.ts';
import { KalenderFormular } from '../features/kalender/Einrichtung.tsx';
import { TodoistTokenSchritte } from '../features/todoist/Einrichtung.tsx';
import { TodoistZuordnungen } from '../features/todoist/Zuordnungen.tsx';
import { kurzesDatum, uhrzeit, zahl } from '../format.ts';

function zeitpunktText(iso: string | null): string | null {
  return iso ? `${kurzesDatum(iso)}, ${uhrzeit(iso)}` : null;
}

function useProjekte() {
  const { data: ziele } = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele });
  return (ziele?.projekte ?? []).filter((projekt) => projekt.aktiv);
}

function Status({ letzter, fehler, uebernommen }: { letzter: string | null; fehler: string | null; uebernommen: number }) {
  const zeit = zeitpunktText(letzter);
  const zeilen = fehler ? fehlerAnzeige(fehler).split('\n') : [];
  return (
    <div className="space-y-1 text-xs">
      <p className="text-leise">
        {zeit ? tx('Abgeglichen {zeit}', { zeit }) : tx('Noch nicht abgeglichen')}
        <span className="whitespace-nowrap">{` · ${tx('{anzahl} übernommen', { anzahl: zahl(uebernommen) })}`}</span>
      </p>
      {zeilen.map((zeile) => (
        <p key={zeile} className="break-words text-gefahr">
          {zeile}
        </p>
      ))}
    </div>
  );
}

export function VerbindungenBereich() {
  const queryClient = useQueryClient();
  const schnell = useSchnellAktion();
  const { data, error, isPending } = useQuery({ queryKey: SCHLUESSEL.verbindungen, queryFn: api.verbindungen });
  const abgleichen = useMutation({
    mutationFn: api.gleicheAb,
    onSuccess: (ergebnis) => {
      const text =
        ergebnis.neu === 0
          ? tx('Keine neuen Einträge.')
          : tx('{zahl} neue Einträge übernommen.', { zahl: zahl(ergebnis.neu) });
      schnell.melde(text);
      void queryClient.invalidateQueries();
    },
  });

  if (isPending) {
    return <Ladeanzeige />;
  }
  if (error) {
    return <Fehlermeldung fehler={error} />;
  }

  const nurKalender = !data.todoist.verbunden && data.kalender.length > 0;

  return (
    <div className="space-y-4">
      {nurKalender ? (
        <div className="flex justify-end">
          <Knopf onClick={() => abgleichen.mutate()} disabled={abgleichen.isPending}>
            <RefreshCw className={`size-4 ${abgleichen.isPending ? 'animate-spin' : ''}`} />
            {tx('Jetzt abgleichen')}
          </Knopf>
        </div>
      ) : null}
      <Fehlermeldung fehler={abgleichen.error} />
      <TodoistBereich
        status={data.todoist}
        abgleichLaeuft={abgleichen.isPending}
        onAbgleich={() => abgleichen.mutate()}
      />
      <KalenderKarte kalender={data.kalender} />
    </div>
  );
}

function TodoistBereich({
  status,
  abgleichLaeuft,
  onAbgleich,
}: {
  status: TodoistStatus;
  abgleichLaeuft: boolean;
  onAbgleich: () => void;
}) {
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
  const zeit = zeitpunktText(status.letzterAbgleich);
  const fehlerZeilen = status.fehler ? fehlerAnzeige(status.fehler).split('\n') : [];

  return (
    <section id="todoist" className="space-y-4">
      <div>
        <h2 className="text-base font-semibold leading-6">{tx('Todoist')}</h2>
        <p className="mt-1 text-sm text-leise">{tx('Jede erledigte Aufgabe wird ein Eintrag mit XP.')}</p>
      </div>
      {status.verbunden ? (
        <>
          <SchnellZeile ziel={{ art: 'todoist', id: 0, name: tx('Todoist') }}>
            {(menue) => (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{tx('Verbunden als {name}', { name: status.nutzer ?? '' })}</p>
                  <p className="flex items-center text-[13px] leading-[18px] text-leise">
                    <span className="min-w-0">{zeit ? tx('Zuletzt abgeglichen {zeit}', { zeit }) : tx('Noch nicht abgeglichen')}</span>
                    <InfoHinweis text="Beim Öffnen und alle 15 Minuten, nachts alle 3 Stunden." />
                  </p>
                  {fehlerZeilen.map((zeile) => (
                    <p key={zeile} className="break-words text-xs text-gefahr">
                      {zeile}
                    </p>
                  ))}
                </div>
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    data-schnell-frei=""
                    className="min-h-12 px-1 text-haupt disabled:opacity-50"
                    disabled={abgleichLaeuft}
                    onClick={onAbgleich}
                  >
                    {tx('Jetzt abgleichen')}
                  </button>
                  {menue}
                </div>
              </div>
            )}
          </SchnellZeile>
          <TodoistZuordnungen status={status} />
        </>
      ) : (
        <Formular onAbsenden={absenden} abstand="space-y-3">
          <TodoistTokenSchritte />
          <PasswortFeld
            label={tx('API-Token')}
            autoComplete="off"
            value={token}
            onChange={(ereignis) => setToken(ereignis.target.value)}
          />
          <div className="flex justify-end">
            <Knopf type="submit" variante="primaer" disabled={token.trim() === '' || verbinden.isPending}>
              {verbinden.isPending ? tx('Prüfe …') : tx('Verbinden')}
            </Knopf>
          </div>
          <Fehlermeldung fehler={verbinden.error} />
        </Formular>
      )}
    </section>
  );
}

function KalenderKarte({ kalender }: { kalender: Kalender[] }) {
  const projekteAn = istAn('projekte', useSichtbarkeit());
  const [dialog, setDialog] = useState<{ kalender: Kalender | null } | null>(null);
  const projekte = useProjekte();
  const projektName = new Map(projekte.map((projekt) => [projekt.id, projekt.name]));

  return (
    <Karte className="space-y-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex min-w-0 items-center">
          <h2 className="ueberschrift min-w-0 text-sm font-semibold tracking-wide text-leise uppercase">{tx("Kalender")}</h2>
          <InfoHinweis text="Vergangene Termine werden zu Einträgen. Beim Öffnen der App und alle 15 Minuten." />
        </div>
        {projekteAn ? (
          <Knopf variante="leise" className="px-2 py-1" onClick={() => setDialog({ kalender: null })}>
            <Plus className="size-4" />
            {tx("Kalender")}
          </Knopf>
        ) : null}
      </div>
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
                        {[projekteAn && eintrag.projektId !== null ? (projektName.get(eintrag.projektId) ?? tx("Projekt archiviert")) : null, eintrag.filter || null]
                          .filter((teil) => teil)
                          .join(' · ')}
                      </p>
                    )}
                    <Status letzter={eintrag.letzterAbgleich} fehler={eintrag.fehler} uebernommen={eintrag.uebernommen} />
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
