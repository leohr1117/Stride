import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { Faehigkeit, TodoistAbschluss, TodoistLabel, TodoistLabelDaten, TodoistZielArt, Vorlage } from '../../../../shared/api/index.ts';
import { taetigkeitenFuerProjekt } from '../../../../shared/spiel/taetigkeit.ts';
import { api } from '../../api/index.ts';
import { EINGABE_STIL, Fehlermeldung, Feld, InfoHinweis, Schalter } from '../../ui/index.ts';
import { tx } from '../../text.ts';
import { parseZiel, projekteFuerVision, vorschauTeile, type ZielBlick } from '../../todoistZiel.ts';
import { DauerWahl, FaehigkeitWahl, TaetigkeitWahl, TextFeld, WeitereFelder, ZielWahl } from './felder.tsx';
import { dauerLabel, HINWEIS_MEILENSTEIN, merkeStatus, projektVonZiel, useMitziehText, visionHinweis, vorlagePasst, zielName } from './gemeinsam.ts';

type ErgebnisWert = '' | 'offen' | 'geschafft' | 'gescheitert' | 'meilenstein' | 'kein';

function ergebnisWert(label: TodoistLabel): ErgebnisWert {
  if (label.abschluss === 'geschafft' || label.abschluss === 'gescheitert' || label.abschluss === 'offen') {
    return label.abschluss;
  }
  if (label.meilenstein === true) {
    return 'meilenstein';
  }
  if (label.meilenstein === false) {
    return 'kein';
  }
  return '';
}

function ergebnisAus(wert: string): { abschluss: TodoistAbschluss | null; meilenstein: boolean | null } {
  if (wert === 'offen' || wert === 'geschafft' || wert === 'gescheitert') {
    return { abschluss: wert, meilenstein: null };
  }
  if (wert === 'meilenstein') {
    return { abschluss: null, meilenstein: true };
  }
  if (wert === 'kein') {
    return { abschluss: null, meilenstein: false };
  }
  return { abschluss: null, meilenstein: null };
}

function ergebnisPasst(wert: ErgebnisWert, art: TodoistZielArt | null): boolean {
  if (wert === '') {
    return true;
  }
  if (art === 'vorhaben') {
    return wert === 'offen' || wert === 'geschafft' || wert === 'gescheitert';
  }
  if (art === 'vision' || art === 'projekt') {
    return wert === 'meilenstein' || wert === 'kein';
  }
  return true;
}

function labelLeer(label: TodoistLabel, teil: Partial<TodoistLabelDaten> = {}): TodoistLabelDaten {
  return {
    aktiv: label.aktiv,
    zielArt: label.zielArt,
    zielId: label.zielId,
    projektId: label.projektId,
    vorlageId: label.vorlageId,
    stunden: label.stunden,
    faehigkeitId: label.faehigkeitId,
    abschluss: label.abschluss,
    erkenntnis: label.erkenntnis,
    notiz: label.notiz,
    meilenstein: label.meilenstein,
    ...teil,
  };
}

export function LabelZeile({
  label,
  index,
  anzahl,
  blick,
  taetigkeiten,
  faehigkeiten,
  faehigkeitenAn,
  onReihenfolge,
  reihenfolgeLaeuft,
}: {
  label: TodoistLabel;
  index: number;
  anzahl: number;
  blick: ZielBlick;
  taetigkeiten: Vorlage[];
  faehigkeiten: Faehigkeit[];
  faehigkeitenAn: boolean;
  onReihenfolge: (richtung: -1 | 1) => void;
  reihenfolgeLaeuft: boolean;
}) {
  const client = useQueryClient();
  const speichern = useMutation({
    mutationFn: (daten: TodoistLabelDaten) => api.ordneTodoistLabel(label.todoistId, daten),
    onSuccess: (status) => merkeStatus(client, status),
  });
  const notiz = useMitziehText(label.notiz);
  const erkenntnis = useMitziehText(label.erkenntnis);
  const [weitereOffen, setWeitereOffen] = useState(
    () =>
      label.faehigkeitId !== null ||
      label.meilenstein !== null ||
      label.abschluss !== null ||
      label.erkenntnis !== '' ||
      label.notiz !== '',
  );
  const projektId =
    label.zielArt && label.zielId ? projektVonZiel(label.zielArt, label.zielId, label.projektId, blick) : null;
  const taetigkeitenZumZiel =
    label.zielArt && label.zielId ? taetigkeitenFuerProjekt(taetigkeiten, projektId) : taetigkeiten;
  const hinweis = visionHinweis(label.zielArt, label.zielId, projektId, blick);
  const visionListe = label.zielArt === 'vision' && label.zielId !== null ? projekteFuerVision(blick, label.zielId) : [];
  const gesperrt = speichern.isPending || reihenfolgeLaeuft;

  const senden = (teil: Partial<TodoistLabelDaten>) => {
    const basis = labelLeer(label, teil);
    const art = basis.zielArt;
    const ergebnis = ergebnisPasst(ergebnisWert({ ...label, ...basis }), art) ? basis : { ...basis, abschluss: null, meilenstein: null };
    speichern.mutate({
      ...ergebnis,
      erkenntnis: erkenntnis.text,
      notiz: notiz.text,
      projektId: art && basis.zielId ? projektVonZiel(art, basis.zielId, ergebnis.projektId, blick) : null,
      vorlageId:
        art && basis.zielId
          ? vorlagePasst(taetigkeiten, ergebnis.vorlageId, projektVonZiel(art, basis.zielId, ergebnis.projektId, blick))
          : ergebnis.vorlageId,
    });
  };

  const teile: (string | null)[] = [];
  if (label.zielArt && label.zielId) {
    teile.push(zielName(label.zielArt, label.zielId, blick));
  }
  const vorlage = taetigkeiten.find((eintrag) => eintrag.id === label.vorlageId);
  if (vorlage) {
    teile.push(vorlage.name);
  }
  if (label.stunden === 0) {
    teile.push(tx('Keine Angabe'));
  } else if (label.stunden !== null) {
    teile.push(dauerLabel(label.stunden));
  }
  const faehigkeit = faehigkeiten.find((eintrag) => eintrag.id === label.faehigkeitId);
  if (faehigkeit && label.faehigkeitId !== null && label.faehigkeitId > 0) {
    teile.push(faehigkeit.name);
  }
  if (label.abschluss === 'geschafft') {
    teile.push(tx('Geschafft'));
  } else if (label.abschluss === 'gescheitert') {
    teile.push(tx('Gescheitert'));
  } else if (label.abschluss === 'offen') {
    teile.push(tx('Dran geblieben'));
  } else if (label.meilenstein === true) {
    teile.push(tx('Meilenstein'));
  } else if (label.meilenstein === false) {
    teile.push(tx('Kein Meilenstein'));
  }
  const vorschau = teile.some((teil) => teil && teil.trim() !== '') ? vorschauTeile(teile) : tx('Wie das Projekt');
  const wert = ergebnisWert(label);
  const optionen: { wert: ErgebnisWert; name: string }[] = [{ wert: '', name: tx('Wie das Projekt') }];
  if (label.zielArt !== 'vision' && label.zielArt !== 'projekt') {
    optionen.push(
      { wert: 'offen', name: tx('Dran geblieben') },
      { wert: 'geschafft', name: tx('Geschafft') },
      { wert: 'gescheitert', name: tx('Gescheitert') },
    );
  }
  if (label.zielArt !== 'vorhaben') {
    optionen.push({ wert: 'meilenstein', name: tx('Meilenstein') }, { wert: 'kein', name: tx('Kein Meilenstein') });
  }

  return (
    <div className="space-y-2 py-3">
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <Schalter
            label={<span>{label.name}</span>}
            an={label.aktiv}
            deaktiviert={gesperrt}
            onAendern={(aktiv) => senden({ aktiv })}
          />
        </div>
        {label.aktiv && anzahl >= 2 ? (
          <div className="flex shrink-0">
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-xl text-leise disabled:opacity-30"
              aria-label={tx('{name} nach oben', { name: label.name })}
              disabled={gesperrt || index <= 0}
              onClick={() => onReihenfolge(-1)}
            >
              <ChevronUp className="size-4" />
            </button>
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-xl text-leise disabled:opacity-30"
              aria-label={tx('{name} nach unten', { name: label.name })}
              disabled={gesperrt || index < 0 || index >= anzahl - 1}
              onClick={() => onReihenfolge(1)}
            >
              <ChevronDown className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
      {label.aktiv ? (
        <>
          <ZielWahl
            blick={blick}
            art={label.zielArt}
            id={label.zielId}
            erben
            disabled={gesperrt}
            onAendern={(roh) => {
              const ziel = parseZiel(roh);
              if (!ziel) {
                senden({ zielArt: null, zielId: null, projektId: null, vorlageId: label.vorlageId });
                return;
              }
              const naechstes = projektVonZiel(ziel.art, ziel.id, label.projektId, blick);
              senden({
                zielArt: ziel.art,
                zielId: ziel.id,
                projektId: naechstes,
                vorlageId: vorlagePasst(taetigkeiten, label.vorlageId, naechstes),
              });
            }}
          />
          {visionListe.length > 1 ? (
            <Feld label="Projekt">
              <select
                className={EINGABE_STIL}
                aria-label={tx('Projekt')}
                disabled={gesperrt}
                value={visionListe.some((projekt) => projekt.id === projektId) ? (projektId ?? '') : ''}
                onChange={(ereignis) => senden({ projektId: ereignis.target.value === '' ? null : Number(ereignis.target.value) })}
              >
                <option value="">{tx('Projekt')}</option>
                {visionListe.map((projekt) => (
                  <option key={projekt.id} value={projekt.id}>
                    {projekt.name}
                  </option>
                ))}
              </select>
            </Feld>
          ) : null}
          {hinweis ? <p className="text-sm text-gefahr">{hinweis}</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <TaetigkeitWahl
              taetigkeiten={taetigkeitenZumZiel}
              wert={label.vorlageId}
              erben
              disabled={gesperrt}
              onAendern={(vorlageId) => senden({ vorlageId })}
            />
            <DauerWahl wert={label.stunden} erben disabled={gesperrt} onAendern={(stunden) => senden({ stunden })} />
          </div>
          <WeitereFelder offen={weitereOffen} onToggle={() => setWeitereOffen((offen) => !offen)}>
            {faehigkeitenAn ? (
              <FaehigkeitWahl
                faehigkeiten={faehigkeiten}
                wert={label.faehigkeitId}
                erben
                disabled={gesperrt}
                onAendern={(faehigkeitId) => senden({ faehigkeitId })}
              />
            ) : null}
            <Feld
              label={
                <span className="inline-flex items-center">
                  {tx('Ergebnis')}
                  <InfoHinweis text={HINWEIS_MEILENSTEIN} />
                </span>
              }
            >
              <select
                className={EINGABE_STIL}
                aria-label={tx('Ergebnis')}
                disabled={gesperrt}
                value={optionen.some((option) => option.wert === wert) ? wert : ''}
                onChange={(ereignis) => senden(ergebnisAus(ereignis.target.value))}
              >
                {optionen.map((option) => (
                  <option key={option.wert || 'erben'} value={option.wert}>
                    {option.name}
                  </option>
                ))}
              </select>
            </Feld>
            {label.abschluss === 'gescheitert' ? (
              <TextFeld
                label="Was nimmst du mit?"
                wert={erkenntnis.text}
                onAendern={erkenntnis.setText}
                onFocus={erkenntnis.onFocus}
                onBlur={() => erkenntnis.onBlur(() => senden({}))}
              />
            ) : null}
            <TextFeld
              label="Notiz"
              wert={notiz.text}
              onAendern={notiz.setText}
              onFocus={notiz.onFocus}
              onBlur={() => notiz.onBlur(() => senden({}))}
            />
          </WeitereFelder>
          <p className="text-xs text-leise">{vorschau}</p>
        </>
      ) : null}
      <Fehlermeldung fehler={speichern.error} />
    </div>
  );
}
