import { tx } from '../../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { KetteHeute } from '../../../../shared/api/kette.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useEintragOeffnen } from '../../components/Layout.tsx';
import { ausTagesSchluessel, kurzesDatum, zahl } from '../../format.ts';
import { Fehlermeldung, InfoHinweis, Karte, Knopf } from '../../ui/index.ts';
import { streakArt, type StreakArt } from './streakSatz.ts';

function StreakKopf() {
  return <h2 className="ueberschrift min-w-0 text-sm font-semibold tracking-wide text-leise uppercase">{tx("Streak")}</h2>;
}

function EintragKnopf({ onClick }: { onClick: () => void }) {
  return (
    <Knopf variante="primaer" className="min-h-11 shrink-0 whitespace-nowrap px-3" onClick={onClick}>
      {tx("+ Eintrag")}
    </Knopf>
  );
}

function Zeile({ kennung, text, extra, aktion }: { kennung: string; text: string; extra?: ReactNode; aktion?: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center gap-3" data-kette={kennung}>
      <p className="min-w-0 flex-1 text-sm leading-5">{text}</p>
      {extra}
      {aktion}
    </div>
  );
}

const KENNUNG: Record<StreakArt, string> = {
  lauf: 'lauf',
  offen: 'offen',
  pause: 'streak',
  rueckkehr: 'rueckkehr',
  neu: 'neu',
};

function satzText(art: StreakArt, stand: KetteHeute): string {
  if (art === 'lauf') {
    return tx("{n} Tage in Folge.", { n: zahl(stand.serie.laenge) });
  }
  if (art === 'offen') {
    return tx("Trag heute etwas ein, damit der Streak bleibt.");
  }
  if (art === 'pause') {
    return tx("Gestern war dein freier Tag.");
  }
  if (art === 'rueckkehr' && stand.rueckkehr) {
    return tx("Streak unterbrochen. Trag bis {datum} etwas ein, um zurückzukehren.", {
      datum: kurzesDatum(ausTagesSchluessel(stand.rueckkehr.fristAm).toISOString()),
    });
  }
  return tx("Neuer Streak beginnt mit dem nächsten Eintrag.");
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
  const art = streakArt(stand);
  const schutzLaenge = stand.schutz && stand.schutzLaenge !== null ? stand.schutzLaenge : null;

  return (
    <div data-heute>
      <Karte className="space-y-3">
        <StreakKopf />
        <Fehlermeldung fehler={einsetzen.error} />
        {art && (
          <Zeile
            kennung={KENNUNG[art]}
            text={satzText(art, stand)}
            extra={
              art === 'rueckkehr' ? (
                <InfoHinweis name="Rückkehr" text="Ein Eintrag in sieben Tagen, ohne Abzug." />
              ) : undefined
            }
            aktion={art === 'lauf' ? undefined : <EintragKnopf onClick={() => eintragOeffnen()} />}
          />
        )}
        {schutzLaenge !== null && (
          <Zeile
            kennung="schutz"
            text={tx("Hält die {n} Tage", { n: zahl(schutzLaenge) })}
            aktion={
              <Knopf
                variante="primaer"
                className="min-h-11 shrink-0 whitespace-nowrap px-3"
                disabled={einsetzen.isPending}
                onClick={() => einsetzen.mutate()}
              >
                {tx("Einsetzen")}
              </Knopf>
            }
          />
        )}
      </Karte>
    </div>
  );
}
