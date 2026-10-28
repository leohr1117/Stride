import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { Kalender, KalenderPruefung, Organisation, Projekt, Vision, Vorlage } from '../../../../shared/api/index.ts';
import { GRENZEN } from '../../../../shared/spiel/begriffe.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { taetigkeitPasst, taetigkeitenFuerProjekt } from '../../../../shared/spiel/taetigkeit.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { HierarchieWahl } from '../../components/HierarchieWahl.tsx';
import { ZielMarke } from '../../components/ZielMarke.tsx';
import { gliedereProjekte, wahlBaum } from '../../projektHierarchie.ts';
import { SchnellNebenaktion } from '../../components/SchnellAktion.tsx';
import { useSichtbarkeit } from '../../funktionen.ts';
import { tx } from '../../text.ts';
import { EINGABE_STIL, Fehlermeldung, Feld, Formular, InfoHinweis, Knopf } from '../../ui/index.ts';
import { ANBIETER, KalenderAnleitung, type KalenderAnbieter } from './anleitung.tsx';

const KEINE_AUSWAHL = '';

function alsId(wert: string): number | null {
  return wert === KEINE_AUSWAHL ? null : Number(wert);
}

function useAuswahl() {
  const { data: ziele } = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele });
  const { data: vorlagen = [] } = useQuery({ queryKey: SCHLUESSEL.vorlagen, queryFn: api.vorlagen });
  return {
    projekte: (ziele?.projekte ?? []).filter((projekt) => projekt.aktiv),
    visionen: (ziele?.visionen ?? []).filter((vision) => !vision.archiviert),
    organisationen: (ziele?.organisationen ?? []).filter((organisation) => !organisation.archiviert),
    taetigkeiten: vorlagen.filter((vorlage) => !vorlage.archiviert),
  };
}

function ProjektAuswahl({
  projekte,
  visionen,
  organisationen,
  wert,
  onAendern,
}: {
  projekte: Projekt[];
  visionen: Vision[];
  organisationen: Organisation[];
  wert: number | null;
  onAendern: (id: number | null) => void;
}) {
  return (
    <HierarchieWahl
      label={tx('Projekt')}
      wert={wert === null ? '' : String(wert)}
      knoten={wahlBaum(gliedereProjekte(projekte, visionen, organisationen), {
        ohneVision: tx('Ohne {name}', { name: tx('Vision') }),
      })}
      onAendern={(roh) => onAendern(alsId(roh))}
    />
  );
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
  standardLabel: string;
}) {
  return (
    <select aria-label={tx('Tätigkeit')} className={EINGABE_STIL} value={wert ?? KEINE_AUSWAHL} onChange={(ereignis) => onAendern(alsId(ereignis.target.value))}>
      <option value={KEINE_AUSWAHL}>{standardLabel}</option>
      {taetigkeiten.map((vorlage) => (
        <option key={vorlage.id} value={vorlage.id}>
          {vorlage.name}
        </option>
      ))}
    </select>
  );
}

function AnbieterWahl({ wert, onAendern }: { wert: KalenderAnbieter | null; onAendern: (wert: KalenderAnbieter) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {ANBIETER.map((eintrag) => (
        <button
          key={eintrag.wert}
          type="button"
          aria-pressed={wert === eintrag.wert}
          onClick={() => onAendern(eintrag.wert)}
          className={`rounded-xl border px-2 py-3 text-sm font-medium ${
            wert === eintrag.wert ? 'border-akzent bg-akzent/10 text-haupt' : 'border-rand bg-flaeche-2 text-leise'
          }`}
        >
          {tx(eintrag.label)}
        </button>
      ))}
    </div>
  );
}

export function KalenderFormular({ kalender, onFertig }: { kalender: Kalender | null; onFertig: () => void }) {
  const queryClient = useQueryClient();
  const projekteAn = istAn('projekte', useSichtbarkeit());
  const { projekte, visionen, organisationen, taetigkeiten } = useAuswahl();
  const [anbieter, setAnbieter] = useState<KalenderAnbieter | null>(null);
  const [name, setName] = useState(kalender?.name ?? '');
  const [vorschlag, setVorschlag] = useState('');
  const [adresse, setAdresse] = useState('');
  const [vorschau, setVorschau] = useState<KalenderPruefung | null>(null);
  const [projektId, setProjektId] = useState<number | null>(kalender?.projektId ?? null);
  const [vorlageId, setVorlageId] = useState<number | null>(kalender?.vorlageId ?? null);
  const [filter, setFilter] = useState(kalender?.filter ?? '');
  const gewaehltesProjekt = projekteAn ? (projektId ?? projekte[0]?.id ?? null) : (kalender?.projektId ?? null);
  const taetigkeitenZumProjekt = taetigkeitenFuerProjekt(taetigkeiten, gewaehltesProjekt);
  const wirksameVorlageId = taetigkeitenZumProjekt.some((vorlage) => vorlage.id === vorlageId) ? vorlageId : null;

  const fertig = () => {
    void queryClient.invalidateQueries({ queryKey: SCHLUESSEL.verbindungen });
    onFertig();
  };
  const pruefen = useMutation({
    mutationFn: () => api.pruefeKalender(adresse.trim()),
    onSuccess: (ergebnis) => {
      setVorschau(ergebnis);
      setName((aktuell) => (aktuell.trim() === '' || aktuell === vorschlag ? ergebnis.name : aktuell));
      setVorschlag(ergebnis.name);
    },
  });
  const speichern = useMutation({
    mutationFn: () => {
      if (gewaehltesProjekt === null) {
        throw new Error(tx('Lege zuerst ein Projekt an.'));
      }
      const daten = { name: name.trim(), projektId: gewaehltesProjekt, vorlageId: wirksameVorlageId, filter: filter.trim() };
      return kalender ? api.aendereKalender(kalender.id, daten) : api.erstelleKalender({ ...daten, adresse: adresse.trim() });
    },
    onSuccess: fertig,
  });
  const kannSpeichern =
    name.trim() !== '' &&
    gewaehltesProjekt !== null &&
    (kalender !== null || (vorschau !== null && adresse.trim() !== '')) &&
    !speichern.isPending;
  const absenden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (kalender === null && vorschau === null) {
      if (adresse.trim() !== '' && !pruefen.isPending) {
        pruefen.mutate();
      }
      return;
    }
    if (kannSpeichern) {
      speichern.mutate();
    }
  };
  const standardLabel = projekteAn ? tx('Standard des Projekts') : tx('Standard');
  const zuordnung = (
    <>
      {projekteAn && (
        <Feld label={<ZielMarke ebene="projekte" />}>
          <ProjektAuswahl
            projekte={projekte}
            visionen={visionen}
            organisationen={organisationen}
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
      <Feld
        label={
          <span className="inline-flex items-center">
            {tx('Tätigkeit')}
            <InfoHinweis text="Die XP richtet sich nach der Dauer des Termins." />
          </span>
        }
      >
        <TaetigkeitAuswahl taetigkeiten={taetigkeitenZumProjekt} wert={wirksameVorlageId} onAendern={setVorlageId} standardLabel={standardLabel} />
      </Feld>
      <Feld
        label={
          <span className="inline-flex items-center">
            {tx('Titel enthält')}
            <InfoHinweis text="Komma trennt mehrere Wörter. Ohne Wort zählt jeder Termin. Ohne passendes Wort zählt der Termin nicht." />
          </span>
        }
      >
        <input aria-label={tx('Titel enthält')} className={EINGABE_STIL} value={filter} maxLength={GRENZEN.nameMax} onChange={(ereignis) => setFilter(ereignis.target.value)} />
      </Feld>
    </>
  );

  return (
    <Formular onAbsenden={absenden}>
      {kalender ? (
        <>
          <Feld label={tx('Name')}>
            <input className={EINGABE_STIL} value={name} maxLength={GRENZEN.nameMax} onChange={(ereignis) => setName(ereignis.target.value)} autoFocus />
          </Feld>
          {zuordnung}
        </>
      ) : (
        <>
          <AnbieterWahl wert={anbieter} onAendern={setAnbieter} />
          {anbieter ? <KalenderAnleitung anbieter={anbieter} /> : null}
          {anbieter ? (
            <div className="space-y-2">
              <Feld label={tx('iCal-Adresse')}>
                <input
                  className={EINGABE_STIL}
                  type="url"
                  autoComplete="off"
                  value={adresse}
                  onChange={(ereignis) => {
                    setAdresse(ereignis.target.value);
                    setVorschau(null);
                  }}
                />
              </Feld>
              {vorschau ? <p className="text-sm">{tx('Gültig · {name}', { name: vorschau.name })}</p> : null}
              <Knopf type="button" variante="primaer" className="w-full" disabled={adresse.trim() === '' || pruefen.isPending} onClick={() => pruefen.mutate()}>
                {pruefen.isPending ? tx('Prüfe …') : tx('Prüfen')}
              </Knopf>
              <Fehlermeldung fehler={pruefen.error} />
            </div>
          ) : null}
          {vorschau ? (
            <>
              <Feld label={tx('Name')}>
                <input className={EINGABE_STIL} value={name} maxLength={GRENZEN.nameMax} onChange={(ereignis) => setName(ereignis.target.value)} />
              </Feld>
              {zuordnung}
            </>
          ) : null}
        </>
      )}
      <Fehlermeldung fehler={speichern.error} />
      {(kalender || vorschau) && (
        <div className="flex gap-2">
          {kalender ? <SchnellNebenaktion ziel={{ art: 'kalender', id: kalender.id, name: kalender.name }} onErledigt={fertig} /> : null}
          <Knopf type="submit" variante="primaer" className="flex-1" disabled={!kannSpeichern}>
            {speichern.isPending ? tx('Prüfe …') : tx('Speichern')}
          </Knopf>
        </div>
      )}
    </Formular>
  );
}
