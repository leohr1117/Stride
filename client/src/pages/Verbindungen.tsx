import { tx } from '../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { type TodoistStatus } from '../../../shared/api/index.ts';
import { api, SCHLUESSEL } from '../api/index.ts';
import { SchnellZeile, useSchnellAktion } from '../components/SchnellAktion.tsx';
import { fehlerAnzeige } from '../features/mehr/verbindungsStand.ts';
import { Fehlermeldung, Formular, InfoHinweis, Knopf, Ladeanzeige, PasswortFeld } from '../ui/index.ts';
import { KalenderAbschnitt } from '../features/kalender/Liste.tsx';
import { TodoistTokenSchritte } from '../features/todoist/Einrichtung.tsx';
import { TodoistZuordnungen } from '../features/todoist/Zuordnungen.tsx';
import { kurzesDatum, uhrzeit, zahl } from '../format.ts';

function zeitpunktText(iso: string | null): string | null {
  return iso ? `${kurzesDatum(iso)}, ${uhrzeit(iso)}` : null;
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
      <KalenderAbschnitt kalender={data.kalender} />
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
                    <InfoHinweis name="Zuletzt abgeglichen" text="Beim Öffnen und alle 15 Minuten, nachts alle 3 Stunden." />
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

