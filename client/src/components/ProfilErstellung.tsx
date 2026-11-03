import { Check } from 'lucide-react';
import { tx, attributName } from '../text.ts';
import { attributVorlage } from '../../../shared/features/attribute/attributKatalog.ts';
import type { AttributKennung } from '../../../shared/spiel/begriffe.ts';
import {
  FOKUS_LISTE,
  startAttribute,
  startTaetigkeiten,
  ZIEL_AUSWAHL,
  ZIEL_FRAGE,
  ZIELSTREBIGKEIT_INFO,
  zielAuswahlWert,
  type FokusId,
  type ZielAuswahl,
  type Zielstrebigkeit,
} from '../../../shared/spiel/profil.ts';

const ZEILE =
  'flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-2 text-left transition';

export function ZielWahl({ wert, onAendern }: { wert: Zielstrebigkeit | null; onAendern: (wert: ZielAuswahl) => void }) {
  const gewaehlt = wert === null ? null : zielAuswahlWert(wert);
  return (
    <div role="radiogroup" aria-label={tx(ZIEL_FRAGE)} className="space-y-2">
      {ZIEL_AUSWAHL.map((id) => {
        const info = ZIELSTREBIGKEIT_INFO[id];
        const aktiv = gewaehlt === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={aktiv}
            onClick={() => onAendern(id)}
            className={`${ZEILE} ${aktiv ? 'border-akzent bg-akzent/10' : 'border-rand bg-flaeche hover:border-leise/50'}`}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium break-words">{tx(info.titel)}</span>
              <span className="mt-0.5 block text-[13px] leading-5 text-leise break-words">{tx(info.text)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function FokusWahl({
  wert,
  onAendern,
  ungueltig = false,
  fehlerId,
}: {
  wert: readonly FokusId[];
  onAendern: (wert: FokusId[]) => void;
  ungueltig?: boolean;
  fehlerId?: string;
}) {
  const umschalten = (id: FokusId) => {
    onAendern(wert.includes(id) ? wert.filter((eintrag) => eintrag !== id) : [...wert, id]);
  };
  return (
    <div
      role="group"
      aria-label={tx('Fokus')}
      aria-invalid={ungueltig || undefined}
      aria-describedby={fehlerId}
      tabIndex={ungueltig ? -1 : undefined}
      className="space-y-2"
    >
      {FOKUS_LISTE.map((info) => {
        const aktiv = wert.includes(info.id);
        return (
          <button
            key={info.id}
            type="button"
            aria-pressed={aktiv}
            onClick={() => umschalten(info.id)}
            className={`${ZEILE} ${aktiv ? 'border-akzent bg-akzent/10' : 'border-rand bg-flaeche hover:border-leise/50'}`}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium break-words">{tx(info.label)}</span>
              <span className="mt-0.5 block text-[13px] leading-5 text-leise break-words">{tx(info.text)}</span>
            </span>
            {aktiv ? <Check className="size-4 shrink-0 text-akzent" aria-hidden /> : <span className="size-4 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

function namen(kennungen: readonly AttributKennung[]): string {
  return kennungen.map((kennung) => attributName({ kennung, name: attributVorlage(kennung).name })).join(', ');
}

/** Live-Zeilen: was dieser Fokus anlegt. Leer bleibt unsichtbar. */
export function FokusVorschau({ fokus }: { fokus: readonly FokusId[] }) {
  if (fokus.length === 0) {
    return null;
  }
  const gewaehlt = startAttribute(fokus).gewaehlt;
  const koennen = gewaehlt.filter((kennung) => attributVorlage(kennung).typ === 'attribut');
  const haben = gewaehlt.filter((kennung) => attributVorlage(kennung).typ === 'status');
  const taetigkeiten = startTaetigkeiten(fokus).map((taetigkeit) => tx(taetigkeit.name));
  return (
    <div className="space-y-1">
      {taetigkeiten.length > 0 ? <p className="truncate text-[13px] text-leise">{tx('Tätigkeiten: {liste}', { liste: taetigkeiten.join(', ') })}</p> : null}
      {koennen.length > 0 ? <p className="truncate text-[13px] text-leise">{tx('Können: {liste}', { liste: namen(koennen) })}</p> : null}
      {haben.length > 0 ? <p className="truncate text-[13px] text-leise">{tx('Haben: {liste}', { liste: namen(haben) })}</p> : null}
    </div>
  );
}
