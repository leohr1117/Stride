import { tx, txMenge } from '../../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import type { KetteHeute } from '../../../../shared/api/kette.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useEintragOeffnen } from '../../components/Layout.tsx';
import { ausTagesSchluessel, kurzesDatum, zahl } from '../../format.ts';
import { AbschnittKopf, Fehlermeldung, Flaeche, InfoHinweis, Knopf } from '../../ui/index.ts';
import { streakAbschnittSichtbar, streakArt, STREAK_ZEILE_ENG, type StreakArt } from './streakSatz.ts';

function useStreakZeileEng(): boolean {
  const [eng, setEng] = useState(() => window.matchMedia(STREAK_ZEILE_ENG).matches);
  useEffect(() => {
    const medien = window.matchMedia(STREAK_ZEILE_ENG);
    const setze = () => setEng(medien.matches);
    setze();
    medien.addEventListener('change', setze);
    return () => medien.removeEventListener('change', setze);
  }, []);
  return eng;
}

function EintragKnopf({ onClick }: { onClick: () => void }) {
  return (
    <Knopf variante="text" className="shrink-0" onClick={onClick}>
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
    return tx('Streak offen · heute eintragen');
  }
  if (art === 'pause') {
    return tx('Pause genutzt · gestern frei');
  }
  if (art === 'rueckkehr' && stand.rueckkehr) {
    return tx('Streak unterbrochen · bis {datum} zurückholen', {
      datum: kurzesDatum(ausTagesSchluessel(stand.rueckkehr.fristAm).toISOString()),
    });
  }
  return tx('Neuer Streak beginnt mit dem nächsten Eintrag.');
}

function handlungInfo(art: Exclude<StreakArt, 'lauf'>): ReactNode {
  if (art === 'offen') {
    return <InfoHinweis abstand={false} name="Streak" text="Trag heute etwas ein, damit der Streak bleibt." />;
  }
  if (art === 'pause') {
    return <InfoHinweis abstand={false} name="Streak" text="Gestern war dein freier Tag." />;
  }
  if (art === 'rueckkehr') {
    return <InfoHinweis abstand={false} name="Rückkehr" text="Ein Eintrag in sieben Tagen, ohne Abzug." />;
  }
  return null;
}

function Handlungszeile({
  kennung,
  text,
  info,
  aktion,
}: {
  kennung: string;
  text: string;
  info?: ReactNode;
  aktion?: ReactNode;
}) {
  return (
    <div className="px-4 py-4" data-kette={kennung}>
      <div className="flex min-w-0 items-center gap-3" data-kette-zeile>
        <div className="flex min-w-0 flex-1 items-center">
          <p className="min-w-0 truncate text-sm leading-5" data-kette-satz>
            {text}
          </p>
          {info ? (
            <span className="relative ms-1.5 h-0 w-11 shrink-0">
              <span className="absolute top-1/2 left-0 -translate-y-1/2">{info}</span>
            </span>
          ) : null}
        </div>
        {aktion ? (
          <span className="relative flex h-0 min-h-0 w-max shrink-0">
            <span className="invisible px-3 text-sm font-medium whitespace-nowrap" aria-hidden="true">
              {tx('+ Eintrag')}
            </span>
            <span className="absolute top-1/2 right-0 -translate-y-1/2">{aktion}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function HeuteKarte() {
  const queryClient = useQueryClient();
  const eintragOeffnen = useEintragOeffnen();
  const eng = useStreakZeileEng();
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
              <Handlungszeile
                kennung={KENNUNG[handlung]}
                text={eng ? tx('Streak offen') : satzText(handlung, stand)}
                info={handlungInfo(handlung)}
                aktion={<EintragKnopf onClick={() => eintragOeffnen()} />}
              />
            )}
            {schutzLaenge !== null && (
              <Zeile
                kennung="schutz"
                text={txMenge(schutzLaenge, 'Hält die {n} Tage', { n: zahl(schutzLaenge) })}
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
