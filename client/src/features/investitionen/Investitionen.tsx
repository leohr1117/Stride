import { tx } from '../../text.ts';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Attribut, Investition, InvestitionAenderung, InvestitionDaten, InvestitionsArt, InvestitionsZiel, Projekt, ProjektAenderung, ProjektDetail, Vision, Ziele } from '../../../../shared/api/index.ts';
import type { Sichtbarkeit } from '../../../../shared/spiel/sichtbarkeit.ts';
import { ICONS, GRENZEN, NEUTRAL_FARBE, type IconName } from '../../../../shared/spiel/begriffe.ts';
import { istTypAktiv } from '../../../../shared/spiel/funktionen.ts';
import { INVESTITION_GROESSEN, INVESTITION_INFO, RESSOURCEN_INFO, RESSOURCEN_SCHALTER, investitionsBonus } from '../../../../shared/spiel/xp.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { bonusProzent } from '../../format.ts';
import { useSichtbarkeit } from '../../funktionen.ts';
import { Abschnitt, KurzListe } from '../../components/Ausklappbar.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { SchnellNebenaktion, SchnellZeile } from '../../components/SchnellAktion.tsx';
import { IconAuswahl } from '../../components/IconAuswahl.tsx';
import { Zeile, ZeileSchalter, ZeilenGruppe } from '../../components/Zeile.tsx';
import { Chip, EINGABE_STIL, Feld, Fehlermeldung, Formular, Karte, Knopf, Regler, Segmentauswahl } from '../../ui/index.ts';

const LISTE_SICHTBAR = 4;

function zielText(ziel: InvestitionsZiel | null, visionen: Vision[], projekte: Projekt[], attribute: Attribut[]): string | null {
  if (!ziel) {
    return null;
  }
  if (ziel.art === 'vision') {
    return visionen.find((vision) => vision.id === ziel.id)?.titel ?? null;
  }
  if (ziel.art === 'projekt') {
    return projekte.find((projekt) => projekt.id === ziel.id)?.name ?? null;
  }
  return attribute.find((attribut) => attribut.id === ziel.id)?.name ?? null;
}

function gueltigesIcon(icon: string): IconName {
  return (ICONS as readonly string[]).includes(icon) ? (icon as IconName) : 'gem';
}

function stufeVon(roh: number): number {
  if (!Number.isFinite(roh)) {
    return 0;
  }
  return Math.min(INVESTITION_GROESSEN.length - 1, Math.max(0, Math.round(roh)));
}

function GroessenRegler({
  wert,
  onAendern,
  className = 'px-4 py-3',
}: {
  wert: number;
  onAendern: (groesse: number) => void;
  className?: string;
}) {
  const [lokal, setLokal] = useState(() => stufeVon(wert));
  const lokalRef = useRef(stufeVon(wert));
  const zieht = useRef(false);
  const onAendernRef = useRef(onAendern);
  const endeRef = useRef<(() => void) | null>(null);
  onAendernRef.current = onAendern;

  useEffect(() => {
    if (zieht.current) {
      return;
    }
    const naechstes = stufeVon(wert);
    lokalRef.current = naechstes;
    setLokal(naechstes);
  }, [wert]);

  useEffect(() => () => endeRef.current?.(), []);

  const setze = (roh: number) => {
    const naechstes = stufeVon(roh);
    lokalRef.current = naechstes;
    setLokal(naechstes);
    return naechstes;
  };

  const uebernehmen = () => {
    if (!zieht.current) {
      return;
    }
    zieht.current = false;
    endeRef.current = null;
    onAendernRef.current(lokalRef.current);
  };

  const beginne = () => {
    endeRef.current?.();
    zieht.current = true;
    const ende = () => {
      window.removeEventListener('pointerup', ende);
      window.removeEventListener('pointercancel', ende);
      uebernehmen();
    };
    endeRef.current = () => {
      window.removeEventListener('pointerup', ende);
      window.removeEventListener('pointercancel', ende);
    };
    window.addEventListener('pointerup', ende);
    window.addEventListener('pointercancel', ende);
  };

  const prozent = bonusProzent(investitionsBonus(lokal));
  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-leise">{tx("Größe")}</span>
        <span className="zahl font-medium">{prozent}</span>
      </div>
      <div className="touch-none">
        <Regler
          min={0}
          max={3}
          step={1}
          value={lokal}
          aria-label={tx("Größe")}
          aria-valuetext={prozent}
          onPointerDown={beginne}
          onChange={(ereignis) => {
            const naechstes = setze(Number(ereignis.target.value));
            if (!zieht.current) {
              onAendernRef.current(naechstes);
            }
          }}
          className="groesse-regler"
        />
        <div className="flex justify-between px-1" aria-hidden="true">
          {INVESTITION_GROESSEN.map((anteil, index) => (
            <span key={anteil} className={`size-1.5 rounded-full ${index <= lokal ? 'bg-akzent' : 'bg-flaeche-2'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function waehlbareAttribute(attribute: Attribut[], funktionen: ReturnType<typeof useSichtbarkeit>['funktionen'], aktuell?: number) {
  return attribute
    .filter((eintrag) => {
      const gewaehlt = eintrag.id === aktuell;
      return gewaehlt || (!eintrag.archiviert && istTypAktiv(funktionen, eintrag.typ));
    })
    .sort((a, b) => {
      if (a.kennung === 'ressourcen') {
        return -1;
      }
      if (b.kennung === 'ressourcen') {
        return 1;
      }
      return a.name.localeCompare(b.name, 'de');
    });
}

function listenFuerZiel(
  ziel: InvestitionsZiel | null,
  sichtbarkeit: Sichtbarkeit,
  visionen: Vision[],
  projekte: Projekt[],
  attribute: Attribut[],
): { visionen: Vision[]; projekte: Projekt[]; attribute: Attribut[] } {
  return {
    visionen: visionen.filter((vision) => {
      const istZiel = ziel?.art === 'vision' && ziel.id === vision.id;
      return istZiel || (sichtbarkeit.ebenen.visionen && !vision.archiviert);
    }),
    projekte: projekte.filter((eintrag) => {
      const istZiel = ziel?.art === 'projekt' && ziel.id === eintrag.id;
      return istZiel || (sichtbarkeit.ebenen.projekte && eintrag.aktiv);
    }),
    attribute: attribute.filter((eintrag) => {
      const istZiel = ziel?.art === 'attribut' && ziel.id === eintrag.id;
      return istZiel || (!eintrag.archiviert && istTypAktiv(sichtbarkeit.funktionen, eintrag.typ));
    }),
  };
}

function gewaehlteArt(
  segment: InvestitionsArt | null,
  ziel: InvestitionsZiel | null,
  optionen: { wert: InvestitionsArt }[],
): InvestitionsArt | null {
  if (segment && optionen.some((option) => option.wert === segment)) {
    return segment;
  }
  if (ziel && optionen.some((option) => option.wert === ziel.art)) {
    return ziel.art;
  }
  return optionen[0]?.wert ?? null;
}

function ZielWahl({
  ziel,
  onWaehlen,
  visionen,
  projekte,
  attribute,
}: {
  ziel: InvestitionsZiel | null;
  onWaehlen: (ziel: InvestitionsZiel | null) => void;
  visionen: Vision[];
  projekte: Projekt[];
  attribute: Attribut[];
}) {
  const [segment, setSegment] = useState<InvestitionsArt | null>(null);
  const optionen = [
    visionen.length > 0 ? { wert: 'vision' as const, label: tx("Vision") } : null,
    projekte.length > 0 ? { wert: 'projekt' as const, label: tx("Projekt") } : null,
    attribute.length > 0 ? { wert: 'attribut' as const, label: tx("Attribut") } : null,
  ].filter((option) => option !== null);
  const art = gewaehlteArt(segment, ziel, optionen);
  const waehle = (naechstes: InvestitionsZiel) => {
    const gleich = ziel?.art === naechstes.art && ziel.id === naechstes.id;
    onWaehlen(gleich ? null : naechstes);
  };

  if (optionen.length === 0 || !art) {
    return null;
  }

  return (
    <div className="space-y-3">
      {optionen.length > 1 ? <Segmentauswahl optionen={optionen} wert={art} onAendern={setSegment} /> : null}
      {art === 'vision' ? (
        <div className="flex flex-wrap gap-2">
          {visionen.map((vision) => (
            <Chip
              key={vision.id}
              aktiv={ziel?.art === 'vision' && ziel.id === vision.id}
              farbe={vision.farbe}
              onClick={() => waehle({ art: 'vision', id: vision.id })}
              className="max-w-full min-w-0 overflow-hidden"
            >
              <span className="truncate">{vision.titel}</span>
            </Chip>
          ))}
        </div>
      ) : null}
      {art === 'projekt' ? (
        <div className="flex flex-wrap gap-2">
          {projekte.map((eintrag) => (
            <Chip
              key={eintrag.id}
              aktiv={ziel?.art === 'projekt' && ziel.id === eintrag.id}
              farbe={eintrag.kontext?.farbe}
              onClick={() => waehle({ art: 'projekt', id: eintrag.id })}
              className="max-w-full min-w-0 overflow-hidden"
            >
              <span className="truncate">{eintrag.name}</span>
            </Chip>
          ))}
        </div>
      ) : null}
      {art === 'attribut' ? (
        <div className="flex flex-wrap gap-2">
          {attribute.map((eintrag) => (
            <Chip
              key={eintrag.id}
              aktiv={ziel?.art === 'attribut' && ziel.id === eintrag.id}
              farbe={eintrag.farbe}
              onClick={() => waehle({ art: 'attribut', id: eintrag.id })}
              className="max-w-full min-w-0 overflow-hidden"
            >
              <span className="truncate">{eintrag.name}</span>
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function wendeProjekt(bisher: Projekt, aenderung: ProjektAenderung, attribute: Attribut[]): Projekt {
  const groesse =
    aenderung.investitionGroesse === undefined
      ? bisher.investitionGroesse
      : Math.min(3, Math.max(0, Math.round(aenderung.investitionGroesse)));
  const ziel = aenderung.investitionZiel !== undefined ? aenderung.investitionZiel : bisher.investitionZiel;
  let ressourcen =
    aenderung.investitionRessourcen !== undefined ? aenderung.investitionRessourcen : bisher.investitionRessourcen;
  const ressourcenAttribut = attribute.find((eintrag) => eintrag.kennung === 'ressourcen' && !eintrag.archiviert);
  if (ziel?.art === 'attribut' && ressourcenAttribut && ziel.id === ressourcenAttribut.id) {
    ressourcen = false;
  }
  let geschafftAm = bisher.geschafftAm;
  if (aenderung.geschafft === true) {
    geschafftAm = bisher.geschafftAm ?? new Date().toISOString();
  } else if (aenderung.geschafft === false) {
    geschafftAm = null;
  }
  return {
    ...bisher,
    investition: aenderung.investition ?? bisher.investition,
    investitionZiel: ziel,
    investitionRessourcen: ressourcen,
    investitionGroesse: groesse,
    investitionBonus: investitionsBonus(groesse),
    geschafftAm,
  };
}

function schreibeProjekt(client: QueryClient, projekt: Projekt): void {
  client.setQueryData<ProjektDetail>(SCHLUESSEL.projekt(projekt.id), (alt) => (alt ? { ...alt, projekt } : alt));
  client.setQueryData<Ziele>(SCHLUESSEL.ziele, (alt) => {
    if (!alt) {
      return alt;
    }
    return {
      ...alt,
      projekte: alt.projekte.map((eintrag) =>
        eintrag.id === projekt.id
          ? {
              ...eintrag,
              investition: projekt.investition,
              investitionZiel: projekt.investitionZiel,
              investitionRessourcen: projekt.investitionRessourcen,
              investitionGroesse: projekt.investitionGroesse,
              investitionBonus: projekt.investitionBonus,
              geschafftAm: projekt.geschafftAm,
            }
          : eintrag,
      ),
    };
  });
}

export function InvestitionenBereich() {
  const sichtbarkeit = useSichtbarkeit();
  const { data: ziele } = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele });
  const { data: attribute = [] } = useQuery({ queryKey: SCHLUESSEL.attribute, queryFn: api.attribute });
  const { data: investitionen = [] } = useQuery({ queryKey: SCHLUESSEL.investitionen, queryFn: api.investitionen });
  const [dialog, setDialog] = useState<Investition | null | 'neu'>(null);
  const projekte = (ziele?.projekte ?? []).filter((projekt) => projekt.investition && !projekt.archiviert);
  const eigene = investitionen.filter((eintrag) => !eintrag.archiviert);
  const visionen = ziele?.visionen ?? [];
  const alleProjekte = ziele?.projekte ?? [];
  const attributeWahl = waehlbareAttribute(attribute, sichtbarkeit.funktionen);

  return (
    <Abschnitt
      titel={tx("Investitionen")}
      kennung="ausruestung"
      info={INVESTITION_INFO}
      aktion={
        <Knopf variante="leise" className="px-2 py-1" onClick={() => setDialog('neu')}>
          <Plus className="size-4" />
          {tx("Neu")}
        </Knopf>
      }
    >
      {projekte.length === 0 && eigene.length === 0 ? (
        <p className="text-sm text-leise">{tx("Noch keine Investitionen.")}</p>
      ) : (
        <Karte dicht>
          <KurzListe
            eintraege={[
              ...projekte.map((projekt) => ({ art: 'projekt' as const, projekt })),
              ...eigene.map((investition) => ({ art: 'eigen' as const, investition })),
            ]}
            anzahl={LISTE_SICHTBAR}
            className="divide-y divide-rand"
            darstellen={(eintrag) => {
              if (eintrag.art === 'projekt') {
                const projekt = eintrag.projekt;
                const name = zielText(projekt.investitionZiel, visionen, alleProjekte, attribute);
                return (
                  <SchnellZeile
                    key={`p-${projekt.id}`}
                    ziel={{ art: 'projekt', id: projekt.id, name: projekt.name, archiviert: projekt.archiviert, loeschbar: projekt.loeschbar }}
                  >
                    {(menue) => (
                      <Zeile
                        nach={`/projekte/${projekt.id}`}
                        name={projekt.name}
                        rechts={menue}
                        titel={
                          <span className="block min-w-0">
                            <span className="block truncate">{projekt.name}</span>
                            {name ? <span className="block truncate text-xs font-normal text-leise">{name}</span> : null}
                          </span>
                        }
                        wert={projekt.geschafftAm && projekt.investitionZiel ? bonusProzent(projekt.investitionBonus) : undefined}
                      />
                    )}
                  </SchnellZeile>
                );
              }
              const investition = eintrag.investition;
              const untertitel = [investition.attributName, investition.zielName].filter((teil) => teil).join(' · ');
              return (
                <SchnellZeile
                  key={`i-${investition.id}`}
                  ziel={{
                    art: 'investition',
                    id: investition.id,
                    name: investition.name,
                    archiviert: investition.archiviert,
                    loeschbar: investition.loeschbar,
                  }}
                >
                  {(menue) => (
                    <Zeile
                      name={investition.name}
                      rechts={menue}
                      onKlick={() => setDialog(investition)}
                      titel={
                        <span className="block min-w-0">
                          <span className="block truncate">{investition.name}</span>
                          {untertitel ? <span className="block truncate text-xs font-normal text-leise">{untertitel}</span> : null}
                        </span>
                      }
                      wert={bonusProzent(investition.bonus)}
                    />
                  )}
                </SchnellZeile>
              );
            }}
          />
        </Karte>
      )}
      <Dialog
        offen={dialog !== null}
        titel={dialog === 'neu' ? tx("Neue Investition") : tx("Investition")}
        onSchliessen={() => setDialog(null)}
      >
        {dialog !== null && (
          <InvestitionFormular
            investition={dialog === 'neu' ? null : dialog}
            attribute={attributeWahl}
            onFertig={() => setDialog(null)}
          />
        )}
      </Dialog>
    </Abschnitt>
  );
}

function InvestitionFormular({
  investition,
  attribute,
  onFertig,
}: {
  investition: Investition | null;
  attribute: Attribut[];
  onFertig: () => void;
}) {
  const queryClient = useQueryClient();
  const ressourcen = attribute.find((eintrag) => eintrag.kennung === 'ressourcen' && !eintrag.archiviert);
  const sichtbarkeit = useSichtbarkeit();
  const { data: ziele } = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele });
  const [name, setName] = useState(investition?.name ?? '');
  const [icon, setIcon] = useState<IconName>(gueltigesIcon(investition?.icon ?? 'gem'));
  const [groesse, setGroesse] = useState(investition?.groesse ?? 1);
  const [attributId, setAttributId] = useState<number | null>(investition?.attributId ?? ressourcen?.id ?? attribute[0]?.id ?? null);
  const [ziel, setZiel] = useState<InvestitionsZiel | null>(investition?.ziel ?? null);
  const [fehler, setFehler] = useState<unknown>(null);
  const listen = listenFuerZiel(ziel, sichtbarkeit, ziele?.visionen ?? [], ziele?.projekte ?? [], attribute);
  const speichern = useMutation({
    mutationFn: async () => {
      if (attributId === null) {
        throw new Error(tx("Wähle ein Attribut."));
      }
      const daten: InvestitionDaten = { name: name.trim(), icon, groesse, attributId, ziel };
      if (investition) {
        const aenderung: InvestitionAenderung = daten;
        return api.aendereInvestition(investition.id, aenderung);
      }
      return api.erstelleInvestition(daten);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onFertig();
    },
    onError: (grund) => setFehler(grund),
  });
  const senden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    speichern.mutate();
  };

  return (
    <Formular onAbsenden={senden}>
      <Feld label={tx("Name")}>
        <input
          className={EINGABE_STIL}
          value={name}
          maxLength={GRENZEN.nameMax}
          onChange={(ereignis) => setName(ereignis.target.value)}
        />
      </Feld>
      <GroessenRegler wert={groesse} onAendern={setGroesse} className="" />
      <div className="space-y-2">
        <span className="text-sm font-medium">{tx("Ziel")}</span>
        <ZielWahl ziel={ziel} onWaehlen={setZiel} visionen={listen.visionen} projekte={listen.projekte} attribute={listen.attribute} />
      </div>
      <Feld label={tx("Attribut")}>
        <div className="flex flex-wrap gap-2">
          {attribute.map((eintrag) => (
            <Chip
              key={eintrag.id}
              aktiv={attributId === eintrag.id}
              farbe={eintrag.farbe}
              onClick={() => setAttributId(eintrag.id)}
              className="max-w-full min-w-0 overflow-hidden"
            >
              <span className="truncate">{eintrag.name}</span>
            </Chip>
          ))}
        </div>
      </Feld>
      <Feld label={tx("Symbol")}>
        <IconAuswahl wert={icon} farbe={NEUTRAL_FARBE} onAendern={setIcon} />
      </Feld>
      <Fehlermeldung fehler={fehler} />
      <div className="flex gap-2">
        {investition ? (
          <SchnellNebenaktion
            ziel={{
              art: 'investition',
              id: investition.id,
              name: investition.name,
              archiviert: investition.archiviert,
              loeschbar: investition.loeschbar,
            }}
            onErledigt={onFertig}
          />
        ) : null}
        <Knopf
          type="submit"
          variante="primaer"
          className="flex-1"
          disabled={!name.trim() || attributId === null || speichern.isPending}
        >
          {tx("Speichern")}
        </Knopf>
      </div>
    </Formular>
  );
}

export function ProjektInvestition({ projekt }: { projekt: Projekt }) {
  const sichtbarkeit = useSichtbarkeit();
  const queryClient = useQueryClient();
  const [offen, setOffen] = useState(false);
  const [fehler, setFehler] = useState<unknown>(null);
  const gewuenscht = useRef<ProjektAenderung | null>(null);
  const unterwegs = useRef(false);
  const { data: ziele } = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele });
  const { data: attribute = [] } = useQuery({ queryKey: SCHLUESSEL.attribute, queryFn: api.attribute });
  const projektId = projekt.id;

  const pumpe = async () => {
    if (unterwegs.current) {
      return;
    }
    unterwegs.current = true;
    try {
      while (gewuenscht.current) {
        const paket = gewuenscht.current;
        gewuenscht.current = null;
        try {
          const antwort = await api.aendereProjekt(projektId, paket);
          if (gewuenscht.current) {
            continue;
          }
          schreibeProjekt(queryClient, antwort);
          setFehler(null);
        } catch (grund) {
          gewuenscht.current = null;
          setFehler(grund);
          void queryClient.invalidateQueries({ queryKey: SCHLUESSEL.projekt(projektId) });
          void queryClient.invalidateQueries({ queryKey: SCHLUESSEL.ziele });
          break;
        }
      }
    } finally {
      unterwegs.current = false;
      if (gewuenscht.current) {
        void pumpe();
      }
    }
  };

  const speichere = (aenderung: ProjektAenderung) => {
    const alt = queryClient.getQueryData<ProjektDetail>(SCHLUESSEL.projekt(projektId));
    if (alt) {
      schreibeProjekt(queryClient, wendeProjekt(alt.projekt, aenderung, attribute));
    }
    gewuenscht.current = gewuenscht.current ? { ...gewuenscht.current, ...aenderung } : { ...aenderung };
    void pumpe();
  };

  const ziel = projekt.investitionZiel;
  const listen = listenFuerZiel(ziel, sichtbarkeit, ziele?.visionen ?? [], ziele?.projekte ?? [], attribute);
  const name = zielText(ziel, listen.visionen, listen.projekte, listen.attribute);
  const ressourcen = attribute.find(
    (eintrag) => eintrag.kennung === 'ressourcen' && !eintrag.archiviert && istTypAktiv(sichtbarkeit.funktionen, eintrag.typ),
  );
  const zielIstRessourcen = ziel?.art === 'attribut' && ressourcen !== undefined && ziel.id === ressourcen.id;
  const status =
    projekt.investition && projekt.geschafftAm !== null
      ? tx('Aktiv · {bonus}', { bonus: bonusProzent(investitionsBonus(projekt.investitionGroesse)) })
      : undefined;

  return (
    <>
      <ZeilenGruppe>
        <Zeile
          id="projekt-investition"
          name="Investition"
          info={INVESTITION_INFO}
          onKlick={() => setOffen(true)}
          wert={status}
          titel={
            <span className="block min-w-0">
              <span className="block truncate">{tx("Investition")}</span>
              {projekt.investition && name ? <span className="block truncate text-xs font-normal text-leise">{name}</span> : null}
            </span>
          }
        />
      </ZeilenGruppe>
      <Dialog offen={offen} titel={tx("Investition")} onSchliessen={() => setOffen(false)}>
        <ZeilenGruppe>
          <ZeileSchalter titel={tx("Investition")} an={projekt.investition} onAendern={(an) => speichere({ investition: an })} />
          {projekt.investition ? (
            <GroessenRegler wert={projekt.investitionGroesse} onAendern={(groesse) => speichere({ investitionGroesse: groesse })} />
          ) : null}
          {projekt.investition ? (
            <div className="px-4 py-3">
              <ZielWahl
                ziel={ziel}
                onWaehlen={(investitionZiel) => speichere({ investitionZiel })}
                visionen={listen.visionen}
                projekte={listen.projekte}
                attribute={listen.attribute}
              />
            </div>
          ) : null}
          {projekt.investition && ressourcen && !zielIstRessourcen ? (
            <ZeileSchalter
              titel={RESSOURCEN_SCHALTER}
              info={RESSOURCEN_INFO}
              an={projekt.investitionRessourcen}
              onAendern={(an) => speichere({ investitionRessourcen: an })}
            />
          ) : null}
        </ZeilenGruppe>
        {fehler ? (
          <div className="mt-3">
            <Fehlermeldung fehler={fehler} />
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
