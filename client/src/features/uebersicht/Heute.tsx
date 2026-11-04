import { tx } from '../../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { KetteHeute } from '../../../../shared/api/kette.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useEintragOeffnen } from '../../components/Layout.tsx';
import { ausTagesSchluessel, kurzesDatum, zahl } from '../../format.ts';
import { AbschnittKopf, Fehlermeldung, Flaeche, InfoHinweis, Knopf } from '../../ui/index.ts';
import { streakAbschnittSichtbar, streakArt, type StreakArt } from './streakSatz.ts';

function EintragKnopf({ onClick }: { onClick: () => void }) {
  return (
    <Knopf variante="leise" className="shrink-0 whitespace-nowrap px-3" onClick={onClick}>
      {tx('+ Eintrag')}
    </Knopf>
  );
}

function Zeile({ kennung, text, extra, aktion }: { kennung: string; text: string; extra?: ReactNode; aktion?: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-4" data-kette={kennung}>
      <p className="min-w-0 flex-1 text-sm leading-5">{text}</p>
      {extra}
      {aktion}
    </div>
  );
}

const KENNUNG: Record<Exclude<StreakArt, 'lauf'>, string> = {
  offen: 'offen',
  pause: 'streak',
  rueckkehr: 'rueckkehr',
  neu: 'neu',
};

function satzText(art: Exclude<StreakArt, 'lauf'>, stand: KetteHeute): string {
  if (art === 'offen') {
    return tx('Trag heute etwas ein, damit der Streak bleibt.');
  }
  if (art === 'pause') {
    return tx('Gestern war dein freier Tag.');
  }
  if (art === 'rueckkehr' && stand.rueckkehr) {
    return tx('Streak unterbrochen. Trag bis {datum} etwas ein, um zurückzukehren.', {
      datum: kurzesDatum(ausTagesSchluessel(stand.rueckkehr.fristAm).toISOString()),
    });
  }
  return tx('Neuer Streak beginnt mit dem nächsten Eintrag.');
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

  const stand = abfrage.isError ? null : abfrage.data;
  const art = stand ? streakArt(stand) : null;
  const schutzLaenge = stand?.schutz && stand.schutzLaenge !== null ? stand.schutzLaenge : null;
  const fehler = abfrage.isError || einsetzen.isError;
  if (!streakAbschnittSichtbar(art, schutzLaenge, fehler)) {
    return null;
  }
  const handlung = art !== null && art !== 'lauf' ? art : null;

  return (
    <section data-heute className="md:max-w-[720px]">
      <AbschnittKopf titel={tx('Streak')} />
      <Flaeche>
        {abfrage.isError ? (
          <div className="px-4 py-3">
            <Fehlermeldung fehler={new Error('Etwas ist schiefgelaufen.')} />
          </div>
        ) : (
          <>
            {einsetzen.error ? (
              <div className="px-4 pt-3">
                <Fehlermeldung fehler={einsetzen.error} />
              </div>
            ) : null}
            {handlung && stand && (
              <Zeile
                kennung={KENNUNG[handlung]}
                text={satzText(handlung, stand)}
                extra={
                  handlung === 'rueckkehr' ? (
                    <InfoHinweis name="Rückkehr" text="Ein Eintrag in sieben Tagen, ohne Abzug." />
                  ) : undefined
                }
                aktion={<EintragKnopf onClick={() => eintragOeffnen()} />}
              />
            )}
            {schutzLaenge !== null && (
              <Zeile
                kennung="schutz"
                text={tx('Hält die {n} Tage', { n: zahl(schutzLaenge) })}
                aktion={
                  <Knopf
                    variante="leise"
                    className="shrink-0 whitespace-nowrap px-3"
                    aria-busy={einsetzen.isPending || undefined}
                    onClick={() => {
                      if (einsetzen.isPending) return;
                      einsetzen.mutate();
                    }}
                  >
                    {tx('Einsetzen')}
                  </Knopf>
                }
              />
            )}
          </>
        )}
      </Flaeche>
    </section>
  );
}
