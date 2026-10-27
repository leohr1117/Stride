import { attributName, tx } from '../../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { Attribut, Vorlage, VorlageGewicht } from '../../../../shared/api/index.ts';
import { ATTRIBUT_TYP_INFO, ATTRIBUT_TYPEN, GRENZEN, type IconName } from '../../../../shared/spiel/begriffe.ts';
import { istTypAktiv } from '../../../../shared/spiel/funktionen.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { prozentPunkte } from '../../format.ts';
import { useFunktionen } from '../../funktionen.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { SchnellNebenaktion } from '../../components/SchnellAktion.tsx';
import { Icon } from '../../components/Icons.tsx';
import { IconAuswahl } from '../../components/IconAuswahl.tsx';
import { EINGABE_STIL, Feld, Fehlermeldung, Formular, Knopf, Regler } from '../../ui/index.ts';

const GEWICHT_SCHRITT = 10;

function prozente(gewichte: Map<number, number>): Map<number, number> {
  let summe = 0;
  for (const wert of gewichte.values()) {
    summe += wert;
  }
  const ergebnis = new Map<number, number>();
  for (const [id, wert] of gewichte) {
    ergebnis.set(id, summe === 0 ? 0 : Math.round((wert / summe) * 100));
  }
  return ergebnis;
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
  const { data: attribute = [] } = useQuery({ queryKey: SCHLUESSEL.attribute, queryFn: api.attribute });
  const [name, setName] = useState(vorlage?.name ?? '');
  const [icon, setIcon] = useState<IconName>((vorlage?.icon as IconName | undefined) ?? 'sparkles');
  const [gewichte, setGewichte] = useState<Map<number, number>>(
    () => new Map((vorlage?.gewichte ?? []).map((gewicht) => [gewicht.attributId, gewicht.gewicht])),
  );

  const funktionen = useFunktionen();
  const aktive = attribute.filter((attribut) => !attribut.archiviert && istTypAktiv(funktionen, attribut.typ));
  const typen = ATTRIBUT_TYPEN.filter((typ) => istTypAktiv(funktionen, typ));
  const gewaehlt: VorlageGewicht[] = [...gewichte]
    .filter(([attributId, gewicht]) => gewicht > 0 && aktive.some((attribut) => attribut.id === attributId))
    .map(([attributId, gewicht]) => ({ attributId, gewicht }));
  const anteile = prozente(new Map(gewaehlt.map((gewicht) => [gewicht.attributId, gewicht.gewicht])));
  const zuViele = gewaehlt.length > GRENZEN.vorlageAttributeMax;

  const speichern = useMutation({
    mutationFn: () => {
      const daten = {
        name,
        icon,
        gewichte: gewaehlt,
        ...(!vorlage && projektId !== null ? { projektId } : {}),
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
    setGewichte((aktuell) => new Map(aktuell).set(attributId, wert));
  };

  const absenden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    speichern.mutate();
  };

  return (
    <Formular onAbsenden={absenden}>
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
      {!vorlage && projektName ? (
        <Feld label={tx("Projekt")}>
          <p className="text-sm">{projektName}</p>
        </Feld>
      ) : null}

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

      {zuViele && (
        <p className="text-sm text-gefahr break-words">
          {tx('Höchstens {max} Attribute pro Tätigkeit.', { max: GRENZEN.vorlageAttributeMax })}
        </p>
      )}
      <Fehlermeldung fehler={speichern.error} />
      <div className="flex gap-2">
        {vorlage ? (
          <SchnellNebenaktion
            ziel={{ art: 'vorlage', id: vorlage.id, name: vorlage.name, archiviert: vorlage.archiviert, loeschbar: vorlage.loeschbar }}
            onErledigt={() => onFertig(vorlage)}
          />
        ) : null}
        <Knopf
          type="submit"
          variante="primaer"
          className="flex-1"
          disabled={!name.trim() || gewaehlt.length === 0 || zuViele || speichern.isPending}
        >
          {tx("Speichern")}
        </Knopf>
      </div>
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
    <Feld label={tx('Stärkt: {name}', { name: titel })}>
      <div className="space-y-2.5">
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
    </Feld>
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
    <Dialog offen={offen} titel={tx("Neue Tätigkeit")} onSchliessen={onSchliessen}>
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


