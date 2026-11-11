import { tx } from '../../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import type { Vorlage, VorlageAbzug, VorlageGewicht } from '../../../../shared/api/index.ts';
import { anteileInProzent } from '../../../../shared/spiel/anteile.ts';
import { ATTRIBUT_TYP_INFO, ATTRIBUT_TYPEN, GRENZEN, type IconName } from '../../../../shared/spiel/begriffe.ts';
import { istTypAktiv } from '../../../../shared/spiel/funktionen.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useFunktionen } from '../../funktionen.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { SchnellMenueKnopf } from '../../components/SchnellAktion.tsx';
import { IconAuswahl } from '../../components/IconAuswahl.tsx';
import { AnteilReglerStil, EINGABE_STIL, Feld, Fehlermeldung, Formular, Knopf, Segmentauswahl } from '../../ui/index.ts';
import { AnteilGruppe } from './TaetigkeitAnteile.tsx';

const GEWICHT_SCHRITT = 10;
const SUMME_ZU_VIEL = 'Zusammen höchstens 100 %.';
const SUMME_OHNE_PLUS = 'Mindestens ein Attribut mit Plus.';
const SUMME_ZU_VIELE = 'Höchstens {max} Attribute pro Tätigkeit.';
const WIRKUNG_HINWEIS =
  'Ein Plus ist dieser Anteil der Eintrags-XP, ein Minus zieht diesen Anteil der Grund-XP ab, und der Rest geht an kein Attribut.';

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
  const summeRef = useRef<HTMLParagraphElement>(null);
  const dirtyRef = useRef(false);
  const normiert = useRef(vorlage === null || vorlage.festeAnteile);
  const { data: attribute = [] } = useQuery({ queryKey: SCHLUESSEL.attribute, queryFn: api.attribute });
  const [name, setName] = useState(vorlage?.name ?? '');
  const [nameFehler, setNameFehler] = useState<string | null>(null);
  const [summeFehler, setSummeFehler] = useState<string | null>(null);
  const [fokus, setFokus] = useState(0);
  const [icon, setIcon] = useState<IconName>((vorlage?.icon as IconName | undefined) ?? 'sparkles');
  const [dirty, setDirty] = useState(false);
  const [werte, setWerte] = useState<Map<number, number>>(() => {
    const map = new Map<number, number>();
    if (vorlage?.festeAnteile) {
      for (const gewicht of vorlage.gewichte) {
        map.set(gewicht.attributId, gewicht.gewicht);
      }
      for (const abzug of vorlage.abzuege) {
        map.set(abzug.attributId, -abzug.prozent);
      }
    }
    return map;
  });
  const [bereit, setBereit] = useState(vorlage === null || vorlage.festeAnteile);
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
  const festModus = vorlage === null || vorlage.festeAnteile || dirty;

  useEffect(() => {
    if (normiert.current || dirtyRef.current || vorlage === null || vorlage.festeAnteile || attribute.length === 0) {
      return;
    }
    const ids = new Set(aktive.map((attribut) => attribut.id));
    const gewaehlt = vorlage.gewichte.filter((gewicht) => gewicht.gewicht > 0 && ids.has(gewicht.attributId));
    const prozente = anteileInProzent(gewaehlt.map((gewicht) => gewicht.gewicht));
    const naechste = new Map<number, number>();
    gewaehlt.forEach((gewicht, index) => naechste.set(gewicht.attributId, prozente[index] ?? 0));
    normiert.current = true;
    setWerte(naechste);
    setBereit(true);
  }, [aktive, attribute.length, vorlage]);

  useEffect(() => {
    if (fokus === 0) {
      return;
    }
    const id = requestAnimationFrame(() => summeRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [fokus]);

  const summeVon = (positiv: boolean) => {
    let summe = 0;
    for (const [id, wert] of werte) {
      if (!aktive.some((attribut) => attribut.id === id)) {
        continue;
      }
      if (positiv && wert > 0) {
        summe += wert;
      }
      if (!positiv && wert < 0) {
        summe += Math.abs(wert);
      }
    }
    return summe;
  };
  const plusSumme = summeVon(true);
  const abzugSumme = summeVon(false);
  const rest = Math.max(0, 100 - plusSumme);
  const anzahl = [...werte].filter(([id, wert]) => wert !== 0 && aktive.some((attribut) => attribut.id === id)).length;
  const hatPlus = festModus ? plusSumme > 0 : (vorlage?.gewichte.some((gewicht) => gewicht.gewicht > 0) ?? false);
  const liveFehler = summeFehler ?? (festModus && plusSumme > 100 ? SUMME_ZU_VIEL : null);

  const speichern = useMutation({
    mutationFn: () => {
      const bindung = segmentSichtbar
        ? { projektId: giltFuer === 'nur' ? bindungsId : null }
        : !vorlage && projektId !== null
          ? { projektId }
          : {};
      const plus: VorlageGewicht[] = [];
      const abzuege: VorlageAbzug[] = [];
      for (const [attributId, wert] of werte) {
        if (!aktive.some((attribut) => attribut.id === attributId) || wert === 0) {
          continue;
        }
        if (wert > 0) {
          plus.push({ attributId, gewicht: wert });
        } else {
          abzuege.push({ attributId, prozent: Math.abs(wert) });
        }
      }
      const daten = festModus
        ? { name, icon, gewichte: plus, abzuege, festeAnteile: true as const, ...bindung }
        : { name, icon, gewichte: vorlage?.gewichte ?? plus, ...bindung };
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

  const setzeWert = (attributId: number, roh: number) => {
    const verlassen = vorlage !== null && !vorlage.festeAnteile && !dirtyRef.current;
    const gerastet = verlassen ? Math.round(roh / GEWICHT_SCHRITT) * GEWICHT_SCHRITT : roh;
    const wert = Math.max(-100, Math.min(100, gerastet));
    if (verlassen) {
      dirtyRef.current = true;
      setDirty(true);
    }
    setSummeFehler(null);
    setWerte((aktuell) => new Map(aktuell).set(attributId, wert));
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
    const zuViel = festModus && plusSumme > 100;
    const zuViele = festModus && anzahl > GRENZEN.vorlageAttributeMax;
    setNameFehler(nameLeer ? 'Der Name darf nicht leer sein.' : null);
    if (nameLeer || zuViel || zuViele || !hatPlus || speichern.isPending) {
      if (!nameLeer && (zuViel || zuViele || !hatPlus)) {
        setSummeFehler(zuViele ? SUMME_ZU_VIELE : zuViel ? SUMME_ZU_VIEL : SUMME_OHNE_PLUS);
        setFokus((stand) => stand + 1);
      }
      return;
    }
    setSummeFehler(null);
    speichern.mutate();
  };

  const summenSatz = tx('Plus {plus} % · Abzug {abzug} % · Rest {rest} % ohne Attribut', {
    plus: plusSumme,
    abzug: abzugSumme,
    rest,
  });

  return (
    <Formular onAbsenden={absenden}>
      <AnteilReglerStil />
      <Feld label={tx('Name')} fehler={nameFehler}>
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
        <div>
          <p className="text-sm font-semibold">{tx('Wirkung auf Attribute')}</p>
          <p className="mt-1 text-xs leading-4 text-leise">{tx(WIRKUNG_HINWEIS)}</p>
        </div>
        {bereit
          ? typen.map((typ) => (
              <AnteilGruppe
                key={typ}
                titel={tx(ATTRIBUT_TYP_INFO[typ].mehrzahl)}
                attribute={aktive.filter((attribut) => attribut.typ === typ)}
                werte={werte}
                schritt={festModus ? GEWICHT_SCHRITT : 1}
                onAendern={setzeWert}
              />
            ))
          : null}
      </div>

      <WirkungsFuss
        summeRef={summeRef}
        satz={summenSatz}
        fehler={liveFehler}
        serverFehler={speichern.error}
        wartend={speichern.isPending}
      />
    </Formular>
  );
}

function WirkungsFuss({
  summeRef,
  satz,
  fehler,
  serverFehler,
  wartend,
}: {
  summeRef: RefObject<HTMLParagraphElement | null>;
  satz: string;
  fehler: string | null;
  serverFehler: unknown;
  wartend: boolean;
}) {
  return (
    <>
      <Fehlermeldung fehler={serverFehler} />
      <p ref={summeRef} tabIndex={-1} data-summe="" aria-live="polite" className="text-sm outline-none">
        <span className="text-leise">{satz}</span>
        {fehler ? (
          <span className="mt-1 block text-gefahr">
            <span aria-hidden="true">⚠ </span>
            {fehler === SUMME_ZU_VIELE ? tx(fehler, { max: GRENZEN.vorlageAttributeMax }) : tx(fehler)}
          </span>
        ) : null}
      </p>
      <Knopf type="submit" variante="primaer" className="w-full" aria-busy={wartend || undefined}>
        {tx('Speichern')}
      </Knopf>
    </>
  );
}

(WirkungsFuss as typeof WirkungsFuss & { fuss: boolean }).fuss = true;

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
