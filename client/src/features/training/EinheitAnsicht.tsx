import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Link } from 'react-router';
import type { EinheitUebung, Trainingssatz } from '../../../../shared/api/training.ts';
import type { GewichtEinheit } from '../../../../shared/spiel/training.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { tx } from '../../text.ts';
import { Karte } from '../../ui/index.ts';
import { kreisStand, satzText, zuletztText, type KreisStand } from './satzAnzeige.ts';

function KreisBild({ stand }: { stand: KreisStand }) {
  const klasse =
    stand === 'an'
      ? 'border-transparent bg-xp text-akzent-text'
      : stand === 'halb'
        ? 'border-xp'
        : 'border-current text-leise';
  return (
    <span
      data-an={stand === 'an' ? '1' : '0'}
      className={`aufgaben-kreis flex size-[22px] items-center justify-center rounded-full border-[1.5px] ${klasse}`}
    >
      {stand === 'halb' ? (
        <span className="h-0.5 w-2.5 rounded-sm bg-xp" />
      ) : (
        <Check className="aufgaben-haken size-3.5" strokeWidth={2.5} />
      )}
    </span>
  );
}

function Kreis({
  stand,
  label,
  aenderbar,
  gesperrt,
  onClick,
}: {
  stand: KreisStand;
  label: string;
  aenderbar: boolean;
  gesperrt: boolean;
  onClick: () => void;
}) {
  const bild = <KreisBild stand={stand} />;
  if (!aenderbar) {
    return (
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center">
        {bild}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={stand === 'halb' ? 'mixed' : stand === 'an'}
      disabled={gesperrt}
      onClick={onClick}
      className="flex size-11 shrink-0 items-center justify-center"
    >
      {bild}
    </button>
  );
}

function Zuletzt({ uebung, gewicht }: { uebung: EinheitUebung; gewicht: GewichtEinheit }) {
  const werte = useQuery({
    queryKey: SCHLUESSEL.bestwerte(uebung.uebungId),
    queryFn: () => api.bestwerte(uebung.uebungId),
  });
  const text = werte.data ? zuletztText(werte.data, uebung.art, gewicht) : null;
  if (!text) {
    return null;
  }
  return <p className="mt-0.5 text-[13px] text-leise">{tx('Zuletzt {text}', { text })}</p>;
}

function satzLabel(satz: Trainingssatz): string {
  return satz.aufwaermen ? tx('Aufwärmen abhaken') : tx('Satz abhaken');
}

export function EinheitKarte({
  uebung,
  gewicht,
  aenderbar,
  gesperrt,
  einheitId,
  planName,
  von,
  onSatz,
  onUebung,
}: {
  uebung: EinheitUebung;
  gewicht: GewichtEinheit;
  aenderbar: boolean;
  gesperrt: boolean;
  einheitId: number;
  planName: string;
  von: '/' | null;
  onSatz: (satz: Trainingssatz) => void;
  onUebung: (uebung: EinheitUebung) => void;
}) {
  const stand = kreisStand(uebung.saetze);
  return (
    <Karte dicht className="px-1 py-1 md:px-3 md:py-2">
      <div className="flex min-h-11 items-center gap-0.5 md:min-h-14">
        <Kreis
          stand={stand}
          label={tx('{name} abhaken', { name: uebung.name })}
          aenderbar={aenderbar}
          gesperrt={gesperrt}
          onClick={() => onUebung(uebung)}
        />
        <div className="min-w-0">
          <Link
            to={`/training/uebungen/${uebung.uebungId}`}
            state={{ einheit: `/training/einheiten/${einheitId}`, planName, von }}
            className={`block truncate text-lg ${stand === 'an' ? 'font-medium text-leise' : 'font-semibold'}`}
          >
            {uebung.name}
          </Link>
          <Zuletzt uebung={uebung} gewicht={gewicht} />
        </div>
      </div>
      <ul>
        {uebung.saetze.map((satz) => {
          const text = satzText(satz, uebung.art, gewicht);
          return (
            <li key={satz.id} className="flex min-h-11 items-center gap-0.5">
              <Kreis
                stand={satz.erledigt ? 'an' : 'leer'}
                label={satzLabel(satz)}
                aenderbar={aenderbar}
                gesperrt={gesperrt}
                onClick={() => onSatz(satz)}
              />
              <span className="flex min-w-0 items-baseline gap-3 text-base">
                {satz.aufwaermen ? <span className="shrink-0 text-[13px] font-medium text-leise">{tx('Aufwärmen')}</span> : null}
                {text ? <b className={`zahl font-medium ${satz.erledigt ? 'text-leise' : ''}`}>{text}</b> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </Karte>
  );
}
