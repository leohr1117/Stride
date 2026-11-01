import { tx } from '../../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flame, RotateCcw, Shield } from 'lucide-react';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useEintragOeffnen } from '../../components/Layout.tsx';
import { ausTagesSchluessel, kurzesDatum, zahl } from '../../format.ts';
import { Fehlermeldung, InfoHinweis, Karte, Knopf } from '../../ui/index.ts';

function StreakKopf() {
  return (
    <h2 className="ueberschrift abschnittskopf min-w-0 text-[13px] font-semibold leading-[18px] tracking-normal text-leise normal-case">
      {tx('Streak')}
    </h2>
  );
}

function Zeilentext({ name, sache }: { name: string; sache: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium">{name}</p>
      <p className="text-xs text-leise">{sache}</p>
    </div>
  );
}

export function HeuteKarte() {
  const queryClient = useQueryClient();
  const eintragOeffnen = useEintragOeffnen();
  const abfrage = useQuery({
    queryKey: SCHLUESSEL.ketteHeute,
    queryFn: api.ketteHeute,
    retry: false,
  });
  const einsetzen = useMutation({
    mutationFn: api.schutzEinsetzen,
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });

  if (abfrage.isPending) {
    return null;
  }
  if (abfrage.isError) {
    return (
      <div data-heute>
        <Karte className="space-y-3">
          <StreakKopf />
          <Fehlermeldung fehler={new Error('Etwas ist schiefgelaufen.')} />
        </Karte>
      </div>
    );
  }

  const stand = abfrage.data;
  const rueckkehr = stand.rueckkehr;
  const schutzSichtbar = stand.schutz && stand.schutzLaenge !== null;
  const angeschlagen = stand.angeschlagen;
  if (!rueckkehr && !schutzSichtbar && !angeschlagen) {
    return null;
  }

  return (
    <div data-heute>
      <Karte className="space-y-3">
        <StreakKopf />
        <Fehlermeldung fehler={einsetzen.error} />
        {rueckkehr && (
          <div className="flex min-h-11 items-center gap-3" data-kette="rueckkehr">
            <RotateCcw className="size-4 shrink-0 text-leise" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 items-center text-sm font-medium">
                <span className="truncate">{tx('Rückkehr')}</span>
                <InfoHinweis text="Ein Eintrag in sieben Tagen, ohne Abzug." />
              </p>
              <p className="text-xs text-leise">
                {tx('Bis {datum}', { datum: kurzesDatum(ausTagesSchluessel(rueckkehr.fristAm).toISOString()) })}
              </p>
            </div>
            <Knopf variante="primaer" className="min-h-11 shrink-0 whitespace-nowrap px-3" onClick={() => eintragOeffnen()}>
              {tx('Eintrag')}
            </Knopf>
          </div>
        )}
        {schutzSichtbar && stand.schutzLaenge !== null && (
          <div className="flex min-h-11 items-center gap-3" data-kette="schutz">
            <Shield className="size-4 shrink-0 text-leise" aria-hidden="true" />
            <Zeilentext name={tx('Schutz')} sache={tx('Hält die {n} Tage', { n: zahl(stand.schutzLaenge) })} />
            <Knopf
              variante="primaer"
              className="min-h-11 shrink-0 whitespace-nowrap px-3"
              disabled={einsetzen.isPending}
              onClick={() => einsetzen.mutate()}
            >
              {tx('Einsetzen')}
            </Knopf>
          </div>
        )}
        {angeschlagen && (
          <div className="flex min-h-11 items-center gap-3" data-kette="streak">
            <Flame className="size-4 shrink-0 text-leise" aria-hidden="true" />
            <Zeilentext name={tx("Streak")} sache={tx("{n} Tage · Pause aufgebraucht", { n: zahl(angeschlagen.laenge) })} />
            <Knopf
              variante="primaer"
              className="min-h-11 shrink-0 whitespace-nowrap px-3"
              onClick={() => eintragOeffnen()}
            >
              {tx("Eintrag")}
            </Knopf>
          </div>
        )}
      </Karte>
    </div>
  );
}
