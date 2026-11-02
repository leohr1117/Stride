import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { Faehigkeit, TodoistZielArt } from '../../../../shared/api/index.ts';
import { DAUER_OPTIONEN, GRENZEN } from '../../../../shared/spiel/begriffe.ts';
import { HierarchieWahl } from '../../components/HierarchieWahl.tsx';
import { gliedereProjekte, wahlBaum, type GliedProjekt, type WahlKnoten } from '../../projektHierarchie.ts';
import { EINGABE_STIL, Feld } from '../../ui/index.ts';
import { tx } from '../../text.ts';
import { projekteFuerVision, zielSchluessel, type ZielBlick, type ZielVorhaben } from '../../todoistZiel.ts';
import { sortiert } from './gemeinsam.ts';

export function DauerWahl({
  wert,
  onAendern,
  disabled,
}: {
  wert: number | null;
  onAendern: (stunden: number | null) => void;
  disabled: boolean;
}) {
  return (
    <Feld label="Dauer, wenn die Aufgabe keine hat">
      <select
        className={EINGABE_STIL}
        aria-label={tx('Dauer, wenn die Aufgabe keine hat')}
        disabled={disabled}
        value={wert === null ? '' : String(wert)}
        onChange={(ereignis) => {
          const roh = ereignis.target.value;
          onAendern(roh === '' ? null : Number(roh));
        }}
      >
        <option value="">{tx('Keine Angabe')}</option>
        {DAUER_OPTIONEN.map((option) => (
          <option key={option.stunden} value={option.stunden}>
            {tx('Dauer: {label}', { label: tx(option.label) })}
          </option>
        ))}
      </select>
    </Feld>
  );
}

export function FaehigkeitWahl({
  faehigkeiten,
  wert,
  onAendern,
  disabled,
}: {
  faehigkeiten: readonly Faehigkeit[];
  wert: number | null;
  onAendern: (id: number | null) => void;
  disabled: boolean;
}) {
  return (
    <Feld label="Fähigkeit">
      <select
        className={EINGABE_STIL}
        aria-label={tx('Fähigkeit')}
        disabled={disabled}
        value={wert === null ? '' : String(wert)}
        onChange={(ereignis) => {
          const roh = ereignis.target.value;
          onAendern(roh === '' ? null : Number(roh));
        }}
      >
        <option value="">{tx('Keine')}</option>
        {faehigkeiten.map((faehigkeit) => (
          <option key={faehigkeit.id} value={faehigkeit.id}>
            {faehigkeit.name}
          </option>
        ))}
      </select>
    </Feld>
  );
}

export function TextFeld({
  label,
  wert,
  onAendern,
  onFocus,
  onBlur,
}: {
  label: string;
  wert: string;
  onAendern: (wert: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  return (
    <Feld label={label}>
      <textarea
        className={EINGABE_STIL}
        rows={2}
        maxLength={GRENZEN.notizMax}
        autoComplete="off"
        value={wert}
        onChange={(ereignis) => onAendern(ereignis.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </Feld>
  );
}

export function WeitereFelder({ anfangOffen, children }: { anfangOffen: boolean; children: ReactNode }) {
  const [offen, setOffen] = useState(anfangOffen);
  return (
    <div className="space-y-2">
      <button type="button" className="flex min-h-12 w-full items-center gap-2 text-sm" aria-expanded={offen} onClick={() => setOffen((wert) => !wert)}>
        <ChevronDown className={`size-4 text-leise transition ${offen ? '' : '-rotate-90'}`} />
        {tx('Weiteres')}
      </button>
      {offen ? <div className="space-y-2">{children}</div> : null}
    </div>
  );
}

export function ZielWahl({
  blick,
  art,
  id,
  onAendern,
  disabled,
}: {
  blick: ZielBlick;
  art: TodoistZielArt | null;
  id: number | null;
  onAendern: (wert: string) => void;
  disabled: boolean;
}) {
  const projekte = sortiert(blick.projekte, (projekt) => projekt.name);
  const vorhaben = sortiert(
    blick.vorhaben.filter((eintrag) => eintrag.status === 'offen' || (art === 'vorhaben' && eintrag.id === id)),
    (eintrag) => eintrag.titel,
  );
  const visionen = sortiert(
    blick.visionen.filter((vision) => projekteFuerVision(blick, vision.id).length > 0 || (art === 'vision' && vision.id === id)),
    (vision) => vision.titel,
  );
  const vorhabenNachProjekt = new Map<number, ZielVorhaben[]>();
  for (const eintrag of vorhaben) {
    if (eintrag.projektId === null) {
      continue;
    }
    const liste = vorhabenNachProjekt.get(eintrag.projektId) ?? [];
    liste.push(eintrag);
    vorhabenNachProjekt.set(eintrag.projektId, liste);
  }
  const knotenFuerProjekt = (projekt: GliedProjekt, farbe: string | undefined): WahlKnoten => ({
    schluessel: zielSchluessel('projekt', projekt.id),
    wert: zielSchluessel('projekt', projekt.id),
    name: projekt.name,
    waehlbar: true,
    farbe,
    ast: 'projekt',
    kinder: (vorhabenNachProjekt.get(projekt.id) ?? []).map((eintrag) => ({
      schluessel: zielSchluessel('vorhaben', eintrag.id),
      wert: zielSchluessel('vorhaben', eintrag.id),
      name: eintrag.titel,
      waehlbar: true,
      farbe,
      ast: 'vorhaben' as const,
      kinder: [],
    })),
  });
  const gliederung = gliedereProjekte(
    projekte,
    visionen.map((vision) => ({ id: vision.id, titel: vision.titel, farbe: vision.farbe ?? 'var(--leise)' })),
    blick.organisationen
      .filter((organisation) => organisation.archiviert !== true)
      .map((organisation) => ({
        id: organisation.id,
        name: organisation.name ?? tx('Organisation'),
        farbe: organisation.farbe ?? 'var(--leise)',
        visionId: organisation.visionId,
      })),
    { leereVisionen: true },
  );
  const knoten = wahlBaum(
    gliederung,
    {
      leer: tx('Kein Ziel'),
      ohneVision: tx('Ohne {name}', { name: tx('Vision') }),
    },
    knotenFuerProjekt,
    true,
  );
  const gezeigt = new Set<string>();
  const merke = (liste: WahlKnoten[]) => {
    for (const eintrag of liste) {
      if (eintrag.waehlbar) {
        gezeigt.add(eintrag.wert);
      }
      merke(eintrag.kinder);
    }
  };
  merke(knoten);
  const rest = vorhaben.filter((eintrag) => !gezeigt.has(zielSchluessel('vorhaben', eintrag.id)));
  if (rest.length > 0) {
    knoten.push({
      schluessel: 'vorhaben-rest',
      wert: 'vorhaben-rest',
      name: tx('Vorhaben'),
      waehlbar: false,
      ast: 'hinweis',
      kinder: rest.map((eintrag) => ({
        schluessel: zielSchluessel('vorhaben', eintrag.id),
        wert: zielSchluessel('vorhaben', eintrag.id),
        name: eintrag.titel,
        waehlbar: true,
        ast: 'vorhaben' as const,
        kinder: [],
      })),
    });
  }
  return (
    <Feld label="Gehört zu">
      <HierarchieWahl
        label={tx('Gehört zu')}
        wert={zielSchluessel(art, id)}
        knoten={knoten}
        disabled={disabled}
        onAendern={onAendern}
      />
    </Feld>
  );
}
