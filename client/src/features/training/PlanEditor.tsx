import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { Trainingsplan } from '../../../../shared/api/training.ts';
import { GRENZEN } from '../../../../shared/spiel/begriffe.ts';
import type { GewichtEinheit } from '../../../../shared/spiel/training.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useSchnellAktion } from '../../components/SchnellAktion.tsx';
import { ZurueckZumMehr } from '../../components/ZurueckZumMehr.tsx';
import { tx } from '../../text.ts';
import { Chip, EINGABE_STIL, Fehlermeldung, Feld, Knopf, Ladeanzeige, Ueberschrift } from '../../ui/index.ts';
import { GewichtKapsel, useGewichtEinheit } from './kapsel.tsx';
import { PlanEintragKarte } from './PlanEintrag.tsx';
import {
  eintragAus,
  leererEintrag,
  pruefePlan,
  standardVorlageId,
  wechselEinheit,
  type EintragStand,
} from './planStand.ts';
import { PlanZuordnung } from './PlanZuordnung.tsx';
import { WOCHENTAGE } from './zieltext.ts';

function NichtDa() {
  return (
    <div className="space-y-6">
      <ZurueckZumMehr pfad="/training" label="Training" />
      <Fehlermeldung fehler={new Error('Der Trainingsplan wurde nicht gefunden.')} />
    </div>
  );
}

function PlanFormular({
  plan,
  einheit,
  vorlageAnfang,
}: {
  plan: Trainingsplan | null;
  einheit: GewichtEinheit;
  vorlageAnfang: number | null;
}) {
  const navigiere = useNavigate();
  const client = useQueryClient();
  const schnell = useSchnellAktion();
  const [name, setName] = useState(plan?.name ?? '');
  const [nameFehler, setNameFehler] = useState<string | null>(null);
  const [wochentage, setWochentage] = useState<number[]>([...(plan?.wochentage ?? [])]);
  const [projektId, setProjektId] = useState<number | null>(plan?.projektId ?? null);
  const [vorlageId, setVorlageId] = useState<number | null>(plan ? plan.vorlageId : vorlageAnfang);
  const [vorlageFehler, setVorlageFehler] = useState<string | null>(null);
  const [eintraege, setEintraege] = useState<EintragStand[]>(() =>
    plan && plan.uebungen.length > 0 ? plan.uebungen.map((uebung) => eintragAus(uebung, einheit)) : plan ? [] : [leererEintrag()],
  );
  const [serverFehler, setServerFehler] = useState<unknown>(null);
  const [arbeit, setArbeit] = useState(false);
  const letzteEinheit = useRef(einheit);

  useEffect(() => {
    if (letzteEinheit.current === einheit) {
      return;
    }
    letzteEinheit.current = einheit;
    setEintraege((aktuell) => aktuell.map((eintrag) => wechselEinheit(eintrag, einheit)));
  }, [einheit]);

  function schalteTag(tag: number) {
    setWochentage((aktuell) => (aktuell.includes(tag) ? aktuell.filter((eintrag) => eintrag !== tag) : [...aktuell, tag]));
  }

  async function speichern() {
    setServerFehler(null);
    const pruefung = pruefePlan({ name, wochentage, projektId, vorlageId, eintraege, einheit });
    setNameFehler(pruefung.nameFehler);
    setVorlageFehler(pruefung.vorlageFehler);
    setEintraege(pruefung.eintraege);
    if (!pruefung.daten) {
      return;
    }
    setArbeit(true);
    try {
      if (plan) {
        await api.aendereTrainingsplan(plan.id, pruefung.daten);
      } else {
        await api.erstelleTrainingsplan(pruefung.daten);
      }
      await client.invalidateQueries({ queryKey: SCHLUESSEL.trainingsplaene });
      navigiere('/training', { replace: true });
    } catch (fehler) {
      setServerFehler(fehler);
    } finally {
      setArbeit(false);
    }
  }

  async function setzeArchiv(archiviert: boolean) {
    if (!plan) {
      return;
    }
    setArbeit(true);
    setServerFehler(null);
    try {
      await api.aendereTrainingsplan(plan.id, { archiviert });
      await client.invalidateQueries({ queryKey: SCHLUESSEL.trainingsplaene });
      navigiere('/training', { replace: true });
    } catch (fehler) {
      setServerFehler(fehler);
    } finally {
      setArbeit(false);
    }
  }

  async function loeschen() {
    if (!plan) {
      return;
    }
    setArbeit(true);
    try {
      const ok = await schnell.ausfuehren(
        { art: 'trainingsplan', id: plan.id, name: plan.name, archiviert: plan.archiviert, loeschbar: plan.loeschbar },
        'loeschen',
      );
      if (ok) {
        navigiere('/training', { replace: true });
      }
    } finally {
      setArbeit(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <ZurueckZumMehr pfad="/training" label="Training" />
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{plan ? tx('Plan bearbeiten') : tx('Neuer Plan')}</h1>
          <GewichtKapsel />
        </header>
      </div>
      <div className="space-y-2">
        <Feld label="Name">
          <input
            type="text"
            autoComplete="off"
            maxLength={GRENZEN.nameMax}
            value={name}
            onChange={(ereignis) => setName(ereignis.target.value)}
            className={EINGABE_STIL}
          />
        </Feld>
        {nameFehler ? <Fehlermeldung fehler={new Error(nameFehler)} /> : null}
      </div>
      <Feld label="Wochentage">
        <div role="group" aria-label={tx('Wochentage')} className="flex flex-wrap gap-1.5">
          {WOCHENTAGE.map((eintrag) => (
            <Chip key={eintrag.tag} aktiv={wochentage.includes(eintrag.tag)} onClick={() => schalteTag(eintrag.tag)}>
              {tx(eintrag.label)}
            </Chip>
          ))}
        </div>
      </Feld>
      <div className="space-y-3">
        <Ueberschrift titel={tx('Einträge')} />
        {eintraege.map((eintrag, index) => (
          <PlanEintragKarte
            key={eintrag.schluessel}
            eintrag={eintrag}
            onChange={(neu) => setEintraege((aktuell) => aktuell.map((alt, stelle) => (stelle === index ? neu : alt)))}
            onEntfernen={() => setEintraege((aktuell) => aktuell.filter((_, stelle) => stelle !== index))}
          />
        ))}
        <button type="button" className="block w-full py-1 text-center text-sm font-medium text-akzent" onClick={() => setEintraege((aktuell) => [...aktuell, leererEintrag()])}>
          {tx('Eintrag hinzufügen')}
        </button>
      </div>
      <PlanZuordnung
        projektId={projektId}
        vorlageId={vorlageId}
        vorlageFehler={vorlageFehler}
        onProjekt={(projekt, vorlage) => {
          setProjektId(projekt);
          setVorlageId(vorlage);
        }}
        onVorlage={setVorlageId}
      />
      {serverFehler ? <Fehlermeldung fehler={serverFehler} /> : null}
      <div className="formular-fuss flex flex-col items-stretch gap-1 md:items-start">
        <Knopf variante="primaer" className="w-full md:w-auto md:min-w-48" disabled={arbeit} onClick={() => void speichern()}>
          {tx('Speichern')}
        </Knopf>
        {plan ? (
          <div className="flex flex-col items-center md:items-start">
            {plan.archiviert ? (
              <Knopf variante="leise" disabled={arbeit} onClick={() => void setzeArchiv(false)}>
                {tx('Wiederherstellen')}
              </Knopf>
            ) : plan.loeschbar ? (
              <Knopf variante="leise" disabled={arbeit} onClick={() => void loeschen()}>
                {tx('Löschen')}
              </Knopf>
            ) : (
              <Knopf variante="leise" disabled={arbeit} onClick={() => void setzeArchiv(true)}>
                {tx('Archivieren')}
              </Knopf>
            )}
            {plan.archiviert && plan.loeschbar ? (
              <Knopf variante="leise" disabled={arbeit} onClick={() => void loeschen()}>
                {tx('Löschen')}
              </Knopf>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PlanEditor() {
  const roh = useParams().id;
  const neu = roh === undefined;
  const id = neu ? null : Number(roh);
  const idGueltig = neu || (id !== null && Number.isInteger(id) && id > 0);
  const aktiv = useQuery({
    queryKey: [...SCHLUESSEL.trainingsplaene, false],
    queryFn: () => api.trainingsplaene(false),
    enabled: idGueltig,
  });
  const archiv = useQuery({
    queryKey: [...SCHLUESSEL.trainingsplaene, true],
    queryFn: () => api.trainingsplaene(true),
    enabled: !neu && idGueltig,
  });
  const vorlagen = useQuery({
    queryKey: SCHLUESSEL.vorlagen,
    queryFn: api.vorlagen,
    enabled: neu && idGueltig,
  });
  const { einheit, bereit } = useGewichtEinheit();

  if (!idGueltig) {
    return <NichtDa />;
  }
  if (aktiv.isPending || !bereit || (neu && vorlagen.isPending)) {
    return <Ladeanzeige />;
  }
  if (aktiv.isError) {
    return <Fehlermeldung fehler={aktiv.error} />;
  }
  if (neu && vorlagen.isError) {
    return <Fehlermeldung fehler={vorlagen.error} />;
  }
  const plan = neu ? null : (aktiv.data?.find((eintrag) => eintrag.id === id) ?? null);
  if (!neu && !plan && archiv.isPending) {
    return <Ladeanzeige />;
  }
  if (!neu && archiv.isError && !plan) {
    return <Fehlermeldung fehler={archiv.error} />;
  }
  const gefunden = plan ?? archiv.data?.find((eintrag) => eintrag.id === id) ?? null;
  if (!neu && !gefunden) {
    return <NichtDa />;
  }
  return <PlanFormular plan={gefunden} einheit={einheit} vorlageAnfang={standardVorlageId(vorlagen.data ?? [])} />;
}
