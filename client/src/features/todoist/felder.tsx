import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Faehigkeit, TodoistZielArt, Vorlage } from '../../../../shared/api/index.ts';
import { DAUER_OPTIONEN, GRENZEN } from '../../../../shared/spiel/begriffe.ts';
import { EINGABE_STIL, Feld } from '../../ui/index.ts';
import { tx } from '../../text.ts';
import { projekteFuerVision, zielSchluessel, type ZielBlick } from '../../todoistZiel.ts';
import { sortiert } from './gemeinsam.ts';

export function DauerWahl({
  wert,
  onAendern,
  erben,
  disabled,
}: {
  wert: number | null;
  onAendern: (stunden: number | null) => void;
  erben: boolean;
  disabled: boolean;
}) {
  return (
    <select
      className={EINGABE_STIL}
      aria-label={tx('Dauer')}
      disabled={disabled}
      value={wert === null ? '' : String(wert)}
      onChange={(ereignis) => {
        const roh = ereignis.target.value;
        onAendern(roh === '' ? null : Number(roh));
      }}
    >
      {erben ? <option value="">{tx('Wie das Projekt')}</option> : null}
      {erben ? <option value="0">{tx('Keine Angabe')}</option> : <option value="">{tx('Dauer: keine Angabe')}</option>}
      {DAUER_OPTIONEN.map((option) => (
        <option key={option.stunden} value={option.stunden}>
          {tx('Dauer: {label}', { label: tx(option.label) })}
        </option>
      ))}
    </select>
  );
}

export function TaetigkeitWahl({
  taetigkeiten,
  wert,
  onAendern,
  erben,
  disabled,
}: {
  taetigkeiten: readonly Vorlage[];
  wert: number | null;
  onAendern: (id: number | null) => void;
  erben: boolean;
  disabled: boolean;
}) {
  const gueltig = taetigkeiten.some((vorlage) => vorlage.id === wert) ? wert : null;
  return (
    <select
      className={EINGABE_STIL}
      aria-label={tx('Tätigkeit')}
      disabled={disabled}
      value={gueltig ?? ''}
      onChange={(ereignis) => onAendern(ereignis.target.value === '' ? null : Number(ereignis.target.value))}
    >
      <option value="">{erben ? tx('Wie das Projekt') : tx('Standard des Projekts')}</option>
      {taetigkeiten.map((vorlage) => (
        <option key={vorlage.id} value={vorlage.id}>
          {vorlage.name}
        </option>
      ))}
    </select>
  );
}

export function FaehigkeitWahl({
  faehigkeiten,
  wert,
  onAendern,
  erben,
  disabled,
}: {
  faehigkeiten: readonly Faehigkeit[];
  wert: number | null;
  onAendern: (id: number | null) => void;
  erben: boolean;
  disabled: boolean;
}) {
  return (
    <Feld label="Fähigkeit">
      <select
        className={EINGABE_STIL}
        disabled={disabled}
        value={wert === null ? '' : String(wert)}
        onChange={(ereignis) => {
          const roh = ereignis.target.value;
          onAendern(roh === '' ? null : Number(roh));
        }}
      >
        <option value="">{erben ? tx('Wie das Projekt') : tx('Keine')}</option>
        {erben ? <option value="0">{tx('Keine')}</option> : null}
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

export function WeitereFelder({ offen, onToggle, children }: { offen: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <button type="button" className="flex min-h-11 w-full items-center gap-2 text-sm" aria-expanded={offen} onClick={onToggle}>
        <ChevronDown className={`size-4 text-leise transition ${offen ? '' : '-rotate-90'}`} />
        {tx('Weitere Felder')}
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
  erben,
  disabled,
}: {
  blick: ZielBlick;
  art: TodoistZielArt | null;
  id: number | null;
  onAendern: (wert: string) => void;
  erben: boolean;
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
  return (
    <select className={EINGABE_STIL} aria-label={tx('Ziel')} disabled={disabled} value={zielSchluessel(art, id)} onChange={(ereignis) => onAendern(ereignis.target.value)}>
      {erben ? <option value="">{tx('Wie das Projekt')}</option> : null}
      {visionen.length > 0 ? (
        <optgroup label={tx('Visionen')}>
          {visionen.map((vision) => (
            <option key={vision.id} value={zielSchluessel('vision', vision.id)}>
              {vision.titel}
            </option>
          ))}
        </optgroup>
      ) : null}
      {projekte.length > 0 ? (
        <optgroup label={tx('Projekte')}>
          {projekte.map((projekt) => (
            <option key={projekt.id} value={zielSchluessel('projekt', projekt.id)}>
              {projekt.name}
            </option>
          ))}
        </optgroup>
      ) : null}
      {vorhaben.length > 0 ? (
        <optgroup label={tx('Vorhaben')}>
          {vorhaben.map((eintrag) => (
            <option key={eintrag.id} value={zielSchluessel('vorhaben', eintrag.id)}>
              {eintrag.titel}
            </option>
          ))}
        </optgroup>
      ) : null}
    </select>
  );
}
