import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { TodoistLabelDaten, TodoistStatus, TodoistZuordnungDaten } from '../../../../shared/api/index.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { api } from '../../api/index.ts';
import { Abschnitt } from '../../components/Ausklappbar.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { Zeile } from '../../components/Zeile.tsx';
import { useSichtbarkeit } from '../../funktionen.ts';
import { tx } from '../../text.ts';
import { FLAECHEN_RAHMEN } from '../../ui/Flaeche.tsx';
import { Fehlermeldung, FlaecheInnen, FlaechenRahmen, Knopf, Schalter } from '../../ui/index.ts';
import { merkeStatus, useTodoistBlick } from './gemeinsam.ts';
import { ZuordnungBlatt } from './ZuordnungBlatt.tsx';
import {
  erbeName,
  labelAnzeige,
  labelDaten,
  labelWirkt,
  projektDaten,
  projektSchalterAnzeige,
  standAusLabel,
  standAusProjekt,
  standardAnzeige,
  standardDaten,
  verschiebe,
  vorlageName,
  type ZaehlAnzeige,
  type ZuordnungsStand,
} from './zuordnung.ts';

export const INFO_LABELS = 'Ein Label geht vor dem Projekt. Hat eine Aufgabe mehrere, gilt das oberste.';

const LABEL_FLAECHE = `${FLAECHEN_RAHMEN} bg-transparent md:overflow-hidden md:rounded-lg md:border md:border-rand md:bg-flaeche`;

type Wahl =
  | { art: 'standard' }
  | { art: 'projekt'; id: string }
  | { art: 'label'; id: string };

type Auftrag =
  | { art: 'standard'; vorlageId: number | null }
  | { art: 'projekt'; id: string; daten: TodoistZuordnungDaten }
  | { art: 'label'; id: string; daten: TodoistLabelDaten };

function wertKnoten(anzeige: ZaehlAnzeige): ReactNode {
  return anzeige.eigene ? <span className="text-haupt">{anzeige.text}</span> : anzeige.text;
}

function spaltenSatz(links: string, name: string, wert: string): string {
  return `${tx(links)} ${name}, ${tx('zählt als')} ${wert}`;
}

function Spaltenkopf({ links }: { links: string }) {
  return (
    <div className="flex justify-between px-4 pt-2 pb-1 text-[13px] leading-[18px] text-leise">
      <span>{tx(links)}</span>
      <span className="pe-16">{tx('zählt als')}</span>
    </div>
  );
}

function ZaehlSchalter({ name, an, onAendern }: { name: string; an: boolean; onAendern: (an: boolean) => void }) {
  return <Schalter kompakt an={an} label={tx('{name} zählt mit', { name })} onAendern={onAendern} />;
}

function leererStand(vorlageId: number | null): ZuordnungsStand {
  return {
    zielArt: null,
    zielId: null,
    projektId: null,
    vorlageId,
    stunden: null,
    faehigkeitId: null,
    abschluss: null,
    erkenntnis: '',
    notiz: '',
    meilenstein: false,
  };
}

export function TodoistZuordnungen({ status }: { status: TodoistStatus }) {
  const { blick, taetigkeiten, faehigkeiten, faehigkeitenAn } = useTodoistBlick();
  const zieleAn = istAn('ziele', useSichtbarkeit());
  const client = useQueryClient();
  const [wahl, setWahl] = useState<Wahl | null>(null);
  const [reihenfolgeOffen, setReihenfolgeOffen] = useState(false);
  const speichern = useMutation({
    mutationFn: (auftrag: Auftrag) => {
      if (auftrag.art === 'standard') {
        const daten = standardDaten(auftrag.vorlageId);
        return api.setzeTodoistOhne(daten.art, daten.vorlageId);
      }
      if (auftrag.art === 'projekt') {
        return api.ordneTodoistZu(auftrag.id, auftrag.daten);
      }
      return api.ordneTodoistLabel(auftrag.id, auftrag.daten);
    },
    onSuccess: (neu) => merkeStatus(client, neu),
  });
  const reihenfolge = useMutation({
    mutationFn: (ids: string[]) => api.ordneTodoistLabelReihenfolge(ids),
    onSuccess: (neu) => merkeStatus(client, neu),
  });

  const standardId = status.ohneZuordnung === 'standard' ? status.standardVorlageId : null;
  const standard = standardAnzeige(status.ohneZuordnung, standardId, vorlageName(taetigkeiten, standardId));
  const wirkung = status.labels.filter(labelWirkt);
  const standardName = tx('Standard');

  const standFuer = (aktuell: Wahl): ZuordnungsStand => {
    if (aktuell.art === 'standard') {
      return leererStand(standardId);
    }
    if (aktuell.art === 'projekt') {
      const zeile = status.projekte.find((eintrag) => eintrag.todoistId === aktuell.id);
      return zeile ? standAusProjekt(zeile) : leererStand(null);
    }
    const zeile = status.labels.find((eintrag) => eintrag.todoistId === aktuell.id);
    return zeile ? standAusLabel(zeile) : leererStand(null);
  };

  const titelFuer = (aktuell: Wahl): string => {
    if (aktuell.art === 'standard') {
      return standardName;
    }
    if (aktuell.art === 'projekt') {
      return status.projekte.find((eintrag) => eintrag.todoistId === aktuell.id)?.name ?? standardName;
    }
    return status.labels.find((eintrag) => eintrag.todoistId === aktuell.id)?.name ?? tx('Labels');
  };

  const ersteFuer = (aktuell: Wahl): string => {
    if (aktuell.art === 'label') {
      return tx('Wie Projekt');
    }
    if (aktuell.art === 'standard') {
      return tx('Zählt nicht');
    }
    return erbeName(standard);
  };

  const uebernehmen = (naechster: ZuordnungsStand) => {
    if (!wahl) {
      return;
    }
    if (wahl.art === 'standard') {
      speichern.mutate({ art: 'standard', vorlageId: naechster.vorlageId });
      return;
    }
    if (wahl.art === 'projekt') {
      const zeile = status.projekte.find((eintrag) => eintrag.todoistId === wahl.id);
      speichern.mutate({ art: 'projekt', id: wahl.id, daten: projektDaten(naechster, zeile?.aktiv ?? false) });
      return;
    }
    const zeile = status.labels.find((eintrag) => eintrag.todoistId === wahl.id);
    speichern.mutate({ art: 'label', id: wahl.id, daten: labelDaten(naechster, zeile?.aktiv ?? false) });
  };

  const verschiebeLabel = (id: string, richtung: -1 | 1) => {
    if (reihenfolge.isPending) {
      return;
    }
    const ids = verschiebe(wirkung.map((label) => label.todoistId), id, richtung);
    if (!ids) {
      return;
    }
    const rest = status.labels.filter((label) => label.aktiv && !ids.includes(label.todoistId)).map((label) => label.todoistId);
    reihenfolge.mutate([...ids, ...rest]);
  };

  const blattStand = wahl ? standFuer(wahl) : leererStand(null);

  return (
    <div className="mt-4">
      <FlaechenRahmen>
        <Spaltenkopf links="Erledigt in" />
        {status.projekte.length === 0 ? (
          <p className="px-4 text-sm text-leise">{tx('Keine Projekte in Todoist.')}</p>
        ) : (
          <FlaecheInnen>
            {status.projekte.map((zuordnung) => {
              const anzeige = projektSchalterAnzeige(
                zuordnung.aktiv,
                zuordnung.vorlageId,
                vorlageName(taetigkeiten, zuordnung.vorlageId),
                standard,
              );
              return (
                <Zeile
                  key={zuordnung.todoistId}
                  titel={zuordnung.name}
                  name={spaltenSatz('Erledigt in', zuordnung.name, anzeige.text)}
                  wert={wertKnoten(anzeige)}
                  onKlick={() => setWahl({ art: 'projekt', id: zuordnung.todoistId })}
                  rechts={
                    <ZaehlSchalter
                      name={zuordnung.name}
                      an={zuordnung.aktiv}
                      onAendern={(an) =>
                        speichern.mutate({
                          art: 'projekt',
                          id: zuordnung.todoistId,
                          daten: projektDaten(standAusProjekt(zuordnung), an),
                        })
                      }
                    />
                  }
                />
              );
            })}
          </FlaecheInnen>
        )}
        <div className="mt-2">
          <FlaecheInnen>
            <Zeile
              titel={standardName}
              name={spaltenSatz('Erledigt in', standardName, standard.text)}
              wert={wertKnoten(standard)}
              onKlick={() => setWahl({ art: 'standard' })}
            />
          </FlaecheInnen>
        </div>
      </FlaechenRahmen>
      <div className="mt-6">
        <div data-flaeche="" className={LABEL_FLAECHE}>
        <Abschnitt titel="Labels" kennung="todoist-labels" info={INFO_LABELS} anfangEingeklappt>
        <FlaechenRahmen>
          <Spaltenkopf links="Mit Label" />
          {status.labels.length === 0 ? (
            <p className="px-4 text-sm text-leise">{tx('Keine Labels in Todoist.')}</p>
          ) : (
            <FlaecheInnen>
              {status.labels.map((label) => {
                const anzeige = labelAnzeige(label.aktiv, label.vorlageId, vorlageName(taetigkeiten, label.vorlageId));
                return (
                  <Zeile
                    key={label.todoistId}
                    titel={label.name}
                    name={spaltenSatz('Mit Label', label.name, anzeige.text)}
                    wert={wertKnoten(anzeige)}
                    onKlick={() => setWahl({ art: 'label', id: label.todoistId })}
                    rechts={
                      <ZaehlSchalter
                        name={label.name}
                        an={label.aktiv}
                        onAendern={(an) =>
                          speichern.mutate({
                            art: 'label',
                            id: label.todoistId,
                            daten: labelDaten(standAusLabel(label), an),
                          })
                        }
                      />
                    }
                  />
                );
              })}
            </FlaecheInnen>
          )}
        </FlaechenRahmen>
        {wirkung.length >= 2 ? (
          <button type="button" className="min-h-12 text-haupt" onClick={() => setReihenfolgeOffen(true)}>
            {tx('Reihenfolge')}
          </button>
        ) : null}
        </Abschnitt>
        </div>
      </div>
      <ZuordnungBlatt
        key={wahl ? (wahl.art === 'standard' ? 'standard' : `${wahl.art}-${wahl.id}`) : 'zu'}
        offen={wahl !== null}
        titel={wahl ? titelFuer(wahl) : tx('Zuordnung')}
        art={wahl?.art ?? 'standard'}
        stand={blattStand}
        erste={wahl ? ersteFuer(wahl) : tx('Zählt nicht')}
        blick={blick}
        taetigkeiten={taetigkeiten}
        faehigkeiten={faehigkeiten}
        faehigkeitenAn={faehigkeitenAn}
        zieleAn={zieleAn}
        pending={speichern.isPending}
        fehler={speichern.error}
        onSpeichern={uebernehmen}
        onSchliessen={() => setWahl(null)}
      />
      <Dialog offen={reihenfolgeOffen} titel={tx('Reihenfolge')} onSchliessen={() => setReihenfolgeOffen(false)}>
        <Fehlermeldung fehler={reihenfolge.error} />
        <div className="divide-y divide-rand">
          {wirkung.map((label, index) => (
            <div key={label.todoistId} className="flex items-center gap-2 py-2">
              <span className="zahl w-4 shrink-0 text-center text-xs text-leise">{index + 1}</span>
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{label.name}</p>
              <button
                type="button"
                className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-flaeche-2 text-haupt disabled:opacity-30"
                aria-label={tx('{name} nach oben', { name: label.name })}
                disabled={reihenfolge.isPending || index === 0}
                onClick={() => verschiebeLabel(label.todoistId, -1)}
              >
                <ChevronUp className="size-5" />
              </button>
              <button
                type="button"
                className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-flaeche-2 text-haupt disabled:opacity-30"
                aria-label={tx('{name} nach unten', { name: label.name })}
                disabled={reihenfolge.isPending || index === wirkung.length - 1}
                onClick={() => verschiebeLabel(label.todoistId, 1)}
              >
                <ChevronDown className="size-5" />
              </button>
            </div>
          ))}
        </div>
        <Knopf className="mt-4 w-full" onClick={() => setReihenfolgeOffen(false)}>
          {tx('Fertig')}
        </Knopf>
      </Dialog>
    </div>
  );
}
