import { tx } from '../../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { BasisAufgabe } from '../../../../shared/api/index.ts';
import { DAUER_OPTIONEN, GRENZEN, type IconName } from '../../../../shared/spiel/begriffe.ts';
import { fehlendeZuordnung } from '../../../../shared/spiel/ebenen.ts';
import { taetigkeitPasst, taetigkeitenFuerProjekt } from '../../../../shared/spiel/taetigkeit.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { dauerText } from '../../format.ts';
import { useEbenen } from '../../funktionen.ts';
import { leseMerker, merke } from '../../speicher.ts';
import { EinklappKopf } from '../../components/Ausklappbar.tsx';
import { SchnellNebenaktion, SchnellZeile } from '../../components/SchnellAktion.tsx';
import { useFeiern } from '../../components/Belohnung.tsx';
import { Icon } from '../../components/Icons.tsx';
import { IconAuswahl } from '../../components/IconAuswahl.tsx';
import { Chip, EINGABE_STIL, Feld, Fehlermeldung, Karte, Knopf } from '../../ui/index.ts';
import { ZielMarke } from '../../components/ZielMarke.tsx';

export function useBasisAufgaben() {
  return useQuery({ queryKey: SCHLUESSEL.basis, queryFn: api.basis });
}

function useBasisAktionen() {
  const queryClient = useQueryClient();
  const feiern = useFeiern();
  const erledigen = useMutation({
    mutationFn: (id: number) => api.erledigeBasisAufgabe(id),
    onSuccess: (ergebnis) => {
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
}: {
  aufgaben: BasisAufgabe[];
  mitProjekt: boolean;
  onBearbeiten?: (aufgabe: BasisAufgabe) => void;
}) {
  const aktionen = useBasisAktionen();
  return (
    <>
      <ul className="space-y-1">
        {aufgaben.map((aufgabe) => (
          <BasisZeile
            key={aufgabe.id}
            aufgabe={aufgabe}
            mitProjekt={mitProjekt}
            laeuft={aktionen.laeuft}
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
  onErledigen,
  onRueckgaengig,
  onBearbeiten,
}: {
  aufgabe: BasisAufgabe;
  mitProjekt: boolean;
  laeuft: boolean;
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

  return (
    <li>
      <SchnellZeile
        className="rounded-xl"
        ziel={{ art: 'basis', id: aufgabe.id, name: aufgabe.name, archiviert: aufgabe.archiviert, loeschbar: aufgabe.loeschbar }}
      >
        {(menue) => (
    <div className="flex items-center gap-1 px-1 py-0.5">
      <Icon name={aufgabe.icon} className="size-4 shrink-0" style={{ color: aufgabe.farbe }} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${heuteEintragId !== null ? 'text-leise' : 'font-medium'}`}>{aufgabe.name}</p>
        {details && <p className="truncate text-xs text-leise">{details}</p>}
      </div>
      {menue}
      {onBearbeiten && (
        <Knopf variante="leise" className="p-2" aria-label={tx('{name} bearbeiten', { name: aufgabe.name })} onClick={onBearbeiten}>
          <Pencil className="size-4" />
        </Knopf>
      )}
      {heuteEintragId !== null ? (
        <button
          type="button"
          onClick={() => onRueckgaengig(heuteEintragId)}
          disabled={laeuft}
          title={tx("Rückgängig")}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-xp/20 text-xp transition active:scale-90"
        >
          <Check className="size-4" strokeWidth={3} />
        </button>
      ) : (
        <button
          type="button"
          onClick={onErledigen}
          disabled={laeuft}
          title={tx("Erledigt")}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-akzent text-akzent-text transition active:scale-90"
        >
          <Check className="size-4" strokeWidth={3} />
        </button>
      )}
    </div>
        )}
      </SchnellZeile>
    </li>
  );
}

const EINGEKLAPPT_SCHLUESSEL = 'ascend.basisEingeklappt';

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
    <Karte>
      <EinklappKopf
        titel={tx("Basis")}
        offen={!eingeklappt}
        onToggle={umschalten}
        zusatz={
          <span className="zahl text-xs text-leise">
            {erledigt}/{aktive.length}
          </span>
        }
      />
      {!eingeklappt && (
        <div className="mt-3">
          <BasisListe aufgaben={aktive} mitProjekt={ebenen.projekte} />
        </div>
      )}
    </Karte>
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
  const [stunden, setStunden] = useState<number | null>(aufgabe?.stunden ?? null);
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
    speichern.mutate();
  };
  const zuordnungHinweis = fehlendeZuordnung({ ebene: 'vorhaben', ebenen, projektId: wirksameProjektId });

  return (
    <form onSubmit={absenden} className="space-y-4">
      <Feld label={tx("Name")}>
        <input
          className={EINGABE_STIL}
          value={name}
          maxLength={GRENZEN.nameMax}
          onChange={(ereignis) => setName(ereignis.target.value)}
          autoFocus
        />
      </Feld>
      <Feld label={tx("Symbol")}>
        <IconAuswahl wert={icon} farbe="var(--akzent)" onAendern={setIcon} />
      </Feld>
      <div className={ebenen.projekte ? 'grid grid-cols-2 gap-3' : ''}>
        {ebenen.projekte && (
          <Feld label={<ZielMarke ebene="projekte" />}>
            <select
              className={EINGABE_STIL}
              value={projektId ?? ''}
              onChange={(ereignis) => {
                const naechstes = ereignis.target.value ? Number(ereignis.target.value) : null;
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
            >
              <option value="">{tx("Keins")}</option>
              {projekte.map((projekt) => (
                <option key={projekt.id} value={projekt.id}>
                  {projekt.name}
                </option>
              ))}
            </select>
            {zuordnungHinweis && <p className="text-xs text-leise">{zuordnungHinweis}</p>}
          </Feld>
        )}
        <Feld label={tx("Tätigkeit")}>
          <select
            className={EINGABE_STIL}
            value={wirksameVorlageId ?? ''}
            onChange={(ereignis) => setVorlageId(ereignis.target.value ? Number(ereignis.target.value) : null)}
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
      </div>
      <Feld label={tx("Dauer")}>
        <div className="chip-reihe -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <Chip aktiv={stunden === null} onClick={() => setStunden(null)}>
            {tx("Keine Angabe")}
          </Chip>
          {DAUER_OPTIONEN.map((option) => (
            <Chip key={option.stunden} aktiv={stunden === option.stunden} onClick={() => setStunden(option.stunden)}>
              {tx(option.label)}
            </Chip>
          ))}
        </div>
      </Feld>
      <Fehlermeldung fehler={speichern.error} />
      <div className="flex gap-2">
        {aufgabe ? (
          <SchnellNebenaktion
            ziel={{ art: 'basis', id: aufgabe.id, name: aufgabe.name, archiviert: aufgabe.archiviert, loeschbar: aufgabe.loeschbar }}
            onErledigt={onFertig}
          />
        ) : null}
        <Knopf
          type="submit"
          variante="primaer"
          className="flex-1"
          disabled={!name.trim() || (wirksameProjektId === null && wirksameVorlageId === null) || speichern.isPending}
        >
          {tx("Speichern")}
        </Knopf>
      </div>
    </form>
  );
}
