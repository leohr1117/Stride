import { attributName, tx } from '../../text.ts';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { Attribut, Investition, InvestitionsArt, InvestitionsZiel, Projekt, ProjektAenderung, ProjektDetail, Vision, Ziele } from '../../../../shared/api/index.ts';
import { NEUTRAL_FARBE } from '../../../../shared/spiel/begriffe.ts';
import { istTypAktiv } from '../../../../shared/spiel/funktionen.ts';
import { INVESTITION_INFO, RESSOURCEN_SCHALTER, investitionsBonus } from '../../../../shared/spiel/xp.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { bonusProzent } from '../../format.ts';
import { useSichtbarkeit } from '../../funktionen.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { useKopf } from '../../components/Kopf.tsx';
import { ArchivListe } from '../../components/ArchivListe.tsx';
import { SchnellMenueKnopf, SchnellZeile } from '../../components/SchnellAktion.tsx';
import { Icon } from '../../components/Icons.tsx';
import { AnlegeZeile, Liste, Zeile, ZeileSchalter, ZeilenGruppe } from '../../components/Zeile.tsx';
import { Chip, Fehlermeldung, Knopf, Ladeanzeige, Leer, Segmentauswahl } from '../../ui/index.ts';
import { GroessenRegler } from './groesse.tsx';
import { InvestitionFormular, listenFuerZiel } from './InvestitionBlatt.tsx';
import { loeschHinweis } from './zahlungAnzeige.ts';

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
    <div className="w-full min-w-0 space-y-3">
      {optionen.length > 1 ? <Segmentauswahl optionen={optionen} wert={art} onAendern={setSegment} /> : null}
      {art === 'vision' ? (
        <div className="flex w-full min-w-0 max-w-full flex-wrap gap-2">
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
        <div className="flex w-full min-w-0 max-w-full flex-wrap gap-2">
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
        <div className="flex w-full min-w-0 max-w-full flex-wrap gap-2">
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

function zahlungsHinweis(eintrag: Investition, attribute: Attribut[]): string | undefined {
  if (eintrag.bezahltAttributId === null) {
    return undefined;
  }
  const ziel = attribute.find((attribut) => attribut.id === eintrag.bezahltAttributId);
  if (!ziel) {
    return undefined;
  }
  return loeschHinweis(eintrag.betrag, attributName(ziel)) ?? undefined;
}

export function InvestitionenSeite() {
  useKopf({ titel: 'Investitionen', info: INVESTITION_INFO });
  const { data: ziele } = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele });
  const { data: attribute = [] } = useQuery({ queryKey: SCHLUESSEL.attribute, queryFn: api.attribute });
  const { data: investitionen, error, isPending } = useQuery({ queryKey: SCHLUESSEL.investitionen, queryFn: api.investitionen });
  const [dialog, setDialog] = useState<Investition | null | 'neu'>(null);
  const liste = investitionen ?? [];
  const eigene = liste.filter((eintrag) => !eintrag.archiviert);
  const archiv = liste.filter((eintrag) => eintrag.archiviert);
  const visionen = ziele?.visionen ?? [];
  const alleProjekte = ziele?.projekte ?? [];

  if (isPending) {
    return <Ladeanzeige />;
  }

  return (
    <div className="space-y-6">
      <Fehlermeldung fehler={error} />
      {eigene.length === 0 ? (
        <Leer text={tx('Noch keine Investition.')} aktion={<Knopf onClick={() => setDialog('neu')}>{`+ ${tx('Investition anlegen')}`}</Knopf>} />
      ) : (
        <Liste>
          {eigene.map((investition) => {
            const ziel = investition.zielName ?? zielText(investition.ziel, visionen, alleProjekte, attribute);
            const neben = [bonusProzent(investition.bonus), ziel].filter((teil) => teil).join(' · ');
            return (
              <SchnellZeile
                key={investition.id}
                ziel={{
                  art: 'investition',
                  id: investition.id,
                  name: investition.name,
                  archiviert: investition.archiviert,
                  loeschbar: investition.loeschbar,
                  hinweis: zahlungsHinweis(investition, attribute),
                }}
              >
                {(menue) => (
                  <Zeile
                    name={investition.name}
                    onKlick={() => setDialog(investition)}
                    pfeil={false}
                    symbol={<Icon name={investition.icon} />}
                    titel={investition.name}
                    neben={neben}
                    rechts={menue}
                  />
                )}
              </SchnellZeile>
            );
          })}
          <AnlegeZeile text="Investition anlegen" onKlick={() => setDialog('neu')} />
        </Liste>
      )}
      <ArchivListe
        eintraege={archiv.map((eintrag) => ({
          schluessel: `i-${eintrag.id}`,
          name: eintrag.name,
          icon: eintrag.icon,
          farbe: NEUTRAL_FARBE,
          ziel: {
            art: 'investition' as const,
            id: eintrag.id,
            name: eintrag.name,
            archiviert: true,
            loeschbar: eintrag.loeschbar,
            hinweis: zahlungsHinweis(eintrag, attribute),
          },
        }))}
      />
      <Dialog
        offen={dialog !== null}
        titel={tx('Investition')}
        menu={
          dialog && dialog !== 'neu' ? (
            <SchnellMenueKnopf
              ziel={{
                art: 'investition',
                id: dialog.id,
                name: dialog.name,
                archiviert: dialog.archiviert,
                loeschbar: dialog.loeschbar,
                hinweis: zahlungsHinweis(dialog, attribute),
              }}
              onErledigt={() => setDialog(null)}
            />
          ) : undefined
        }
        onSchliessen={() => setDialog(null)}
      >
        {dialog !== null && (
          <InvestitionFormular
            investition={dialog === 'neu' ? null : dialog}
            attribute={attribute}
            onFertig={() => setDialog(null)}
          />
        )}
      </Dialog>
    </div>
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
  const status = projekt.investition
    ? bonusProzent(investitionsBonus(projekt.investitionGroesse))
    : tx('Aus');

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
              titel={tx(RESSOURCEN_SCHALTER)}
              name={tx(RESSOURCEN_SCHALTER)}
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
