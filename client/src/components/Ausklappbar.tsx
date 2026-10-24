import { ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { merke } from '../speicher.ts';
import { tx } from '../text.ts';
import { InfoHinweis } from '../ui/index.ts';

const SPEICHER_PRAEFIX = 'ascend.eingeklappt.';
const STANDARD_TITEL = 'ueberschrift text-sm font-semibold tracking-wide text-leise uppercase';

export function EinklappKopf({
  titel,
  offen,
  onToggle,
  zusatz,
  info,
  aktion,
  beimOeffnen,
  titelStil = STANDARD_TITEL,
  element: Tag = 'h2',
  className = '',
}: {
  titel: string;
  offen: boolean;
  onToggle: () => void;
  zusatz?: ReactNode;
  info?: string;
  aktion?: ReactNode;
  beimOeffnen?: () => void;
  titelStil?: string;
  element?: 'h2' | 'span';
  className?: string;
}) {
  const titelId = useId();
  const spalten = aktion ? 'grid-cols-[minmax(0,1fr)_auto_2rem]' : 'grid-cols-[minmax(0,1fr)_2rem]';
  const pfeilSpalte = aktion ? 'col-start-3' : 'col-start-2';
  return (
    <div className={`relative grid min-h-8 items-center gap-x-2 ${spalten} ${className}`}>
      <button type="button" onClick={onToggle} aria-expanded={offen} aria-labelledby={titelId} className="absolute inset-0 z-0" />
      <span className="pointer-events-none col-start-1 row-start-1 flex min-w-0 items-center">
        <Tag id={titelId} className={`min-w-0 text-balance break-words ${titelStil}`}>{tx(titel)}</Tag>
        {info ? (
          <span className="pointer-events-auto relative z-10 inline-flex shrink-0 self-center">
            <InfoHinweis text={info} />
          </span>
        ) : null}
        {zusatz ? <span className="ms-2 shrink-0">{zusatz}</span> : null}
      </span>
      {aktion ? (
        <div className="relative z-10 col-start-2 row-start-1" onClickCapture={() => !offen && beimOeffnen?.()}>
          {aktion}
        </div>
      ) : null}
      <span aria-hidden="true" className={`pointer-events-none ${pfeilSpalte} row-start-1 flex size-8 items-center justify-center justify-self-end`}>
        <ChevronDown className={`size-4 text-leise transition ${offen ? '' : '-rotate-90'}`} />
      </span>
    </div>
  );
}

function startEingeklappt(schluessel: string, vorgabe: boolean): boolean {
  try {
    const wert = window.localStorage.getItem(schluessel);
    if (wert === null) {
      return vorgabe;
    }
    return wert === '1';
  } catch {
    return vorgabe;
  }
}

export function Abschnitt({
  titel,
  kennung,
  zusatz,
  info,
  aktion,
  bleibend,
  children,
  anfangEingeklappt = false,
}: {
  titel: string;
  kennung: string;
  zusatz?: ReactNode;
  info?: string;
  aktion?: ReactNode;
  bleibend?: ReactNode;
  children: ReactNode;
  anfangEingeklappt?: boolean;
}) {
  const schluessel = `${SPEICHER_PRAEFIX}${kennung}`;
  const [eingeklappt, setEingeklappt] = useState(() => startEingeklappt(schluessel, anfangEingeklappt));
  const setze = (zu: boolean) => {
    merke(schluessel, zu);
    setEingeklappt(zu);
  };

  return (
    <section className="space-y-3">
      <EinklappKopf
        titel={titel}
        offen={!eingeklappt}
        onToggle={() => setze(!eingeklappt)}
        zusatz={zusatz}
        info={info}
        aktion={aktion}
        beimOeffnen={() => setze(false)}
      />
      {bleibend}
      {!eingeklappt && children}
    </section>
  );
}

export function KurzListe<T>({
  eintraege,
  anzahl,
  darstellen,
  className,
}: {
  eintraege: T[];
  anzahl: number;
  darstellen: (eintrag: T) => ReactNode;
  className?: string;
}) {
  const [alleOffen, setAlleOffen] = useState(false);
  const sichtbar = alleOffen ? eintraege : eintraege.slice(0, anzahl);
  return (
    <div>
      <div className={className}>{sichtbar.map(darstellen)}</div>
      {eintraege.length > anzahl && (
        <EinklappKopf
          className="mt-2"
          element="span"
          titel={alleOffen ? tx("Weniger anzeigen") : `Alle anzeigen (${eintraege.length})`}
          titelStil="text-xs font-normal tracking-normal text-leise normal-case"
          offen={alleOffen}
          onToggle={() => setAlleOffen(!alleOffen)}
        />
      )}
    </div>
  );
}
