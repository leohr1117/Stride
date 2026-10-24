import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { Trainingseinheit } from '../../../../shared/api/training.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { Abschnitt } from '../../components/Ausklappbar.tsx';
import { ZurueckZumMehr } from '../../components/ZurueckZumMehr.tsx';
import { kurzesDatum } from '../../format.ts';
import { tx } from '../../text.ts';
import { archivBeschriftung, Fehlermeldung, InfoHinweis, Karte, Knopf, Ladeanzeige } from '../../ui/index.ts';
import { GewichtKapsel, useGewichtEinheit } from './kapsel.tsx';
import { PlanKarte } from './PlanKarte.tsx';
import { minutenText } from './zieltext.ts';

const TRAINING_INFO = 'Eine Einheit ist ein Eintrag. Aufwärmen zählt nicht zum Bestwert.';

function herkunftVon(zustand: unknown): string | null {
  if (typeof zustand !== 'object' || zustand === null || !('herkunft' in zustand)) {
    return null;
  }
  return zustand.herkunft === '/' ? '/' : null;
}

function Kopf({ mitPlan }: { mitPlan: boolean }) {
  const navigiere = useNavigate();
  return (
    <header className="flex flex-nowrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{tx('Training')}</h1>
        <InfoHinweis text={TRAINING_INFO} />
      </div>
      <div className="flex items-center gap-2.5">
        <GewichtKapsel />
        {mitPlan ? (
          <Knopf variante="primaer" className="shrink-0 !px-3 !py-2" onClick={() => navigiere('/training/plaene/neu')}>
            {tx('+ Plan')}
          </Knopf>
        ) : null}
      </div>
    </header>
  );
}

function EinheitBanner({ einheit }: { einheit: Trainingseinheit }) {
  const navigiere = useNavigate();
  const minuten = minutenText(einheit.begonnenAm, new Date());
  return (
    <Karte>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">{tx('Einheit läuft')}</p>
          <p className="mt-1 text-sm text-leise">
            {einheit.planName} · {minuten}
          </p>
        </div>
        <Knopf variante="primaer" className="shrink-0" onClick={() => navigiere(`/training/einheiten/${einheit.id}`)}>
          {tx('Öffnen')}
        </Knopf>
      </div>
    </Karte>
  );
}

export function TrainingSeite() {
  const ort = useLocation();
  const client = useQueryClient();
  const vonHeute = herkunftVon(ort.state) === '/';
  const { einheit } = useGewichtEinheit();
  const plaene = useQuery({
    queryKey: [...SCHLUESSEL.trainingsplaene, false],
    queryFn: () => api.trainingsplaene(false),
  });
  const archiv = useQuery({
    queryKey: [...SCHLUESSEL.trainingsplaene, true],
    queryFn: () => api.trainingsplaene(true),
  });
  const einheiten = useQuery({ queryKey: SCHLUESSEL.einheiten, queryFn: api.trainingseinheiten });
  const [archivOffen, setArchivOffen] = useState(false);
  const [aktionFehler, setAktionFehler] = useState<unknown>(null);
  const start = useMutation({
    mutationFn: (planId: number) => api.starteEinheit(planId),
    onSuccess: async () => {
      setAktionFehler(null);
      await client.invalidateQueries({ queryKey: SCHLUESSEL.einheiten });
    },
    onError: (fehler) => setAktionFehler(fehler),
  });

  async function wiederherstellen(planId: number) {
    try {
      await api.aendereTrainingsplan(planId, { archiviert: false });
      setAktionFehler(null);
      await client.invalidateQueries({ queryKey: SCHLUESSEL.trainingsplaene });
    } catch (fehler) {
      setAktionFehler(fehler);
    }
  }

  const zurueck = vonHeute ? <ZurueckZumMehr pfad="/" label="Übersicht" /> : null;
  if (plaene.isPending) {
    return (
      <div className="space-y-6">
        {zurueck}
        <Kopf mitPlan={false} />
        <Ladeanzeige />
      </div>
    );
  }
  if (plaene.isError) {
    return (
      <div className="space-y-6">
        {zurueck}
        <Kopf mitPlan />
        <Fehlermeldung fehler={plaene.error} />
      </div>
    );
  }

  const offen = einheiten.data?.find((einheitEintrag) => einheitEintrag.status === 'offen') ?? null;
  const fertig = (einheiten.data ?? []).filter((einheitEintrag) => einheitEintrag.status === 'fertig' && einheitEintrag.beendetAm !== null);
  const archivListe = archiv.data ?? [];

  return (
    <div className="space-y-6">
      {zurueck}
      <Kopf mitPlan />
      {einheiten.isError ? <Fehlermeldung fehler={einheiten.error} /> : null}
      {aktionFehler ? <Fehlermeldung fehler={aktionFehler} /> : null}
      {offen ? <EinheitBanner einheit={offen} /> : null}
      {plaene.data.length === 0 ? <Karte className="py-10 text-center text-sm text-leise">{tx('Noch kein Plan.')}</Karte> : null}
      {plaene.data.map((plan) => (
        <PlanKarte
          key={plan.id}
          plan={plan}
          einheit={einheit}
          offenId={offen?.planId === plan.id ? offen.id : null}
          startet={start.isPending}
          onStart={(planId) => start.mutate(planId)}
          onWiederherstellen={(planId) => void wiederherstellen(planId)}
        />
      ))}
      {fertig.length > 0 ? (
        <Abschnitt titel="Letzte Einheiten" kennung="training-letzte-einheiten" anfangEingeklappt>
          <Karte>
            <ul className="space-y-2">
              {fertig.map((einheitEintrag) => (
                <li key={einheitEintrag.id} className="text-sm text-leise">
                  {kurzesDatum(einheitEintrag.begonnenAm)} · {minutenText(einheitEintrag.begonnenAm, new Date(einheitEintrag.beendetAm ?? einheitEintrag.begonnenAm))}
                </li>
              ))}
            </ul>
          </Karte>
        </Abschnitt>
      ) : null}
      {archiv.isError ? <Fehlermeldung fehler={archiv.error} /> : null}
      {archivListe.length > 0 ? (
        <section className="space-y-2">
          <div className="flex justify-center">
            <Knopf variante="leise" onClick={() => setArchivOffen((wert) => !wert)}>
              {archivBeschriftung(archivOffen, archivListe.length)}
            </Knopf>
          </div>
          {archivOffen
            ? archivListe.map((plan) => (
                <PlanKarte
                  key={plan.id}
                  plan={plan}
                  einheit={einheit}
                  offenId={null}
                  startet={false}
                  onStart={() => undefined}
                  onWiederherstellen={(planId) => void wiederherstellen(planId)}
                />
              ))
            : null}
        </section>
      ) : null}
    </div>
  );
}
