import { Check } from 'lucide-react';
import { tx, attributName } from '../text.ts';
import { FLAECHE_KLASSE } from '../ui/Flaeche.tsx';
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

const ZEILE = 'flex w-full items-center gap-3 rounded-none border-0 bg-transparent px-4 py-0 text-left';

type WahlOption<T extends string> = {
  wert: T;
  name: string;
  neben?: string;
  lang?: string;
};

function Haken({ aktiv }: { aktiv: boolean }) {
  if (!aktiv) {
    return <span className="size-5 shrink-0" aria-hidden="true" />;
  }
  return <Check className="size-5 shrink-0 text-haupt" aria-hidden="true" />;
}

export function WahlListe<T extends string>({
  art,
  label,
  optionen,
  istGewaehlt,
  onWaehlen,
  ungueltig = false,
  fehlerId,
  zeilenKlasse,
}: {
  art: 'einfach' | 'mehrfach';
  label: string;
  optionen: readonly WahlOption<T>[];
  istGewaehlt: (wert: T) => boolean;
  onWaehlen: (wert: T) => void;
  ungueltig?: boolean;
  fehlerId?: string;
  zeilenKlasse?: string;
}) {
  return (
    <div
      data-flaeche=""
      className={FLAECHE_KLASSE}
      role={art === 'einfach' ? 'radiogroup' : 'group'}
      aria-label={label}
      aria-invalid={ungueltig || undefined}
      aria-describedby={fehlerId}
      tabIndex={ungueltig ? -1 : undefined}
    >
      {optionen.map((option) => {
        const aktiv = istGewaehlt(option.wert);
        const neben = Boolean(option.neben);
        return (
          <button
            key={option.wert}
            type="button"
            role={art === 'einfach' ? 'radio' : 'checkbox'}
            lang={option.lang}
            aria-checked={aktiv}
            onClick={() => onWaehlen(option.wert)}
            className={`${ZEILE} ${neben ? 'h-[64px]' : 'h-[56px]'} ${zeilenKlasse ?? ''}`}
          >
            {art === 'mehrfach' ? <Haken aktiv={aktiv} /> : null}
            <span className="min-w-0 flex-1">
              <span
                data-wahl-name=""
                className={`block truncate text-base leading-[22px] ${aktiv && art === 'einfach' ? 'font-semibold' : 'font-normal'}`}
              >
                {option.name}
              </span>
              {neben ? <span className="block truncate text-[13px] leading-[18px] text-leise">{option.neben}</span> : null}
            </span>
            {art === 'einfach' ? <Haken aktiv={aktiv} /> : null}
          </button>
        );
      })}
    </div>
  );
}

export function ZielWahl({ wert, onAendern }: { wert: Zielstrebigkeit | null; onAendern: (wert: ZielAuswahl) => void }) {
  const gewaehlt = wert === null ? null : zielAuswahlWert(wert);
  return (
    <WahlListe
      art="einfach"
      label={tx(ZIEL_FRAGE)}
      optionen={ZIEL_AUSWAHL.map((id) => {
        const info = ZIELSTREBIGKEIT_INFO[id];
        return { wert: id, name: tx(info.titel), neben: tx(info.text) };
      })}
      istGewaehlt={(id) => gewaehlt === id}
      onWaehlen={onAendern}
    />
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
    <WahlListe
      art="mehrfach"
      label={tx('Fokus')}
      optionen={FOKUS_LISTE.map((info) => ({ wert: info.id, name: tx(info.label), neben: tx(info.text) }))}
      istGewaehlt={(id) => wert.includes(id)}
      onWaehlen={umschalten}
      ungueltig={ungueltig}
      fehlerId={fehlerId}
    />
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
