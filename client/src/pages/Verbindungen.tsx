import { feldLeer, tx, txMenge } from '../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, CircleMinus, RefreshCw } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { type TodoistStatus, type Verbindungen } from '../../../shared/api/index.ts';
import { artAusSatz, kurzgrund, loesung } from '../../../shared/verbindungsFehler.ts';
import { api, SCHLUESSEL } from '../api/index.ts';
import { useBestaetigung } from '../components/Bestaetigung.tsx';
import { useSchnellAktion } from '../components/SchnellAktion.tsx';
import { bestaetigungFuer } from '../schnell.ts';
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

function nebenzeile(lage: VerbindungsLage, iso: string | null, grund: string | null): string | null {
  if (lage === 'fehler') {
    return grund;
  }
  if (lage !== 'verbunden') {
    return null;
  }
  return iso ? tx('{zeit} abgeglichen', { zeit: relativeZeit(iso) }) : tx('Noch nicht abgeglichen');
}

function statusZeile(
  titel: 'Todoist' | 'Kalender',
  lage: VerbindungsLage,
  iso: string | null,
  nach: string,
  grund: string | null,
) {
  const text = tx(LAGE_TEXT[lage]);
  const neben = nebenzeile(lage, iso, grund);
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

function grundText(art: TodoistStatus['fehlerArt']): string | null {
  return art ? tx(kurzgrund(art)) : null;
}

function Uebersicht({ daten }: { daten: Verbindungen }) {
  const todoist = todoistLage(daten.todoist);
  const kalender = kalenderLage(daten.kalender);
  const ersterFehler = daten.kalender.find((eintrag) => eintrag.fehler);
  return (
    <DichteZeilen>
      <ZeilenGruppe>
        {statusZeile(
          'Todoist',
          todoist,
          daten.todoist.letzterAbgleich,
          '/mehr/inhalte/verbindungen/todoist',
          grundText(daten.todoist.fehlerArt),
        )}
        {statusZeile(
          'Kalender',
          kalender,
          letzterAbgleich(daten.kalender.map((eintrag) => eintrag.letzterAbgleich)),
          '/mehr/inhalte/verbindungen/kalender',
          grundText(ersterFehler?.fehlerArt ?? null),
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

function verbindungsStatus(fehler: unknown, ausstehend: boolean) {
  if (ausstehend || !(fehler instanceof Error) || fehler.message === '') {
    return null;
  }
  const art = artAusSatz(fehler.message);
  return (
    <p className="break-words text-[13px] leading-[18px] text-gefahr" role="status">
      {art ? <span className="block">{tx(kurzgrund(art))}</span> : null}
      <span className="block">{tx(fehler.message)}</span>
      {art ? <span className="block">{tx(loesung(art))}</span> : null}
    </p>
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
  const bestaetigen = useBestaetigung();
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
      verbinden.reset();
      return;
    }
    if (verbinden.isPending) {
      return;
    }
    setTokenFehler(null);
    verbinden.mutate();
  };
  const tokenAendern = (wert: string) => {
    setToken(wert);
    setTokenFehler(null);
    verbinden.reset();
  };
  const trennen = async () => {
    const satz = bestaetigungFuer({ art: 'todoist', id: 0, name: 'Todoist' });
    if (!satz) {
      return;
    }
    const ja = await bestaetigen({ ...satz, gefahr: true });
    if (!ja) {
      return;
    }
    await api.trenneTodoist();
    setToken('');
    setTokenFehler(null);
    verbinden.reset();
    aktualisieren();
  };
  const zeit = zeitpunktText(status.letzterAbgleich);
  const fehlerZeilen = status.fehler ? fehlerAnzeige(status.fehler).split('\n') : [];
  const tokenKarte = (schritte: boolean) => (
    <Formular onAbsenden={absenden} abstand={schritte ? 'space-y-3' : 'mt-3 space-y-3'}>
      <Flaeche>
        <div className="space-y-3 px-4 py-3">
          {schritte ? <TodoistTokenSchritte /> : null}
          <PasswortFeld
            label={tx('API-Token')}
            autoComplete="off"
            value={token}
            fehler={tokenFehler}
            onChange={(ereignis) => tokenAendern(ereignis.target.value)}
          />
          <Knopf type="submit" variante="primaer" className="w-full" aria-busy={verbinden.isPending || undefined}>
            {verbinden.isPending ? tx('Prüfe …') : tx('Verbinden')}
          </Knopf>
          {verbindungsStatus(verbinden.error, verbinden.isPending)}
        </div>
      </Flaeche>
    </Formular>
  );

  return (
    <section id="todoist">
      <AbschnittKopf titel={tx('Todoist')} hinweis={tx('Jede erledigte Aufgabe wird ein Eintrag mit XP.')} />
      {status.verbunden ? (
        <>
          <Flaeche>
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
                {status.fehlerArt ? (
                  <p className="break-words text-xs text-gefahr">{tx(loesung(status.fehlerArt))}</p>
                ) : null}
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
              </div>
            </div>
          </Flaeche>
          {status.fehlerArt === 'abgelehnt' ? tokenKarte(false) : null}
          <TodoistZuordnungen status={status} />
          <div className="mt-8">
            <Knopf variante="warnung" onClick={() => void trennen()}>
              {tx('Trennen')}
            </Knopf>
          </div>
        </>
      ) : (
        tokenKarte(true)
      )}
    </section>
  );
}

