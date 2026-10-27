import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TodoistLabel, TodoistStatus, TodoistZuordnung, Vorlage } from '../../../../shared/api/index.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { taetigkeitenFuerProjekt } from '../../../../shared/spiel/taetigkeit.ts';
import { api } from '../../api/index.ts';
import { useSichtbarkeit } from '../../funktionen.ts';
import { zahl } from '../../format.ts';
import { tx } from '../../text.ts';
import { EINGABE_STIL, Fehlermeldung, InfoHinweis, Knopf, Schalter } from '../../ui/index.ts';
import { merkeStatus, useTodoistBlick } from './gemeinsam.ts';

const TODOIST_TOKEN_SEITE = 'https://app.todoist.com/app/settings/integrations/developer';
const KEINE_AUSWAHL = '';

const HINWEIS_MEILENSTEIN =
  'Eine Aufgabe mit Deadline wird zum Gegner. Mit Meilenstein wird sie zum Boss. Nach der Deadline geht Disziplin verloren.';
const HINWEIS_OHNE = 'Erledigte Aufgaben ohne Zuordnung zählen als diese Tätigkeit oder gar nicht.';
const HINWEIS_VORSCHAU =
  'Nur eine Vorschau der letzten 7 Tage, ohne Streak und Ausrüstung. Übernommen werden Aufgaben erst, wenn du sie nach dem Verbinden erledigst.';

interface Schritt {
  art: 'projekt' | 'label';
  id: string;
  name: string;
}

function schluessel(schritt: Schritt): string {
  return `${schritt.art}:${schritt.id}`;
}

function istOffen(zeile: TodoistZuordnung | TodoistLabel): boolean {
  return zeile.zielArt === null || zeile.zielId === null;
}

function schritteVon(status: TodoistStatus): Schritt[] {
  return [
    ...status.projekte.filter(istOffen).map((projekt) => ({ art: 'projekt' as const, id: projekt.todoistId, name: projekt.name })),
    ...status.labels.filter((label) => !label.aktiv || istOffen(label)).map((label) => ({ art: 'label' as const, id: label.todoistId, name: label.name })),
  ];
}

function stempelVon(status: TodoistStatus): string {
  const projekte = status.projekte.map((projekt) =>
    [projekt.todoistId, projekt.zielArt, projekt.zielId, projekt.vorlageId, projekt.meilenstein].join(':'),
  );
  const labels = status.labels.map((label) =>
    [label.todoistId, label.aktiv, label.zielArt, label.zielId, label.vorlageId, label.meilenstein].join(':'),
  );
  return [status.ohneZuordnung, status.standardVorlageId, ...projekte, ...labels].join('|');
}

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

function SchrittFormular({
  schritt,
  onFertig,
}: {
  schritt: Schritt;
  onFertig: () => void;
}) {
  const { blick, taetigkeiten } = useTodoistBlick();
  const client = useQueryClient();
  const [projektId, setProjektId] = useState<number | null>(blick.projekte[0]?.id ?? null);
  const [vorlageId, setVorlageId] = useState<number | null>(null);
  const [meilenstein, setMeilenstein] = useState(false);
  useEffect(() => {
    if (projektId === null && blick.projekte[0]) {
      setProjektId(blick.projekte[0].id);
    }
  }, [blick.projekte, projektId]);
  const passende = taetigkeitenFuerProjekt(taetigkeiten, projektId);
  const vorlageWirksam = passende.some((vorlage) => vorlage.id === vorlageId) ? vorlageId : null;
  const speichern = useMutation({
    mutationFn: () => {
      if (projektId === null) {
        throw new Error(tx('Lege zuerst ein Projekt an.'));
      }
      if (schritt.art === 'projekt') {
        return api.ordneTodoistZu(schritt.id, {
          projektId,
          vorlageId: vorlageWirksam,
          stunden: null,
          zielArt: 'projekt',
          zielId: projektId,
          meilenstein,
        });
      }
      return api.ordneTodoistLabel(schritt.id, {
        aktiv: true,
        zielArt: 'projekt',
        zielId: projektId,
        projektId,
        vorlageId: vorlageWirksam,
        stunden: null,
        faehigkeitId: null,
        abschluss: null,
        erkenntnis: '',
        notiz: '',
        meilenstein,
      });
    },
    onSuccess: (status) => {
      merkeStatus(client, status);
      onFertig();
    },
  });

  if (blick.projekte.length === 0) {
    return <p className="text-sm text-leise">{tx('Lege zuerst ein Projekt an.')}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="min-w-0">
        <p className="text-xs text-leise">{schritt.art === 'projekt' ? tx('Projekt') : tx('Label')}</p>
        <p className="truncate font-medium">{schritt.name}</p>
      </div>
      <label className="block space-y-1.5">
        <span className="block text-sm font-medium">{tx('Projekt')}</span>
        <select
          className={EINGABE_STIL}
          value={projektId ?? KEINE_AUSWAHL}
          onChange={(ereignis) => {
            const naechstes = ereignis.target.value === KEINE_AUSWAHL ? null : Number(ereignis.target.value);
            setProjektId(naechstes);
            setVorlageId((aktuell) => {
              const vorlage = taetigkeiten.find((eintrag) => eintrag.id === aktuell);
              if (!vorlage || vorlage.projektId === null || vorlage.projektId === naechstes) {
                return aktuell;
              }
              return null;
            });
          }}
        >
          {blick.projekte.map((projekt) => (
            <option key={projekt.id} value={projekt.id}>
              {projekt.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1.5">
        <span className="block text-sm font-medium">{tx('Tätigkeit')}</span>
        <select
          className={EINGABE_STIL}
          value={vorlageWirksam ?? KEINE_AUSWAHL}
          onChange={(ereignis) => setVorlageId(ereignis.target.value === KEINE_AUSWAHL ? null : Number(ereignis.target.value))}
        >
          <option value={KEINE_AUSWAHL}>{tx('Standard des Projekts')}</option>
          {passende.map((vorlage) => (
            <option key={vorlage.id} value={vorlage.id}>
              {vorlage.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center text-sm font-medium">
          {tx('Meilenstein')}
          <InfoHinweis text={HINWEIS_MEILENSTEIN} />
        </span>
        <Schalter kompakt label="Meilenstein" an={meilenstein} onAendern={setMeilenstein} />
      </div>
      <Fehlermeldung fehler={speichern.error} />
      <Knopf type="button" variante="primaer" className="w-full" disabled={projektId === null || speichern.isPending} onClick={() => speichern.mutate()}>
        {tx('Zuordnen')}
      </Knopf>
    </div>
  );
}

function ZuordnungsGuide({ status }: { status: TodoistStatus }) {
  const [uebersprungen, setUebersprungen] = useState<string[]>([]);
  const alle = schritteVon(status);
  const offen = alle.filter((schritt) => !uebersprungen.includes(schluessel(schritt)));
  const gesamt = status.projekte.length + status.labels.length;
  if (gesamt === 0) {
    return null;
  }
  const aktuell = offen[0];
  const nummer = gesamt - offen.length + (aktuell ? 1 : 0);

  return (
    <section aria-label={tx('Zuordnung')} className="space-y-3 rounded-xl bg-flaeche-2 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{tx('Zuordnung')}</h3>
        {aktuell ? (
          <span className="shrink-0 text-xs text-leise">{tx('{nummer} von {anzahl}', { nummer: zahl(nummer), anzahl: zahl(gesamt) })}</span>
        ) : null}
      </div>
      {aktuell ? (
        <>
          <SchrittFormular key={schluessel(aktuell)} schritt={aktuell} onFertig={() => undefined} />
          <Knopf
            type="button"
            variante="leise"
            className="w-full"
            onClick={() => setUebersprungen((liste) => [...liste, schluessel(aktuell)])}
          >
            {tx('Überspringen')}
          </Knopf>
        </>
      ) : (
        <p className="text-sm text-leise">{tx('Alle zugeordnet.')}</p>
      )}
    </section>
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

function XpVorschau({ status }: { status: TodoistStatus }) {
  const vorschau = useQuery({
    queryKey: ['todoist-vorschau', stempelVon(status)],
    queryFn: api.todoistVorschau,
  });
  return (
    <div className="space-y-1">
      <div className="flex items-center">
        <p className="text-sm">
          {vorschau.data
            ? tx('{xp} XP für die letzten Erledigungen', { xp: zahl(vorschau.data.xp) })
            : tx('{xp} XP für die letzten Erledigungen', { xp: '…' })}
        </p>
        <InfoHinweis text={HINWEIS_VORSCHAU} />
      </div>
      <Fehlermeldung fehler={vorschau.error} />
    </div>
  );
}

export function TodoistEinrichtung({ status }: { status: TodoistStatus }) {
  const projekteAn = istAn('projekte', useSichtbarkeit());
  return (
    <div className="space-y-4">
      {projekteAn ? <ZuordnungsGuide status={status} /> : null}
      <OhneZuordnung status={status} />
      <XpVorschau status={status} />
    </div>
  );
}
