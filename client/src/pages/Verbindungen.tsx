import { tx } from '../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ExternalLink, ListChecks, Pencil, Plus, RefreshCw } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { type Kalender, type Projekt, type TodoistStatus, type Vorlage } from '../../../shared/api/index.ts';
import { GRENZEN } from '../../../shared/spiel/begriffe.ts';
import { istAn } from '../../../shared/spiel/sichtbarkeit.ts';
import { taetigkeitPasst, taetigkeitenFuerProjekt } from '../../../shared/spiel/taetigkeit.ts';
import { api, SCHLUESSEL } from '../api/index.ts';
import { useSichtbarkeit } from '../funktionen.ts';
import { Dialog } from '../components/Dialog.tsx';
import { SchnellNebenaktion, SchnellZeile } from '../components/SchnellAktion.tsx';
import { EINGABE_STIL, Feld, Fehlermeldung, InfoHinweis, Karte, Knopf, Ladeanzeige, PasswortFeld, Ueberschrift } from '../ui/index.ts';
import { TodoistZuordnungen } from '../features/todoist/Zuordnungen.tsx';
import { ZielMarke } from '../components/ZielMarke.tsx';
import { kurzesDatum, uhrzeit, zahl } from '../format.ts';

const TODOIST_TOKEN_SEITE = 'https://app.todoist.com/app/settings/integrations/developer';
const KALENDER_HILFEN = [
  { name: 'Google', adresse: 'https://support.google.com/calendar/answer/37648?hl=de' },
  { name: 'Apple', adresse: 'https://support.apple.com/de-de/guide/icloud/mm6b1a9479/icloud' },
  { name: 'Outlook', adresse: 'https://support.microsoft.com/de-DE/Outlook/share-your-calendar-in-outlook-com' },
];
const KEINE_AUSWAHL = '';

function zeitpunktText(iso: string | null): string | null {
  return iso ? `${kurzesDatum(iso)}, ${uhrzeit(iso)}` : null;
}

function alsId(wert: string): number | null {
  return wert === KEINE_AUSWAHL ? null : Number(wert);
}

function useAuswahl() {
  const { data: ziele } = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele });
  const { data: vorlagen = [] } = useQuery({ queryKey: SCHLUESSEL.vorlagen, queryFn: api.vorlagen });
  return {
    projekte: (ziele?.projekte ?? []).filter((projekt) => projekt.aktiv),
    taetigkeiten: vorlagen.filter((vorlage) => !vorlage.archiviert),
  };
}

function ProjektAuswahl({
  projekte,
  wert,
  onAendern,
}: {
  projekte: Projekt[];
  wert: number | null;
  onAendern: (id: number | null) => void;
}) {
  return (
    <select className={EINGABE_STIL} value={wert ?? KEINE_AUSWAHL} onChange={(ereignis) => onAendern(alsId(ereignis.target.value))}>
      {projekte.map((projekt) => (
        <option key={projekt.id} value={projekt.id}>
          {projekt.name}
        </option>
      ))}
    </select>
  );
}

function passendeTaetigkeiten(taetigkeiten: Vorlage[], projektId: number | null): Vorlage[] {
  return taetigkeitenFuerProjekt(taetigkeiten, projektId);
}

function TaetigkeitAuswahl({
  taetigkeiten,
  wert,
  onAendern,
  standardLabel,
}: {
  taetigkeiten: Vorlage[];
  wert: number | null;
  onAendern: (id: number | null) => void;
  standardLabel?: string;
}) {
  return (
    <select className={EINGABE_STIL} value={wert ?? KEINE_AUSWAHL} onChange={(ereignis) => onAendern(alsId(ereignis.target.value))}>
      <option value={KEINE_AUSWAHL}>{standardLabel ?? tx("Standard des Projekts")}</option>
      {taetigkeiten.map((vorlage) => (
        <option key={vorlage.id} value={vorlage.id}>
          {vorlage.name}
        </option>
      ))}
    </select>
  );
}

function KalenderHilfe() {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-leise">
      iCal-Adresse finden:
      {KALENDER_HILFEN.map((hilfe) => (
        <a
          key={hilfe.name}
          href={hilfe.adresse}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-akzent hover:underline"
        >
          {hilfe.name}
          <ExternalLink className="size-3.5" />
        </a>
      ))}
    </p>
  );
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
          <InfoHinweis text="Erledigte Aufgaben werden zu Einträgen, ab heute. Tagsüber alle 15 Minuten, zwischen 23 und 6 Uhr alle 3 Stunden." />
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
          {projekteAn ? <TodoistZuordnungen status={status} /> : null}
        </>
      ) : (
        <form onSubmit={absenden} className="space-y-3">
          <PasswortFeld
            label={tx("API-Token")}
            autoComplete="off"
            value={token}
            onChange={(ereignis) => setToken(ereignis.target.value)}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <a
              href={TODOIST_TOKEN_SEITE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-akzent hover:underline"
            >
              {tx("Token in Todoist öffnen")}
              <ExternalLink className="size-3.5" />
            </a>
            <Knopf type="submit" variante="primaer" disabled={token.trim() === '' || verbinden.isPending}>
              {verbinden.isPending ? tx("Prüfe …") : tx("Verbinden")}
            </Knopf>
          </div>
          <Fehlermeldung fehler={verbinden.error} />
        </form>
      )}
    </Karte>
  );
}

function KalenderKarte({ kalender }: { kalender: Kalender[] }) {
  const projekteAn = istAn('projekte', useSichtbarkeit());
  const [dialog, setDialog] = useState<{ kalender: Kalender | null } | null>(null);
  const { projekte } = useAuswahl();
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
      {kalender.length === 0 ? (
        <KalenderHilfe />
      ) : (
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
      )}
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

function KalenderFormular({ kalender, onFertig }: { kalender: Kalender | null; onFertig: () => void }) {
  const queryClient = useQueryClient();
  const projekteAn = istAn('projekte', useSichtbarkeit());
  const { projekte, taetigkeiten } = useAuswahl();
  const [name, setName] = useState(kalender?.name ?? '');
  const [adresse, setAdresse] = useState('');
  const [projektId, setProjektId] = useState<number | null>(kalender?.projektId ?? null);
  const [vorlageId, setVorlageId] = useState<number | null>(kalender?.vorlageId ?? null);
  const [filter, setFilter] = useState(kalender?.filter ?? '');
  const gewaehltesProjekt = projekteAn ? (projektId ?? projekte[0]?.id ?? null) : (kalender?.projektId ?? null);
  const taetigkeitenZumProjekt = passendeTaetigkeiten(taetigkeiten, gewaehltesProjekt);
  const wirksameVorlageId = taetigkeitenZumProjekt.some((vorlage) => vorlage.id === vorlageId) ? vorlageId : null;

  const fertig = () => {
    void queryClient.invalidateQueries({ queryKey: SCHLUESSEL.verbindungen });
    onFertig();
  };
  const speichern = useMutation({
    mutationFn: () => {
      if (gewaehltesProjekt === null) {
        throw new Error(tx("Lege zuerst ein Projekt an."));
      }
      const daten = { name: name.trim(), projektId: gewaehltesProjekt, vorlageId: wirksameVorlageId, filter: filter.trim() };
      return kalender ? api.aendereKalender(kalender.id, daten) : api.erstelleKalender({ ...daten, adresse: adresse.trim() });
    },
    onSuccess: fertig,
  });
  const absenden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    speichern.mutate();
  };
  const kannSpeichern =
    name.trim() !== '' && gewaehltesProjekt !== null && (kalender !== null || adresse.trim() !== '') && !speichern.isPending;

  return (
    <form onSubmit={absenden} className="space-y-4">
      <Feld label={tx("Name")}>
        <input className={EINGABE_STIL} value={name} maxLength={GRENZEN.nameMax} onChange={(ereignis) => setName(ereignis.target.value)} autoFocus />
      </Feld>
      {!kalender && (
        <div className="space-y-2">
          <Feld label="iCal-Adresse">
            <input className={EINGABE_STIL} type="url" autoComplete="off" value={adresse} onChange={(ereignis) => setAdresse(ereignis.target.value)} />
          </Feld>
          <KalenderHilfe />
        </div>
      )}
      {projekteAn && (
        <Feld label={<ZielMarke ebene="projekte" />}>
          <ProjektAuswahl
            projekte={projekte}
            wert={gewaehltesProjekt}
            onAendern={(id) => {
              setProjektId(id);
              setVorlageId((aktuell) => {
                if (aktuell === null) {
                  return null;
                }
                const vorlage = taetigkeiten.find((eintrag) => eintrag.id === aktuell);
                return vorlage && taetigkeitPasst(vorlage.projektId, id) ? aktuell : null;
              });
            }}
          />
        </Feld>
      )}
      <Feld label={tx("Tätigkeit")}>
        <TaetigkeitAuswahl
          taetigkeiten={taetigkeitenZumProjekt}
          wert={wirksameVorlageId}
          onAendern={setVorlageId}
          standardLabel={projekteAn ? tx("Standard des Projekts") : tx("Standard")}
        />
      </Feld>
      <Feld label={tx("Titel enthält")}>
        <input className={EINGABE_STIL} value={filter} maxLength={GRENZEN.nameMax} onChange={(ereignis) => setFilter(ereignis.target.value)} />
      </Feld>
      <Fehlermeldung fehler={speichern.error} />
      <div className="flex gap-2">
        {kalender ? (
          <SchnellNebenaktion ziel={{ art: 'kalender', id: kalender.id, name: kalender.name }} onErledigt={fertig} />
        ) : null}
        <Knopf type="submit" variante="primaer" className="flex-1" disabled={!kannSpeichern}>
          {speichern.isPending ? tx("Prüfe …") : tx("Speichern")}
        </Knopf>
      </div>
    </form>
  );
}
