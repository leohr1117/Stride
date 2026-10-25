import { tx } from '../../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { Aufgabe, AufgabeDaten } from '../../../../shared/api/aufgaben.ts';
import { DEADLINE_VERGANGEN, UHRZEIT_BRAUCHT_DATUM, type Wiederholung } from '../../../../shared/spiel/aufgabe.ts';
import { DAUER_OPTIONEN } from '../../../../shared/spiel/begriffe.ts';
import { datumInZone } from '../../../../shared/spiel/datum.ts';
import { taetigkeitPasst, taetigkeitenFuerProjekt } from '../../../../shared/spiel/taetigkeit.ts';
import { bossPhase, bossRingAnteil } from '../../../../shared/spiel/xp.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { SchnellNebenaktion } from '../../components/SchnellAktion.tsx';
import { ZielMarke } from '../../components/ZielMarke.tsx';
import { Icon } from '../../components/Icons.tsx';
import { useEbenen } from '../../funktionen.ts';
import { useSprache } from '../../sprache.tsx';
import { Chip, EINGABE_STIL, Feld, Fehlermeldung, Knopf } from '../../ui/index.ts';
import { AufgabenName, useSchnellFelder } from './AufgabenSchnell.tsx';
import { AufgabenWeiteres } from './AufgabenWeiteres.tsx';

const WOCHENTAGE = [
  { tag: 1, label: 'Mo' },
  { tag: 2, label: 'Di' },
  { tag: 3, label: 'Mi' },
  { tag: 4, label: 'Do' },
  { tag: 5, label: 'Fr' },
  { tag: 6, label: 'Sa' },
  { tag: 7, label: 'So' },
] as const;

const WIEDERHOLUNG = [
  { wert: 'keine', label: 'Einmal' },
  { wert: 'taeglich', label: 'Täglich' },
  { wert: 'woechentlich', label: 'Wöchentlich' },
  { wert: 'monatlich', label: 'Monatlich' },
] as const;

function istWiederholungWahl(wert: string): wert is Wiederholung {
  return WIEDERHOLUNG.some((eintrag) => eintrag.wert === wert);
}

export function AufgabenFormular({ aufgabe, onFertig }: { aufgabe: Aufgabe | null; onFertig: () => void }) {
  const ebenen = useEbenen();
  const queryClient = useQueryClient();
  const zielEbene = ebenen.projekte || ebenen.organisationen || ebenen.visionen;
  const { data: ziele, isLoading: zieleLaden } = useQuery({
    queryKey: SCHLUESSEL.ziele,
    queryFn: api.ziele,
    enabled: zielEbene,
  });
  const { data: vorlagen = [], isLoading: vorlagenLaden } = useQuery({
    queryKey: SCHLUESSEL.vorlagen,
    queryFn: api.vorlagen,
  });
  const [vorlageId, setVorlageId] = useState<number | null>(aufgabe?.vorlageId ?? null);
  const { data: einstellungen } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const { sprache } = useSprache();
  const heute = datumInZone(new Date(), einstellungen?.zeitzone ?? null);
  const [wiederholung, setWiederholung] = useState<Wiederholung>(aufgabe?.wiederholung ?? 'keine');
  const [wochentage, setWochentage] = useState<number[]>(aufgabe?.wochentage ?? []);
  const [stunden, setStunden] = useState<number | null>(aufgabe?.stunden ?? null);
  const richteVorlage = (naechstes: number | null) => {
    const ziel = ebenen.projekte ? naechstes : null;
    setVorlageId((aktuell) => {
      if (aktuell === null) {
        return null;
      }
      const gewaehlt = vorlagen.find((vorlage) => vorlage.id === aktuell);
      return gewaehlt && taetigkeitPasst(gewaehlt.projektId, ziel) ? aktuell : null;
    });
  };
  const schnell = useSchnellFelder({
    anfang: {
      name: aufgabe?.name ?? '',
      faelligAm: aufgabe?.faelligAm ?? '',
      faelligUm: aufgabe?.faelligUm ?? '',
      prioritaet: aufgabe?.prioritaet ?? null,
      projektId: aufgabe?.projektId ?? null,
      organisationId: aufgabe?.organisationId ?? null,
      visionId: aufgabe?.visionId ?? null,
    },
    heute,
    sprache,
    ziele,
    ebenen,
    onProjekt: richteVorlage,
  });
  const { nameRein, faelligAm, faelligUm, prioritaet, projektId } = schnell;
  const [meilenstein, setMeilenstein] = useState(aufgabe?.meilenstein ?? false);
  const [gegner, setGegner] = useState(aufgabe?.gegner ?? false);
  const [boss, setBoss] = useState(aufgabe?.boss ?? false);
  const [deadline, setDeadline] = useState(aufgabe?.deadline ?? '');
  const [weiteresOffen, setWeiteresOffen] = useState(
    aufgabe !== null && (aufgabe.prioritaet !== null || aufgabe.meilenstein || aufgabe.gegner || aufgabe.boss || aufgabe.deadline !== null),
  );
  const wirksameProjektId = ebenen.projekte ? projektId : null;
  const vorlagePasst = vorlagen.some(
    (vorlage) => vorlage.id === vorlageId && taetigkeitPasst(vorlage.projektId, wirksameProjektId),
  );
  const wirksameVorlageId = vorlagePasst ? vorlageId : null;
  const projekte = ziele?.projekte.filter((projekt) => projekt.aktiv || projekt.id === projektId) ?? [];
  const nameLeer = nameRein === '';
  const ohneTaetigkeit = wirksameProjektId === null && wirksameVorlageId === null;
  const ohneDatum = wiederholung !== 'keine' && faelligAm === '';
  const ohneTag = wiederholung === 'woechentlich' && wochentage.length === 0;
  const uhrzeitOhneDatum = faelligUm !== '' && faelligAm === '';
  const deadlineVergangen = deadline !== '' && deadline < heute && deadline !== aufgabe?.deadline;
  const laedt = vorlagenLaden || (zielEbene && zieleLaden);
  const sperre = nameLeer || ohneTaetigkeit || ohneDatum || ohneTag || uhrzeitOhneDatum || deadlineVergangen || laedt;
  const hinweis = uhrzeitOhneDatum
    ? tx(UHRZEIT_BRAUCHT_DATUM)
    : deadlineVergangen
      ? tx(DEADLINE_VERGANGEN)
      : ohneDatum
        ? tx('Eine Wiederholung braucht ein Datum.')
        : ohneTag
          ? tx('Wähle mindestens einen Wochentag.')
          : !nameLeer && ohneTaetigkeit
            ? tx('Wähle eine Tätigkeit.')
            : null;
  const deadlineGueltig = /^\d{4}-\d{2}-\d{2}$/.test(deadline);
  const ringStart = aufgabe ? datumInZone(new Date(aufgabe.erstelltAm), einstellungen?.zeitzone ?? null) : heute;
  const ring =
    deadlineGueltig && (meilenstein ? boss : gegner)
      ? { anteil: bossRingAnteil(ringStart, deadline, heute), erwacht: bossPhase(deadline, heute) === 'erwacht' }
      : null;
  const deadlineMin = aufgabe?.deadline && aufgabe.deadline < heute ? aufgabe.deadline : heute;

  const speichern = useMutation({
    mutationFn: () => {
      const kampf = meilenstein ? boss : gegner;
      const gemeinsam = {
        name: nameRein,
        icon: 'clipboard-list' as const,
        vorlageId: wirksameVorlageId,
        stunden,
        faelligAm: faelligAm === '' ? null : faelligAm,
        faelligUm: faelligUm === '' ? null : faelligUm,
        wiederholung,
        wochentage: wiederholung === 'woechentlich' ? [...wochentage].sort((a, b) => a - b) : [],
        prioritaet,
        nurHeute: false,
        meilenstein,
        gegner: meilenstein ? false : gegner,
        boss: meilenstein && boss,
        deadline: kampf && deadline !== '' ? deadline : null,
      };
      if (!aufgabe) {
        const daten: AufgabeDaten = {
          ...gemeinsam,
          projektId: wirksameProjektId,
          organisationId: ebenen.organisationen ? schnell.organisationId : null,
          visionId: ebenen.visionen ? schnell.visionId : null,
        };
        return api.erstelleAufgabe(daten);
      }
      return api.aendereAufgabe(aufgabe.id, {
        ...gemeinsam,
        ...(ebenen.projekte ? { projektId: wirksameProjektId } : {}),
        ...(ebenen.organisationen ? { organisationId: schnell.organisationId } : {}),
        ...(ebenen.visionen ? { visionId: schnell.visionId } : {}),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onFertig();
    },
  });

  const absenden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (sperre || speichern.isPending) {
      return;
    }
    speichern.mutate();
  };

  const setzeWiederholung = (wert: Wiederholung) => {
    setWiederholung(wert);
    if (wert !== 'woechentlich') {
      setWochentage([]);
    }
    if (wert !== 'keine') {
      setGegner(false);
      setBoss(false);
      setDeadline('');
    }
  };

  const setzeMeilenstein = (an: boolean) => {
    setMeilenstein(an);
    setGegner(false);
    if (!an) {
      setBoss(false);
    }
    setDeadline('');
  };

  const setzeGegner = (an: boolean) => {
    setGegner(an);
    if (an) {
      setMeilenstein(false);
      setBoss(false);
      setWiederholung('keine');
      setWochentage([]);
      return;
    }
    setDeadline('');
  };

  const setzeBoss = (an: boolean) => {
    setBoss(an);
    if (an) {
      setGegner(false);
      setWiederholung('keine');
      setWochentage([]);
      return;
    }
    setDeadline('');
  };

  return (
    <form onSubmit={absenden} className="space-y-4">
      <AufgabenName
        name={schnell.name}
        ergebnis={schnell.ergebnis}
        cursor={schnell.cursor}
        sprung={schnell.sprung}
        onName={schnell.setzeName}
        onCursor={schnell.setzeCursor}
        onKreuz={schnell.kreuz}
        onVorschlag={schnell.waehle}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Feld label={tx('Datum')}>
          <input
            type="date"
            className={EINGABE_STIL}
            value={faelligAm}
            placeholder={tx('Optional')}
            onChange={(ereignis) => schnell.setzeDatum(ereignis.target.value)}
          />
        </Feld>
        <Feld label={tx('Uhrzeit')}>
          <input
            type="time"
            step={60}
            className={EINGABE_STIL}
            value={faelligUm}
            placeholder={tx('Optional')}
            onChange={(ereignis) => schnell.setzeUhrzeit(/^(\d{2}:\d{2})/.exec(ereignis.target.value)?.[1] ?? '')}
          />
        </Feld>
      </div>
      <div className={ebenen.projekte ? 'grid gap-4 md:grid-cols-2' : ''}>
        <Feld label={tx('Wiederholung')}>
          <div role="group" aria-label={tx('Wiederholung')} className="flex flex-wrap gap-1.5">
            {WIEDERHOLUNG.map((eintrag) => (
              <Chip
                key={eintrag.wert}
                aktiv={wiederholung === eintrag.wert}
                onClick={() => {
                  if (!istWiederholungWahl(eintrag.wert)) {
                    return;
                  }
                  setzeWiederholung(eintrag.wert);
                }}
              >
                {tx(eintrag.label)}
              </Chip>
            ))}
          </div>
        </Feld>
        {ebenen.projekte && (
          <Feld label={<ZielMarke ebene="projekte" />}>
            <select
              className={EINGABE_STIL}
              value={projektId ?? ''}
              onChange={(ereignis) => schnell.setzeProjekt(ereignis.target.value ? Number(ereignis.target.value) : null)}
            >
              <option value="">{tx('Keins')}</option>
              {projekte.map((projekt) => (
                <option key={projekt.id} value={projekt.id}>
                  {projekt.name}
                </option>
              ))}
            </select>
          </Feld>
        )}
      </div>
      {wiederholung === 'woechentlich' && (
        <Feld label={tx('Wochentage')}>
          <div role="group" aria-label={tx('Wochentage')} className="flex flex-wrap gap-1.5">
            {WOCHENTAGE.map((eintrag) => (
              <Chip
                key={eintrag.tag}
                aktiv={wochentage.includes(eintrag.tag)}
                onClick={() =>
                  setWochentage((aktuell) =>
                    aktuell.includes(eintrag.tag) ? aktuell.filter((tag) => tag !== eintrag.tag) : [...aktuell, eintrag.tag],
                  )
                }
              >
                {tx(eintrag.label)}
              </Chip>
            ))}
          </div>
        </Feld>
      )}
      <Feld label={tx('Tätigkeit')}>
        <div role="group" aria-label={tx('Tätigkeit')} className="flex flex-wrap gap-1.5">
          {wirksameProjektId !== null && (
            <Chip aktiv={wirksameVorlageId === null} onClick={() => setVorlageId(null)}>
              {tx('Standard des Projekts')}
            </Chip>
          )}
          {taetigkeitenFuerProjekt(vorlagen, wirksameProjektId, wirksameVorlageId).map((vorlage) => (
            <Chip
              key={vorlage.id}
              umbruch
              aktiv={wirksameVorlageId === vorlage.id}
              onClick={() => setVorlageId(vorlage.id)}
            >
              <Icon name={vorlage.icon} className="size-4" />
              {vorlage.name}
            </Chip>
          ))}
        </div>
      </Feld>
      <Feld label={tx('Dauer')}>
        <div role="group" aria-label={tx('Dauer')} className="flex flex-wrap gap-1.5">
          <Chip aktiv={stunden === null} onClick={() => setStunden(null)}>
            {tx('Keine Angabe')}
          </Chip>
          {DAUER_OPTIONEN.map((option) => (
            <Chip key={option.stunden} aktiv={stunden === option.stunden} onClick={() => setStunden(option.stunden)}>
              {tx(option.label)}
            </Chip>
          ))}
        </div>
      </Feld>
      <AufgabenWeiteres
        offen={weiteresOffen}
        onOffen={setWeiteresOffen}
        prioritaet={prioritaet}
        onPrioritaet={schnell.setzePrioritaet}
        meilenstein={meilenstein}
        onMeilenstein={setzeMeilenstein}
        gegner={gegner}
        onGegner={setzeGegner}
        boss={boss}
        onBoss={setzeBoss}
        deadline={deadline}
        onDeadline={setDeadline}
        deadlineMin={deadlineMin}
        ring={ring}
      />
      {hinweis && <p className="text-sm break-words text-gefahr">{hinweis}</p>}
      <Fehlermeldung fehler={speichern.error} />
      <div className="flex flex-wrap gap-2">
        {aufgabe ? (
          <SchnellNebenaktion
            ziel={{
              art: 'aufgabe',
              id: aufgabe.id,
              name: aufgabe.name,
              archiviert: aufgabe.archiviert,
              loeschbar: aufgabe.loeschbar,
            }}
            onErledigt={onFertig}
          />
        ) : null}
        <Knopf type="submit" variante="primaer" className="flex-1" disabled={sperre || speichern.isPending}>
          {tx('Speichern')}
        </Knopf>
      </div>
    </form>
  );
}
