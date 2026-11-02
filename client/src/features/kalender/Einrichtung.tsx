import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent, type RefObject } from 'react';
import type { Kalender, KalenderPruefung } from '../../../../shared/api/index.ts';
import { GRENZEN } from '../../../../shared/spiel/begriffe.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { AuswahlBlatt } from '../../components/AuswahlBlatt.tsx';
import { HierarchieWahl } from '../../components/HierarchieWahl.tsx';
import { gliedereProjekte, wahlBaum } from '../../projektHierarchie.ts';
import { useSichtbarkeit } from '../../funktionen.ts';
import { tx } from '../../text.ts';
import { EINGABE_STIL, Fehlermeldung, Feld, Formular, InfoHinweis, Knopf } from '../../ui/index.ts';
import { ANBIETER, KalenderAnleitung, type KalenderAnbieter } from './anleitung.tsx';
import {
  kalenderAnzeige,
  kalenderOptionen,
  passendeVorlage,
  vorlageIdAusWahl,
} from './stand.ts';

function spurSetzen(feld: RefObject<HTMLInputElement | null>, wert: string): void {
  if (feld.current) {
    feld.current.value = wert;
  }
  feld.current?.dispatchEvent(new Event('input', { bubbles: true }));
}

function Spur({ feld, wert }: { feld: RefObject<HTMLInputElement | null>; wert: string }) {
  return (
    <input
      ref={feld}
      readOnly
      tabIndex={-1}
      aria-hidden="true"
      value={wert}
      className="pointer-events-none absolute h-px w-px opacity-0"
      onChange={() => undefined}
    />
  );
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

function AnbieterWahl({ wert, onAendern }: { wert: KalenderAnbieter | null; onAendern: (wert: KalenderAnbieter) => void }) {
  return (
    <div className="flex gap-1 rounded-xl bg-flaeche-2 p-1">
      {ANBIETER.map((eintrag) => (
        <button
          key={eintrag.wert}
          type="button"
          aria-pressed={wert === eintrag.wert}
          onClick={() => onAendern(eintrag.wert)}
          className={`flex min-h-12 flex-1 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition ${
            wert === eintrag.wert ? 'bg-flaeche text-haupt shadow-sm' : 'text-leise hover:text-haupt'
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
  const vorlageFeld = useRef<HTMLInputElement>(null);
  const projektFeld = useRef<HTMLInputElement>(null);
  const [anbieter, setAnbieter] = useState<KalenderAnbieter | null>(null);
  const [name, setName] = useState(kalender?.name ?? '');
  const [vorschlag, setVorschlag] = useState('');
  const [adresse, setAdresse] = useState('');
  const [vorschau, setVorschau] = useState<KalenderPruefung | null>(null);
  const [projektId, setProjektId] = useState<number | null>(kalender?.projektId ?? null);
  const [vorlageId, setVorlageId] = useState<number | null>(kalender?.vorlageId ?? null);
  const [filter, setFilter] = useState(kalender?.filter ?? '');
  const gewaehltesProjekt = projekteAn ? projektId : (kalender?.projektId ?? null);
  const projektName = projekte.find((projekt) => projekt.id === gewaehltesProjekt)?.name ?? null;
  const wirksameVorlageId = passendeVorlage(taetigkeiten, vorlageId, gewaehltesProjekt);
  const anzeige = kalenderAnzeige({
    vorlageId: wirksameVorlageId,
    vorlageName: taetigkeiten.find((eintrag) => eintrag.id === wirksameVorlageId)?.name ?? null,
    projektId: gewaehltesProjekt,
    standardName: null,
  }).text;
  const optionen = kalenderOptionen(taetigkeiten, gewaehltesProjekt, projektName);

  const fertig = () => {
    void queryClient.invalidateQueries({ queryKey: SCHLUESSEL.verbindungen });
    onFertig();
  };
  const setzeVorlage = (id: number | null) => {
    setVorlageId(id);
    spurSetzen(vorlageFeld, id === null ? '' : String(id));
  };
  const setzeProjekt = (id: number | null) => {
    const naechste = passendeVorlage(taetigkeiten, vorlageId, id);
    setProjektId(id);
    setVorlageId(naechste);
    spurSetzen(projektFeld, id === null ? '' : String(id));
    spurSetzen(vorlageFeld, naechste === null ? '' : String(naechste));
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
      const daten = {
        name: name.trim(),
        projektId: gewaehltesProjekt,
        vorlageId: wirksameVorlageId,
        filter: filter.trim(),
      };
      return kalender ? api.aendereKalender(kalender.id, daten) : api.erstelleKalender({ ...daten, adresse: adresse.trim() });
    },
    onSuccess: fertig,
  });
  const kannSpeichern =
    name.trim() !== '' &&
    (gewaehltesProjekt !== null || wirksameVorlageId !== null) &&
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
  const zuordnung = (
    <>
      <Feld
        label={
          <span className="inline-flex items-center">
            {tx('Zählt als')}
            <InfoHinweis text="Die XP richtet sich nach der Dauer des Termins." />
          </span>
        }
      >
        <AuswahlBlatt
          modus="einzeln"
          label={tx('Zählt als')}
          wert={wirksameVorlageId === null ? '' : String(wirksameVorlageId)}
          anzeige={anzeige}
          optionen={optionen}
          disabled={speichern.isPending}
          onAendern={(wert) => {
            if (wert.startsWith('gruppe-')) {
              return;
            }
            setzeVorlage(vorlageIdAusWahl(wert));
          }}
        />
      </Feld>
      {projekteAn ? (
        <Feld label="Gehört zu">
          <HierarchieWahl
            label={tx('Gehört zu')}
            wert={projektId === null ? '' : String(projektId)}
            knoten={wahlBaum(gliedereProjekte(projekte, visionen, organisationen), {
              leer: tx('Kein Ziel'),
              ohneVision: tx('Ohne {name}', { name: tx('Vision') }),
            })}
            disabled={speichern.isPending}
            onAendern={(roh) => {
              if (roh === '') {
                setzeProjekt(null);
                return;
              }
              const id = Number(roh);
              if (Number.isInteger(id) && id > 0) {
                setzeProjekt(id);
              }
            }}
          />
        </Feld>
      ) : null}
      <Feld label="Nur Termine mit diesen Wörtern" hinweis="Leer: alle Termine. Komma trennt Wörter.">
        <input
          className={EINGABE_STIL}
          value={filter}
          maxLength={GRENZEN.nameMax}
          onChange={(ereignis) => setFilter(ereignis.target.value)}
        />
      </Feld>
    </>
  );
  const nameFeld = (fokus: boolean) => (
    <Feld label="Name">
      <input
        className={EINGABE_STIL}
        value={name}
        maxLength={GRENZEN.nameMax}
        autoFocus={fokus}
        onChange={(ereignis) => setName(ereignis.target.value)}
      />
    </Feld>
  );

  return (
    <Formular onAbsenden={absenden}>
      <Spur feld={vorlageFeld} wert={wirksameVorlageId === null ? '' : String(wirksameVorlageId)} />
      <Spur feld={projektFeld} wert={gewaehltesProjekt === null ? '' : String(gewaehltesProjekt)} />
      {kalender ? (
        <>
          {nameFeld(true)}
          {zuordnung}
        </>
      ) : (
        <>
          <AnbieterWahl wert={anbieter} onAendern={setAnbieter} />
          {anbieter ? <KalenderAnleitung anbieter={anbieter} /> : null}
          {anbieter ? (
            <>
              <Feld label="iCal-Adresse">
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
              <Knopf
                type="button"
                variante="primaer"
                className="w-full"
                disabled={adresse.trim() === '' || pruefen.isPending}
                onClick={() => pruefen.mutate()}
              >
                {pruefen.isPending ? tx('Prüfe …') : tx('Prüfen')}
              </Knopf>
              <Fehlermeldung fehler={pruefen.error} />
            </>
          ) : null}
          {vorschau ? (
            <>
              {nameFeld(false)}
              {zuordnung}
            </>
          ) : null}
        </>
      )}
      <Fehlermeldung fehler={speichern.error} />
      {(kalender || vorschau) && (
        <Knopf type="submit" variante="primaer" className="w-full" disabled={!kannSpeichern}>
          {speichern.isPending ? tx('Prüfe …') : tx('Speichern')}
        </Knopf>
      )}
    </Formular>
  );
}
