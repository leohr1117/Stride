import { feldLeer, tx, txMenge } from '../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, CircleMinus, RefreshCw } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { type TodoistStatus, type Verbindungen } from '../../../shared/api/index.ts';
import { api, SCHLUESSEL } from '../api/index.ts';
import { SchnellZeile, useSchnellAktion } from '../components/SchnellAktion.tsx';
import { DichteZeilen, Zeile, ZeilenGruppe } from '../components/Zeile.tsx';
import { fehlerAnzeige, kalenderLage, todoistLage, type VerbindungsLage } from '../features/mehr/verbindungsStand.ts';
import { AbschnittKopf, Fehlermeldung, Flaeche, Formular, InfoHinweis, Knopf, Ladeanzeige, PasswortFeld } from '../ui/index.ts';
import { KalenderAbschnitt } from '../features/kalender/Liste.tsx';
import { letzterAbgleich } from '../features/kalender/stand.ts';
import { TodoistTokenSchritte } from '../features/todoist/Einrichtung.tsx';
import { TodoistZuordnungen } from '../features/todoist/Zuordnungen.tsx';
import { kurzesDatum, relativeZeit, uhrzeit, zahl } from '../format.ts';

function zeitpunktText(iso: string | null): string | null {
  return iso ? `${kurzesDatum(iso)}, ${uhrzeit(iso)}` : null;
}

const SYMBOL: Record<VerbindungsLage, typeof CircleCheck> = {
  verbunden: CircleCheck,
  fehler: CircleAlert,
  aus: CircleMinus,
};

const SYMBOL_FARBE: Record<VerbindungsLage, string> = {
  verbunden: 'text-haupt',
  fehler: 'text-gefahr',
  aus: 'text-leise',
};

const LAGE_TEXT = {
  verbunden: 'Verbunden',
  fehler: 'Fehler',
  aus: 'Aus',
} as const;

const SYMBOL_KLASSE = 'pointer-events-none flex size-5 shrink-0 items-center justify-center [&_svg]:size-5';

function nebenzeile(lage: VerbindungsLage, iso: string | null): string | null {
  if (lage !== 'verbunden') {
    return null;
  }
  return iso ? tx('{zeit} abgeglichen', { zeit: relativeZeit(iso) }) : tx('Noch nicht abgeglichen');
}

function statusZeile(titel: 'Todoist' | 'Kalender', lage: VerbindungsLage, iso: string | null, nach: string) {
  const text = tx(LAGE_TEXT[lage]);
  const neben = nebenzeile(lage, iso);
  const Icon = SYMBOL[lage];
  const name = neben ? `${tx(titel)}, ${text}, ${neben}` : `${tx(titel)}, ${text}`;
  return (
    <Zeile
      titel={tx(titel)}
      name={name}
      nach={nach}
      symbol={<Icon aria-hidden="true" />}
      symbolKlasse={`${SYMBOL_KLASSE} ${SYMBOL_FARBE[lage]}`}
      wert={text}
      neben={neben ?? undefined}
    />
  );
}

function Uebersicht({ daten }: { daten: Verbindungen }) {
  const todoist = todoistLage(daten.todoist);
  const kalender = kalenderLage(daten.kalender);
  return (
    <DichteZeilen>
      <ZeilenGruppe>
        {statusZeile('Todoist', todoist, daten.todoist.letzterAbgleich, '/mehr/inhalte/verbindungen/todoist')}
        {statusZeile(
          'Kalender',
          kalender,
          letzterAbgleich(daten.kalender.map((eintrag) => eintrag.letzterAbgleich)),
          '/mehr/inhalte/verbindungen/kalender',
        )}
      </ZeilenGruppe>
    </DichteZeilen>
  );
}

function AbgleichKnopf({ laeuft, onAbgleich }: { laeuft: boolean; onAbgleich: () => void }) {
  return (
    <div className="flex justify-end">
      <Knopf onClick={onAbgleich} disabled={laeuft}>
        <RefreshCw className={`size-4 ${laeuft ? 'animate-spin' : ''}`} />
        {tx('Jetzt abgleichen')}
      </Knopf>
    </div>
  );
}

export function VerbindungenBereich({ ansicht }: { ansicht: 'uebersicht' | 'todoist' | 'kalender' }) {
  const queryClient = useQueryClient();
  const schnell = useSchnellAktion();
  const { data, error, isPending } = useQuery({ queryKey: SCHLUESSEL.verbindungen, queryFn: api.verbindungen });
  const abgleichen = useMutation({
    mutationFn: api.gleicheAb,
    onSuccess: (ergebnis) => {
      const text =
        ergebnis.neu === 0
          ? tx('Keine neuen Einträge.')
          : txMenge(ergebnis.neu, '{zahl} neue Einträge übernommen.', { zahl: zahl(ergebnis.neu) });
      schnell.melde(text);
      void queryClient.invalidateQueries();
    },
  });

  if (isPending) {
    return <Ladeanzeige />;
  }
  if (error || !data) {
    return error ? <Fehlermeldung fehler={error} /> : <Ladeanzeige />;
  }

  if (ansicht === 'todoist') {
    return (
      <div>
        <Fehlermeldung fehler={abgleichen.error} />
        <TodoistBereich
          status={data.todoist}
          abgleichLaeuft={abgleichen.isPending}
          onAbgleich={() => abgleichen.mutate()}
        />
      </div>
    );
  }
  if (ansicht === 'kalender') {
    return (
      <div>
        {data.kalender.length > 0 ? (
          <AbgleichKnopf laeuft={abgleichen.isPending} onAbgleich={() => abgleichen.mutate()} />
        ) : null}
        <Fehlermeldung fehler={abgleichen.error} />
        <KalenderAbschnitt kalender={data.kalender} />
      </div>
    );
  }
  return <Uebersicht daten={data} />;
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
  const [tokenFehler, setTokenFehler] = useState<string | null>(null);
  const aktualisieren = () => void queryClient.invalidateQueries({ queryKey: SCHLUESSEL.verbindungen });
  const verbinden = useMutation({
    mutationFn: () => api.verbindeTodoist(token.trim()),
    onSuccess: () => {
      setToken('');
      setTokenFehler(null);
      aktualisieren();
    },
  });
  const absenden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (token.trim() === '') {
      setTokenFehler(feldLeer('API-Token'));
      return;
    }
    if (verbinden.isPending) {
      return;
    }
    setTokenFehler(null);
    verbinden.mutate();
  };
  const zeit = zeitpunktText(status.letzterAbgleich);
  const fehlerZeilen = status.fehler ? fehlerAnzeige(status.fehler).split('\n') : [];

  return (
    <section id="todoist">
      <AbschnittKopf titel={tx('Todoist')} hinweis={tx('Jede erledigte Aufgabe wird ein Eintrag mit XP.')} />
      {status.verbunden ? (
        <>
          <Flaeche>
            <SchnellZeile ziel={{ art: 'todoist', id: 0, name: tx('Todoist') }}>
              {(menue) => (
                <div className="flex items-center gap-2 px-4 py-3">
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
          </Flaeche>
          <TodoistZuordnungen status={status} />
        </>
      ) : (
        <Formular onAbsenden={absenden} abstand="space-y-3">
          <Flaeche>
            <div className="space-y-3 px-4 py-3">
              <TodoistTokenSchritte />
              <PasswortFeld
                label={tx('API-Token')}
                autoComplete="off"
                value={token}
                fehler={tokenFehler}
                onChange={(ereignis) => {
                  setToken(ereignis.target.value);
                  setTokenFehler(null);
                }}
              />
              <Knopf type="submit" variante="primaer" className="w-full" aria-busy={verbinden.isPending || undefined}>
                {verbinden.isPending ? tx('Prüfe …') : tx('Verbinden')}
              </Knopf>
            </div>
          </Flaeche>
          <Fehlermeldung fehler={verbinden.error} />
        </Formular>
      )}
    </section>
  );
}

