import { tx, txMenge } from '../../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { AbhakKreis } from './AbhakKreis.tsx';
import { useState, type FormEvent } from 'react';
import type { BasisAufgabe } from '../../../../shared/api/index.ts';
import { DAUER_OPTIONEN, GRENZEN, type IconName } from '../../../../shared/spiel/begriffe.ts';
import { fehlendeZuordnung } from '../../../../shared/spiel/ebenen.ts';
import { taetigkeitPasst, taetigkeitenFuerProjekt } from '../../../../shared/spiel/taetigkeit.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { merkeAngebotFaellig } from '../uebersicht/angebotStand.ts';
import { merkeBewertungFaellig } from '../uebersicht/bewertungStand.ts';
import { dauerText } from '../../format.ts';
import { useEbenen } from '../../funktionen.ts';
import { leseMerker, merke } from '../../speicher.ts';
import { EinklappKopf } from '../../components/Ausklappbar.tsx';
import { DichteZeilen, Zeile } from '../../components/Zeile.tsx';
import { SchnellZeile } from '../../components/SchnellAktion.tsx';
import { useFeiern } from '../../components/Belohnung.tsx';
import { Icon } from '../../components/Icons.tsx';
import { IconAuswahl } from '../../components/IconAuswahl.tsx';
import { EINGABE_STIL, Feld, Fehlermeldung, Flaeche, Formular, Knopf, VorschlagFeld } from '../../ui/index.ts';
import { HierarchieWahl } from '../../components/HierarchieWahl.tsx';
import { ZielMarke } from '../../components/ZielMarke.tsx';
import { gliedereProjekte, wahlBaum } from '../../projektHierarchie.ts';

function dauerTextZuZahl(text: string): { stunden: number | null; fehler: string | null; unfertig: boolean } {
  const roh = text.trim();
  if (roh === '') {
    return { stunden: null, fehler: null, unfertig: false };
  }
  if (roh === '.' || /^\d+\.$/.test(roh)) {
    return { stunden: null, fehler: null, unfertig: true };
  }
  if (!/^\d+(\.\d+)?$/.test(roh)) {
    return { stunden: null, fehler: txMenge(GRENZEN.stundenMin, 'Die Dauer muss mindestens {min} Stunden sein.', { min: String(GRENZEN.stundenMin) }), unfertig: false };
  }
  const wert = Number(roh);
  if (wert < GRENZEN.stundenMin) {
    return { stunden: null, fehler: txMenge(GRENZEN.stundenMin, 'Die Dauer muss mindestens {min} Stunden sein.', { min: String(GRENZEN.stundenMin) }), unfertig: false };
  }
  if (wert > GRENZEN.stundenMax) {
    return { stunden: null, fehler: txMenge(GRENZEN.stundenMax, 'Die Dauer darf höchstens {max} Stunden sein.', { max: String(GRENZEN.stundenMax) }), unfertig: false };
  }
  return { stunden: wert, fehler: null, unfertig: false };
}

function bereinigeDauer(roh: string): string {
  const erlaubt = roh.replace(',', '.').replace(/[^\d.]/g, '');
  const [ganz, ...rest] = erlaubt.split('.');
  const kopf = (ganz ?? '').slice(0, 2);
  if (rest.length === 0) {
    return kopf;
  }
  return `${kopf}.${rest.join('').slice(0, 2)}`;
}

export function useBasisAufgaben() {
  return useQuery({ queryKey: SCHLUESSEL.basis, queryFn: api.basis });
}

export function useBasisAktionen() {
  const queryClient = useQueryClient();
  const feiern = useFeiern();
  const erledigen = useMutation({
    mutationFn: (id: number) => api.erledigeBasisAufgabe(id),
    onSuccess: (ergebnis) => {
      merkeBewertungFaellig(queryClient, ergebnis);
      merkeAngebotFaellig(queryClient, ergebnis);
      void queryClient.invalidateQueries();
      feiern(ergebnis.belohnung);
    },
  });
  const rueckgaengig = useMutation({
    mutationFn: (eintragId: number) => api.loescheEintrag(eintragId),
    onSuccess: () => void queryClient.invalidateQueries(),
  });
  return {
    erledigen: (id: number) => erledigen.mutate(id),
    rueckgaengig: (eintragId: number) => rueckgaengig.mutate(eintragId),
    laeuft: erledigen.isPending || rueckgaengig.isPending,
    fehler: erledigen.error ?? rueckgaengig.error,
  };
}

export function BasisListe({
  aufgaben,
  mitProjekt,
  onBearbeiten,
  fluchten = false,
}: {
  aufgaben: BasisAufgabe[];
  mitProjekt: boolean;
  onBearbeiten?: (aufgabe: BasisAufgabe) => void;
  fluchten?: boolean;
}) {
  const aktionen = useBasisAktionen();
  return (
    <>
      <ul className={fluchten ? 'liste symbol-liste' : 'space-y-1'}>
        {aufgaben.map((aufgabe) => (
          <BasisZeile
            key={aufgabe.id}
            aufgabe={aufgabe}
            mitProjekt={mitProjekt}
            laeuft={aktionen.laeuft}
            fluchten={fluchten}
            onErledigen={() => aktionen.erledigen(aufgabe.id)}
            onRueckgaengig={aktionen.rueckgaengig}
            onBearbeiten={onBearbeiten && (() => onBearbeiten(aufgabe))}
          />
        ))}
      </ul>
      <Fehlermeldung fehler={aktionen.fehler} />
    </>
  );
}

function BasisZeile({
  aufgabe,
  mitProjekt,
  laeuft,
  fluchten = false,
  onErledigen,
  onRueckgaengig,
  onBearbeiten,
}: {
  aufgabe: BasisAufgabe;
  mitProjekt: boolean;
  laeuft: boolean;
  fluchten?: boolean;
  onErledigen: () => void;
  onRueckgaengig: (eintragId: number) => void;
  onBearbeiten?: () => void;
}) {
  const heuteEintragId = aufgabe.heuteEintragId;
  const details = [
    mitProjekt ? aufgabe.projektName : null,
    aufgabe.stunden !== null ? dauerText(aufgabe.stunden) : null,
  ]
    .filter((teil) => teil !== null)
    .join(' · ');

  const abhak = (
    <AbhakKreis
      name={aufgabe.name}
      erledigt={heuteEintragId !== null}
      laeuft={laeuft}
      onUmschalten={() => (heuteEintragId !== null ? onRueckgaengig(heuteEintragId) : onErledigen())}
    />
  );
  const stift = onBearbeiten ? (
    <Knopf variante="leise" className="p-2" aria-label={tx('{name} bearbeiten', { name: aufgabe.name })} onClick={onBearbeiten}>
      <Pencil className="size-4" />
    </Knopf>
  ) : null;

  return (
    <li className={fluchten ? 'symbol-zeile' : undefined}>
      <SchnellZeile
        className={fluchten ? '' : 'rounded-xl'}
        ziel={{ art: 'basis', id: aufgabe.id, name: aufgabe.name, archiviert: aufgabe.archiviert, loeschbar: aufgabe.loeschbar }}
      >
        {(menue) =>
          fluchten ? (
            <div className="flex min-h-12 items-center px-4">
              <span className="symbol-platz">
                <Icon name={aufgabe.icon} style={{ color: aufgabe.farbe }} />
              </span>
              <div className="zeilen-text ms-3 min-w-0 flex-1">
                <p className={`truncate text-sm ${heuteEintragId !== null ? 'text-leise' : 'font-medium'}`}>{aufgabe.name}</p>
                {details && <p className="truncate text-xs text-leise">{details}</p>}
              </div>
              <span className="ms-1 flex shrink-0 items-center gap-1">
                {menue}
                {stift}
                {abhak}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-1 py-0.5">
              <Icon name={aufgabe.icon} className="size-4 shrink-0" style={{ color: aufgabe.farbe }} />
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${heuteEintragId !== null ? 'text-leise' : 'font-medium'}`}>{aufgabe.name}</p>
                {details && <p className="truncate text-xs text-leise">{details}</p>}
              </div>
              {menue}
              {stift}
              {abhak}
            </div>
          )
        }
      </SchnellZeile>
    </li>
  );
}

const EINGEKLAPPT_SCHLUESSEL = 'stride.basisEingeklappt';

export function BasisKarte() {
  const ebenen = useEbenen();
  const { data: aufgaben, error } = useBasisAufgaben();
  const [eingeklappt, setEingeklappt] = useState(() => leseMerker(EINGEKLAPPT_SCHLUESSEL));
  if (!aufgaben) {
    return <Fehlermeldung fehler={error} />;
  }
  const aktive = aufgaben.filter((aufgabe) => !aufgabe.archiviert);
  if (aktive.length === 0) {
    return null;
  }
  const erledigt = aktive.filter((aufgabe) => aufgabe.heuteEintragId !== null).length;

  const umschalten = () => {
    merke(EINGEKLAPPT_SCHLUESSEL, !eingeklappt);
    setEingeklappt(!eingeklappt);
  };

  return (
    <section className="md:max-w-[720px]">
      <EinklappKopf
        titel={tx("Basis")}
        offen={!eingeklappt}
        onToggle={umschalten}
        className="abschnitt-kopf"
        zusatz={
          <span className="zahl text-xs text-leise">
            {erledigt}/{aktive.length}
          </span>
        }
      />
      {!eingeklappt && (
        <Flaeche>
          <BasisListe aufgaben={aktive} mitProjekt={ebenen.projekte} fluchten />
          <DichteZeilen>
            <Zeile titel={tx("Alle Basis-Aufgaben")} nach="/basis" className="text-leise" />
          </DichteZeilen>
        </Flaeche>
      )}
    </section>
  );
}

export function BasisFormular({
  aufgabe,
  projektVorgabe = null,
  onFertig,
}: {
  aufgabe: BasisAufgabe | null;
  projektVorgabe?: number | null;
  onFertig: () => void;
}) {
  const ebenen = useEbenen();
  const queryClient = useQueryClient();
  const { data: ziele } = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele });
  const { data: vorlagen = [] } = useQuery({ queryKey: SCHLUESSEL.vorlagen, queryFn: api.vorlagen });
  const [name, setName] = useState(aufgabe?.name ?? '');
  const [icon, setIcon] = useState<IconName>((aufgabe?.icon as IconName | undefined) ?? 'sparkles');
  const [projektId, setProjektId] = useState<number | null>(aufgabe?.projektId ?? projektVorgabe);
  const [vorlageId, setVorlageId] = useState<number | null>(aufgabe?.vorlageId ?? null);
  const [dauerText, setDauerText] = useState(aufgabe?.stunden == null ? '' : String(aufgabe.stunden));
  const [nameFehler, setNameFehler] = useState<string | null>(null);
  const [taetigkeitFehler, setTaetigkeitFehler] = useState<string | null>(null);
  const [dauerErzwungen, setDauerErzwungen] = useState(false);
  const dauer = dauerTextZuZahl(dauerText);
  const stunden = dauer.stunden;
  const wirksameProjektId = ebenen.projekte ? projektId : null;
  const vorlagePasst = vorlagen.some(
    (vorlage) => vorlage.id === vorlageId && taetigkeitPasst(vorlage.projektId, wirksameProjektId),
  );
  const wirksameVorlageId = vorlagePasst ? vorlageId : null;
  const projekte = ziele?.projekte.filter((projekt) => projekt.aktiv || projekt.id === projektId) ?? [];

  const speichern = useMutation({
    mutationFn: () => {
      if (wirksameProjektId === null && wirksameVorlageId === null) {
        throw new Error(tx("Wähle eine Tätigkeit."));
      }
      if (!aufgabe) {
        return api.erstelleBasisAufgabe({ name, icon, projektId: wirksameProjektId, vorlageId: wirksameVorlageId, stunden });
      }
      return api.aendereBasisAufgabe(aufgabe.id, {
        name,
        icon,
        vorlageId: wirksameVorlageId,
        stunden,
        ...(ebenen.projekte ? { projektId: wirksameProjektId } : {}),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onFertig();
    },
  });

  const absenden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    const nameLeer = name.trim() === '';
    const ohneZuordnung = wirksameProjektId === null && wirksameVorlageId === null;
    setNameFehler(nameLeer ? 'Der Name darf nicht leer sein.' : null);
    setTaetigkeitFehler(ohneZuordnung ? 'Wähle eine Tätigkeit.' : null);
    setDauerErzwungen(dauer.unfertig);
    if (nameLeer || ohneZuordnung || dauer.fehler !== null || dauer.unfertig || speichern.isPending) {
      if (!nameLeer && (dauer.fehler !== null || dauer.unfertig)) {
        ereignis.currentTarget.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      }
      return;
    }
    speichern.mutate();
  };
  const zuordnungHinweis = fehlendeZuordnung({ ebene: 'vorhaben', ebenen, projektId: wirksameProjektId });

  return (
    <Formular onAbsenden={absenden}>
      <Feld label={tx("Name")} fehler={nameFehler}>
        <input
          className={EINGABE_STIL}
          value={name}
          maxLength={GRENZEN.nameMax}
          onChange={(ereignis) => {
            setName(ereignis.target.value);
            setNameFehler(null);
          }}
          autoFocus
        />
      </Feld>
      <Feld label={tx("Symbol")}>
        <IconAuswahl wert={icon} farbe="var(--akzent)" onAendern={setIcon} />
      </Feld>
      {ebenen.projekte && (
        <Feld label={<ZielMarke ebene="projekte" />}>
            <HierarchieWahl
              label={tx("Projekt")}
              wert={projektId === null ? '' : String(projektId)}
              knoten={wahlBaum(
                gliedereProjekte(
                  projekte,
                  (ziele?.visionen ?? []).filter((vision) => !vision.archiviert),
                  (ziele?.organisationen ?? []).filter((organisation) => !organisation.archiviert),
                ),
                { leer: tx("Keins"), ohneVision: tx("Ohne {name}", { name: tx("Vision") }) },
              )}
              onAendern={(roh) => {
                const naechstes = roh === '' ? null : Number(roh);
                setProjektId(naechstes);
                const ziel = ebenen.projekte ? naechstes : null;
                setVorlageId((aktuell) => {
                  if (aktuell === null) {
                    return null;
                  }
                  const gewaehlt = vorlagen.find((vorlage) => vorlage.id === aktuell);
                  return gewaehlt && taetigkeitPasst(gewaehlt.projektId, ziel) ? aktuell : null;
                });
              }}
            />
            {zuordnungHinweis && <p className="text-xs text-leise">{zuordnungHinweis}</p>}
          </Feld>
      )}
      <Feld label={tx("Tätigkeit")} fehler={taetigkeitFehler}>
          <select
            className={EINGABE_STIL}
            value={wirksameVorlageId ?? ''}
            onChange={(ereignis) => {
              setTaetigkeitFehler(null);
              setVorlageId(ereignis.target.value ? Number(ereignis.target.value) : null);
            }}
          >
            {wirksameProjektId !== null ? (
              <option value="">{tx("Standard des Projekts")}</option>
            ) : (
              <option value="" disabled>
                {tx("Tätigkeit wählen …")}
              </option>
            )}
            {taetigkeitenFuerProjekt(vorlagen, wirksameProjektId, wirksameVorlageId).map((vorlage) => (
              <option key={vorlage.id} value={vorlage.id}>
                {vorlage.name}
              </option>
            ))}
          </select>
        </Feld>
      <VorschlagFeld
        label="Dauer"
        text={dauerText}
        onText={(wert) => {
          setDauerErzwungen(false);
          setDauerText(wert);
        }}
        eigenLabel="Eigene"
        einheit={tx('Std')}
        eingabeModus="decimal"
        optionen={[
          { id: 'keine', wert: '', zeile: tx('Keine Angabe'), name: tx('Keine Angabe') },
          ...DAUER_OPTIONEN.map((option) => ({
            id: String(option.stunden),
            wert: String(option.stunden),
            zeile: tx(option.label),
            name: tx(option.label),
          })),
        ]}
        fehler={dauer.fehler ?? (dauerErzwungen && dauer.unfertig ? txMenge(GRENZEN.stundenMin, 'Die Dauer muss mindestens {min} Stunden sein.', { min: String(GRENZEN.stundenMin) }) : null)}
        bereinige={bereinigeDauer}
      />
      <Fehlermeldung fehler={speichern.error} />
      <Knopf
        type="submit"
        variante="primaer"
        className="w-full"
        aria-busy={speichern.isPending || undefined}
      >
        {tx("Speichern")}
      </Knopf>
    </Formular>
  );
}
