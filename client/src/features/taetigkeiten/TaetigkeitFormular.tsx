import { attributName, tx } from '../../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import type { Attribut, Vorlage, VorlageGewicht } from '../../../../shared/api/index.ts';
import { anteileInProzent } from '../../../../shared/spiel/anteile.ts';
import { ATTRIBUT_TYP_INFO, ATTRIBUT_TYPEN, GRENZEN, type IconName } from '../../../../shared/spiel/begriffe.ts';
import { istTypAktiv } from '../../../../shared/spiel/funktionen.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { prozentPunkte } from '../../format.ts';
import { useFunktionen } from '../../funktionen.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { SchnellMenueKnopf } from '../../components/SchnellAktion.tsx';
import { Icon } from '../../components/Icons.tsx';
import { IconAuswahl } from '../../components/IconAuswahl.tsx';
import { EINGABE_STIL, Feld, Fehlermeldung, Formular, Knopf, Regler, Segmentauswahl } from '../../ui/index.ts';

const GEWICHT_SCHRITT = 10;

type GiltFuer = 'alle' | 'nur';

export function TaetigkeitMenue({ vorlage, onErledigt }: { vorlage: Vorlage; onErledigt: () => void }) {
  return (
    <SchnellMenueKnopf
      ziel={{ art: 'vorlage', id: vorlage.id, name: vorlage.name, archiviert: vorlage.archiviert, loeschbar: vorlage.loeschbar }}
      onErledigt={onErledigt}
    />
  );
}

export function TaetigkeitFormular({
  vorlage,
  projektId = null,
  projektName = null,
  onFertig,
}: {
  vorlage: Vorlage | null;
  projektId?: number | null;
  projektName?: string | null;
  onFertig: (gespeichert: Vorlage) => void;
}) {
  const queryClient = useQueryClient();
  const giltRef = useRef<HTMLInputElement>(null);
  const { data: attribute = [] } = useQuery({ queryKey: SCHLUESSEL.attribute, queryFn: api.attribute });
  const [name, setName] = useState(vorlage?.name ?? '');
  const [nameFehler, setNameFehler] = useState<string | null>(null);
  const [attributFehler, setAttributFehler] = useState(false);
  const [icon, setIcon] = useState<IconName>((vorlage?.icon as IconName | undefined) ?? 'sparkles');
  const [gewichte, setGewichte] = useState<Map<number, number>>(
    () => new Map((vorlage?.gewichte ?? []).map((gewicht) => [gewicht.attributId, gewicht.gewicht])),
  );
  const bindungsId = vorlage?.projektId ?? projektId;
  const bindungsName = (vorlage?.projektId != null ? vorlage.projektName : projektName) ?? projektName;
  const segmentSichtbar = bindungsId !== null && Boolean(bindungsName);
  const [giltFuer, setGiltFuer] = useState<GiltFuer>(() => {
    if (vorlage) {
      return vorlage.projektId != null ? 'nur' : 'alle';
    }
    return projektId !== null ? 'nur' : 'alle';
  });

  const funktionen = useFunktionen();
  const aktive = attribute.filter((attribut) => !attribut.archiviert && istTypAktiv(funktionen, attribut.typ));
  const typen = ATTRIBUT_TYPEN.filter((typ) => istTypAktiv(funktionen, typ));
  const gewaehlt: VorlageGewicht[] = [...gewichte]
    .filter(([attributId, gewicht]) => gewicht > 0 && aktive.some((attribut) => attribut.id === attributId))
    .map(([attributId, gewicht]) => ({ attributId, gewicht }));
  const prozentWerte = anteileInProzent(gewaehlt.map((gewicht) => gewicht.gewicht));
  const anteile = new Map(gewaehlt.map((gewicht, index) => [gewicht.attributId, prozentWerte[index] ?? 0]));
  const zuViele = gewaehlt.length > GRENZEN.vorlageAttributeMax;

  const speichern = useMutation({
    mutationFn: () => {
      const bindung = segmentSichtbar
        ? { projektId: giltFuer === 'nur' ? bindungsId : null }
        : !vorlage && projektId !== null
          ? { projektId }
          : {};
      const daten = {
        name,
        icon,
        gewichte: gewaehlt,
        ...bindung,
      };
      if (!vorlage) {
        return api.erstelleVorlage(daten);
      }
      return api.aendereVorlage(vorlage.id, daten);
    },
    onSuccess: (gespeichert) => {
      void queryClient.invalidateQueries();
      onFertig(gespeichert);
    },
  });

  const setzeGewicht = (attributId: number, wert: number) => {
    setAttributFehler(false);
    setGewichte((aktuell) => new Map(aktuell).set(attributId, wert));
  };

  const setzeGiltFuer = (wert: GiltFuer) => {
    if (giltRef.current) {
      giltRef.current.value = wert;
    }
    giltRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
    setGiltFuer(wert);
  };

  const absenden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    const nameLeer = name.trim() === '';
    const ohneAttribut = gewaehlt.length === 0;
    setNameFehler(nameLeer ? 'Der Name darf nicht leer sein.' : null);
    setAttributFehler(ohneAttribut);
    if (nameLeer || ohneAttribut || zuViele || speichern.isPending) {
      return;
    }
    speichern.mutate();
  };

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
      <IconAuswahl wert={icon} farbe="var(--akzent)" onAendern={setIcon} />
      {segmentSichtbar && bindungsName ? (
        <Feld label="Gilt für">
          <div className="relative">
            <input
              ref={giltRef}
              readOnly
              tabIndex={-1}
              aria-hidden="true"
              value={giltFuer}
              className="pointer-events-none absolute h-px w-px opacity-0"
              onChange={() => undefined}
            />
            <Segmentauswahl<GiltFuer>
              optionen={[
                { wert: 'alle', label: <span>{tx('Alle Projekte')}</span> },
                { wert: 'nur', label: <span>{tx('Nur {name}', { name: bindungsName })}</span> },
              ]}
              wert={giltFuer}
              onAendern={setzeGiltFuer}
            />
          </div>
        </Feld>
      ) : null}

      <div className="space-y-4">
        <p className="text-sm font-semibold">{tx('Stärkt')}</p>
        {typen.map((typ) => (
          <GewichtGruppe
            key={typ}
            titel={tx(ATTRIBUT_TYP_INFO[typ].mehrzahl)}
            attribute={aktive.filter((attribut) => attribut.typ === typ)}
            gewichte={gewichte}
            anteile={anteile}
            onAendern={setzeGewicht}
          />
        ))}
      </div>

      {zuViele || attributFehler ? (
        <p className="feld-fehler text-[13px] leading-[18px] break-words text-gefahr" role="alert">
          <span aria-hidden="true">⚠ </span>
          {tx(zuViele ? 'Höchstens {max} Attribute pro Tätigkeit.' : 'Eine Tätigkeit braucht mindestens ein Attribut.', { max: GRENZEN.vorlageAttributeMax })}
        </p>
      ) : null}
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

function GewichtGruppe({
  titel,
  attribute,
  gewichte,
  anteile,
  onAendern,
}: {
  titel: string;
  attribute: Attribut[];
  gewichte: Map<number, number>;
  anteile: Map<number, number>;
  onAendern: (attributId: number, wert: number) => void;
}) {
  if (attribute.length === 0) {
    return null;
  }
  return (
    <div className="space-y-2.5">
      <p className="text-sm text-leise">{titel}</p>
      {attribute.map((attribut) => {
        const wert = gewichte.get(attribut.id) ?? 0;
        return (
          <div key={attribut.id} className="flex items-center gap-3">
            <Icon name={attribut.icon} className="size-4 shrink-0" style={{ color: attribut.farbe }} />
            <span className="min-w-0 flex-1 text-sm break-words">{attributName(attribut)}</span>
            <Regler
              min={0}
              max={GRENZEN.vorlageGewichtMax}
              step={GEWICHT_SCHRITT}
              value={wert}
              onChange={(ereignis) => onAendern(attribut.id, Number(ereignis.target.value))}
              className="w-28 shrink-0"
              style={{ accentColor: attribut.farbe }}
              aria-label={tx('Gewicht {name}', { name: attributName(attribut) })}
            />
            <span className="zahl w-12 shrink-0 text-right text-xs text-leise">
              {wert > 0 ? prozentPunkte(anteile.get(attribut.id) ?? 0) : '–'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function NeueTaetigkeit({
  offen,
  projektId = null,
  projektName = null,
  onSchliessen,
  onAngelegt,
}: {
  offen: boolean;
  projektId?: number | null;
  projektName?: string | null;
  onSchliessen: () => void;
  onAngelegt?: (vorlage: Vorlage) => void;
}) {
  return (
    <Dialog offen={offen} titel={tx('Tätigkeit anlegen')} onSchliessen={onSchliessen}>
      {offen && (
        <TaetigkeitFormular
          vorlage={null}
          projektId={projektId}
          projektName={projektName}
          onFertig={(gespeichert) => {
            onAngelegt?.(gespeichert);
            onSchliessen();
          }}
        />
      )}
    </Dialog>
  );
}
