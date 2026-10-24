import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import type { EinheitUebung, Trainingseinheit, Trainingssatz } from '../../../../shared/api/training.ts';
import { trainingZurueck } from '../../../../shared/spiel/herkunft.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useFeiern } from '../../components/Belohnung.tsx';
import { useBestaetigung } from '../../components/Bestaetigung.tsx';
import { ZurueckZumMehr } from '../../components/ZurueckZumMehr.tsx';
import { tx } from '../../text.ts';
import { Fehlermeldung, InfoHinweis, Knopf, Ladeanzeige } from '../../ui/index.ts';
import { EinheitKarte } from './EinheitAnsicht.tsx';
import { useGewichtEinheit } from './kapsel.tsx';
import { statusText } from './satzAnzeige.ts';

const TAKT_MS = 30_000;

function wegVon(zustand: unknown): '/' | null {
  if (typeof zustand !== 'object' || zustand === null) {
    return null;
  }
  if ('von' in zustand && zustand.von === '/') {
    return '/';
  }
  if ('herkunft' in zustand && zustand.herkunft === '/') {
    return '/';
  }
  return null;
}

function NichtDa({ fehler }: { fehler: unknown }) {
  return (
    <div className="space-y-6">
      <ZurueckZumMehr pfad="/training" label="Training" />
      <Fehlermeldung fehler={fehler ?? new Error('Die Einheit wurde nicht gefunden.')} />
    </div>
  );
}

export function EinheitSeite() {
  const parameter = useParams();
  const id = Number(parameter.id);
  const gueltig = Number.isInteger(id) && id > 0;
  const ort = useLocation();
  const navigiere = useNavigate();
  const client = useQueryClient();
  const feiern = useFeiern();
  const bestaetigen = useBestaetigung();
  const { einheit: gewicht } = useGewichtEinheit();
  const [jetzt, setJetzt] = useState(() => new Date());
  const [arbeit, setArbeit] = useState(false);
  const [fehler, setFehler] = useState<unknown>(null);
  const abfrage = useQuery({
    queryKey: SCHLUESSEL.einheit(gueltig ? id : 0),
    queryFn: () => api.trainingseinheit(id),
    enabled: gueltig,
  });
  const daten = abfrage.data;
  const ziel = trainingZurueck(ort.pathname, { von: wegVon(ort.state) }) ?? { pfad: '/training', label: 'Training' };

  useEffect(() => {
    if (daten?.status !== 'offen') {
      return;
    }
    const timer = window.setInterval(() => setJetzt(new Date()), TAKT_MS);
    return () => window.clearInterval(timer);
  }, [daten?.status]);

  async function schreibe(saetze: readonly Trainingssatz[], erledigt: boolean) {
    const offen = saetze.filter((satz) => satz.erledigt !== erledigt);
    if (offen.length === 0 || !daten?.aenderbar) {
      return;
    }
    setFehler(null);
    setArbeit(true);
    try {
      let letzte: Trainingseinheit | null = null;
      for (const satz of offen) {
        letzte = await api.hakeSatzAb(satz.id, erledigt);
        client.setQueryData(SCHLUESSEL.einheit(letzte.id), letzte);
      }
      await client.invalidateQueries();
    } catch (problem) {
      setFehler(problem);
      await client.invalidateQueries({ queryKey: SCHLUESSEL.einheit(id) });
    } finally {
      setArbeit(false);
    }
  }

  function aufUebung(uebung: EinheitUebung) {
    const alleAn = uebung.saetze.every((satz) => satz.erledigt);
    void schreibe(uebung.saetze, !alleAn);
  }

  async function abschliessen() {
    if (!daten || daten.status !== 'offen') {
      return;
    }
    setFehler(null);
    setArbeit(true);
    try {
      const ergebnis = await api.schliesseEinheitAb(id);
      feiern(ergebnis.belohnung);
      await client.invalidateQueries();
    } catch (problem) {
      setFehler(problem);
    } finally {
      setArbeit(false);
    }
  }

  async function verwerfen() {
    if (!daten || daten.status !== 'offen') {
      return;
    }
    const ja = await bestaetigen({
      titel: tx('Einheit verwerfen'),
      text: tx('Die offene Einheit wird verworfen. Der Eintrag und seine XP fallen weg.'),
      knopf: tx('Verwerfen'),
      gefahr: true,
    });
    if (!ja) {
      return;
    }
    setFehler(null);
    setArbeit(true);
    try {
      await api.verwirfEinheit(id);
      await client.invalidateQueries();
      navigiere(ziel.pfad, { replace: true });
    } catch (problem) {
      setFehler(problem);
      setArbeit(false);
    }
  }

  if (!gueltig) {
    return <NichtDa fehler={null} />;
  }
  if (abfrage.isPending) {
    return (
      <div className="space-y-6">
        <ZurueckZumMehr pfad={ziel.pfad} label={ziel.label} />
        <Ladeanzeige />
      </div>
    );
  }
  if (abfrage.isError || !daten) {
    return <NichtDa fehler={abfrage.error} />;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <ZurueckZumMehr pfad={ziel.pfad} label={ziel.label} />
        <header className="mt-2">
          <div className="flex min-w-0 items-center">
            <h1 className="min-w-0 text-2xl font-bold tracking-tight break-words md:text-3xl">{daten.planName}</h1>
            <InfoHinweis text={tx('Nur abhaken. Die Zahlen stehen im Plan.')} />
          </div>
        </header>
        <p className="mt-2 text-sm text-leise">{statusText(daten, gewicht, jetzt)}</p>
      </div>
      {daten.uebungen.map((uebung) => (
        <EinheitKarte
          key={uebung.uebungId}
          uebung={uebung}
          gewicht={gewicht}
          aenderbar={daten.aenderbar}
          gesperrt={arbeit}
          einheitId={daten.id}
          planName={daten.planName}
          von={wegVon(ort.state)}
          onSatz={(satz) => void schreibe([satz], !satz.erledigt)}
          onUebung={aufUebung}
        />
      ))}
      {fehler ? <Fehlermeldung fehler={fehler} /> : null}
      {daten.status === 'offen' ? (
        <div className="flex flex-col items-stretch md:items-start">
          <Knopf variante="primaer" className="w-full md:w-auto md:min-w-48" disabled={arbeit} onClick={() => void abschliessen()}>
            {tx('Abschließen')}
          </Knopf>
          <Knopf variante="leise" className="self-center md:self-start" disabled={arbeit} onClick={() => void verwerfen()}>
            {tx('Verwerfen')}
          </Knopf>
        </div>
      ) : null}
    </div>
  );
}
