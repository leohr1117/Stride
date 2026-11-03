import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { RotateCcw, Shield, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { Attribut, ChronikEintrag, Eintrag, EintragFilter, Investition, InvestitionsBuchung, ProtokollArt, ProtokollZeile, SkillEreignis } from '../../../../shared/api/index.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { EintragDetail, eintragSchnellZiel } from '../../components/EintragKarte.tsx';
import { Icon } from '../../components/Icons.tsx';
import { SchnellMenueKnopf, SchnellZeile } from '../../components/SchnellAktion.tsx';
import { SkillDetail } from '../../components/SkillKarte.tsx';
import { DichteZeilen, Liste, Zeile } from '../../components/Zeile.tsx';
import { dauerText, lokalesDatum, tagesUeberschrift, zahl } from '../../format.ts';
import { useSichtbarkeit } from '../../funktionen.ts';
import { attributName, tx } from '../../text.ts';
import { AbschnittKopf, Fehlermeldung, Knopf, Ladeanzeige, Leer } from '../../ui/index.ts';
import { InvestitionFormular } from '../investitionen/InvestitionBlatt.tsx';
import { loeschHinweis } from '../investitionen/zahlungAnzeige.ts';

interface Tag {
  schluessel: string;
  eintraege: ChronikEintrag[];
}

function protokollText(art: ProtokollArt): string {
  switch (art) {
    case 'schutz_verdient':
      return tx("Schutz verdient");
    case 'schutz_eingesetzt':
      return tx("Schutz eingesetzt");
    case 'rueckkehr_offen':
      return tx("Rückkehr offen");
    case 'rueckkehr_geschafft':
      return tx("Rückkehr geschafft");
    case 'rueckkehr_zu':
      return tx("Rückkehr vorbei");
  }
}

function protokollIcon(art: ProtokollArt) {
  switch (art) {
    case 'schutz_verdient':
    case 'schutz_eingesetzt':
      return Shield;
    case 'rueckkehr_offen':
    case 'rueckkehr_geschafft':
    case 'rueckkehr_zu':
      return RotateCcw;
  }
}

function tagVon(eintrag: ChronikEintrag): string {
  switch (eintrag.typ) {
    case 'eintrag':
      return lokalesDatum(new Date(eintrag.eintrag.erstelltAm));
    case 'skill':
      return lokalesDatum(new Date(eintrag.skill.erstelltAm));
    case 'protokoll':
      return eintrag.protokoll.tag;
    case 'investition':
      return lokalesDatum(new Date(eintrag.buchung.erstelltAm));
  }
}

function schluesselVon(eintrag: ChronikEintrag): string {
  switch (eintrag.typ) {
    case 'eintrag':
      return `e-${eintrag.eintrag.id}`;
    case 'skill':
      return `s-${eintrag.skill.knotenId}`;
    case 'protokoll':
      return `p-${eintrag.protokoll.id}`;
    case 'investition':
      return `b-${eintrag.buchung.id}`;
  }
}

function titelVon(eintrag: ChronikEintrag): string {
  switch (eintrag.typ) {
    case 'eintrag':
      return tx('Eintrag');
    case 'skill':
      return eintrag.skill.titel;
    case 'protokoll':
      return protokollText(eintrag.protokoll.art);
    case 'investition':
      return tx('Investition');
  }
}

function xpBetrag(xp: number): string {
  const menge = zahl(Math.abs(xp));
  return `${xp < 0 ? '−' : '+'}${menge} XP`;
}

function ausAttribut(buchung: InvestitionsBuchung): string {
  return tx('aus {name}', { name: attributName({ kennung: buchung.attributKennung, name: buchung.attributName }) });
}

function hinweisFuer(eintrag: Investition, attribute: Attribut[]): string | undefined {
  if (eintrag.bezahltAttributId === null) {
    return undefined;
  }
  const ziel = attribute.find((attribut) => attribut.id === eintrag.bezahltAttributId);
  if (!ziel) {
    return undefined;
  }
  return loeschHinweis(eintrag.betrag, attributName(ziel)) ?? undefined;
}

function InvestitionZeile({ buchung, onOeffnen }: { buchung: InvestitionsBuchung; onOeffnen: (() => void) | null }) {
  if (buchung.investitionId === null || buchung.name === null) {
    if (buchung.xp > 0) {
      return (
        <div data-buchung-art="geloescht">
          <Zeile typ="lesen" titel={tx('+{xp} XP · Investition gelöscht', { xp: zahl(buchung.xp) })} />
        </div>
      );
    }
    return (
      <div data-buchung-art="zahlung">
        <Zeile typ="lesen" titel={tx('Investition')} neben={ausAttribut(buchung)} wert={xpBetrag(buchung.xp)} />
      </div>
    );
  }
  const titel = tx('Investition · {name}', { name: buchung.name });
  return (
    <div data-buchung-art={buchung.xp < 0 ? 'zahlung' : 'aenderung'}>
      <Zeile
        typ="lesen"
        name={titel}
        titel={titel}
        neben={ausAttribut(buchung)}
        wert={xpBetrag(buchung.xp)}
        symbol={<Icon name={buchung.icon ?? 'gem'} />}
        onKlick={onOeffnen ?? undefined}
      />
    </div>
  );
}

function nebenzeile(eintrag: Eintrag): string | null {
  const teile: string[] = [];
  if (eintrag.stunden !== null) {
    teile.push(dauerText(eintrag.stunden));
  }
  const notiz = eintrag.notiz.trim().split('\n')[0] ?? '';
  if (notiz) {
    teile.push(notiz);
  } else if (eintrag.vorhaben) {
    teile.push(eintrag.vorhaben.titel);
  } else if (eintrag.projektName) {
    teile.push(eintrag.projektName);
  }
  return teile.length > 0 ? teile.join(' · ') : null;
}

function ProtokollAnsicht({ protokoll }: { protokoll: ProtokollZeile }) {
  const Symbol = protokollIcon(protokoll.art);
  return (
    <div data-protokoll={protokoll.art}>
      <Zeile typ="lesen" className="text-leise" titel={protokollText(protokoll.art)} symbol={<Symbol aria-hidden />} />
    </div>
  );
}

function EintragZeile({ eintrag, onOeffnen }: { eintrag: Eintrag; onOeffnen: () => void }) {
  const sichtbarkeit = useSichtbarkeit();
  const bossSieg = istAn('bossAngriffe', sichtbarkeit) && eintrag.bossSieg != null;
  const neben = nebenzeile(eintrag);
  const name = eintrag.notiz.trim().split('\n')[0] || eintrag.vorlageName;
  return (
    <SchnellZeile
      ziel={{ art: 'eintrag', id: eintrag.id, name, hinweis: tx('Die {xp} XP werden wieder abgezogen.', { xp: eintrag.xp }) }}
      className={bossSieg ? 'boss-sieg text-gefahr' : ''}
      hintergrund={bossSieg ? 'bg-gefahr/5' : 'bg-transparent'}
    >
      {(menue) => (
        <Zeile
          typ="lesen"
          name={eintrag.vorlageName}
          titel={eintrag.vorlageName}
          neben={neben ?? undefined}
          wert={`+${zahl(eintrag.xp)} XP`}
          symbol={<Icon name={eintrag.vorlageIcon} />}
          menue={menue}
          onKlick={onOeffnen}
        />
      )}
    </SchnellZeile>
  );
}

function SkillZeile({ skill, onOeffnen }: { skill: SkillEreignis; onOeffnen: () => void }) {
  return (
    <Zeile
      typ="lesen"
      name={skill.titel}
      titel={skill.titel}
      neben={skill.faehigkeitName}
      wert={`+${zahl(skill.xp)} XP`}
      symbol={<Sparkles aria-hidden />}
      onKlick={onOeffnen}
    />
  );
}

function ChronikZeile({ eintrag, onOeffnen }: { eintrag: ChronikEintrag; onOeffnen: () => void }) {
  switch (eintrag.typ) {
    case 'eintrag':
      return <EintragZeile eintrag={eintrag.eintrag} onOeffnen={onOeffnen} />;
    case 'skill':
      return <SkillZeile skill={eintrag.skill} onOeffnen={onOeffnen} />;
    case 'protokoll':
      return <ProtokollAnsicht protokoll={eintrag.protokoll} />;
    case 'investition':
      return (
        <InvestitionZeile
          buchung={eintrag.buchung}
          onOeffnen={eintrag.buchung.investitionId === null ? null : onOeffnen}
        />
      );
  }
}

function gruppiereNachTag(eintraege: ChronikEintrag[]): Tag[] {
  const tage: Tag[] = [];
  for (const eintrag of eintraege) {
    const schluessel = tagVon(eintrag);
    let tag = tage[tage.length - 1];
    if (!tag || tag.schluessel !== schluessel) {
      tag = { schluessel, eintraege: [] };
      tage.push(tag);
    }
    tag.eintraege.push(eintrag);
  }
  return tage;
}

export function EintragListe({
  filter,
  leerText,
  onZuruecksetzen,
}: {
  filter: EintragFilter;
  leerText: string;
  onZuruecksetzen?: () => void;
}) {
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [blatt, setBlatt] = useState<number | null>(null);
  const abfrage = useInfiniteQuery({
    queryKey: SCHLUESSEL.eintraege(filter),
    queryFn: ({ pageParam }) => api.eintraege(filter, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (seite) => seite.naechsterCursor ?? undefined,
  });
  const investitionen = useQuery({
    queryKey: SCHLUESSEL.investitionen,
    queryFn: api.investitionen,
    enabled: blatt !== null,
  });
  const attribute = useQuery({
    queryKey: SCHLUESSEL.attribute,
    queryFn: api.attribute,
    enabled: blatt !== null,
  });

  if (abfrage.isPending) {
    return <Ladeanzeige />;
  }

  const eintraege = abfrage.data?.pages.flatMap((seite) => seite.eintraege) ?? [];
  const tage = gruppiereNachTag(eintraege);
  const gewaehlt = eintraege.find((eintrag) => schluesselVon(eintrag) === auswahl) ?? null;
  const investition = investitionen.data?.find((eintrag) => eintrag.id === blatt) ?? null;

  return (
    <DichteZeilen>
    <div>
      <Fehlermeldung fehler={abfrage.error ?? investitionen.error ?? attribute.error} />

      {tage.length === 0 ? (
        <div className="mt-6">
          <Leer
            text={leerText}
            aktion={
              onZuruecksetzen ? (
                <Knopf onClick={onZuruecksetzen}>{tx('Filter zurücksetzen')}</Knopf>
              ) : undefined
            }
          />
        </div>
      ) : (
        tage.map((tag) => (
          <section key={tag.schluessel}>
            <AbschnittKopf titel={tagesUeberschrift(tag.schluessel)} />
            <Liste className="menue-spalte">
              {tag.eintraege.map((eintrag) => (
                <ChronikZeile
                  key={schluesselVon(eintrag)}
                  eintrag={eintrag}
                  onOeffnen={() => {
                    if (eintrag.typ === 'investition') {
                      if (eintrag.buchung.investitionId !== null) {
                        setBlatt(eintrag.buchung.investitionId);
                      }
                      return;
                    }
                    setAuswahl(schluesselVon(eintrag));
                  }}
                />
              ))}
            </Liste>
          </section>
        ))
      )}

      {abfrage.hasNextPage && (
        <div className="mt-6">
          <Knopf className="w-full" onClick={() => void abfrage.fetchNextPage()} disabled={abfrage.isFetchingNextPage}>
            {abfrage.isFetchingNextPage ? tx("Lädt …") : tx("Ältere Einträge laden")}
          </Knopf>
        </div>
      )}

      <Dialog
        offen={gewaehlt !== null && gewaehlt.typ !== 'protokoll'}
        titel={gewaehlt ? titelVon(gewaehlt) : ''}
        menu={
          gewaehlt?.typ === 'eintrag' ? (
            <SchnellMenueKnopf ziel={eintragSchnellZiel(gewaehlt.eintrag)} onErledigt={() => setAuswahl(null)} />
          ) : undefined
        }
        onSchliessen={() => setAuswahl(null)}
      >
        {gewaehlt?.typ === 'eintrag' ? <EintragDetail eintrag={gewaehlt.eintrag} /> : null}
        {gewaehlt?.typ === 'skill' ? <SkillDetail skill={gewaehlt.skill} /> : null}
      </Dialog>

      <Dialog
        offen={investition !== null}
        titel={tx('Investition')}
        menu={
          investition ? (
            <SchnellMenueKnopf
              ziel={{
                art: 'investition',
                id: investition.id,
                name: investition.name,
                archiviert: investition.archiviert,
                loeschbar: investition.loeschbar,
                hinweis: hinweisFuer(investition, attribute.data ?? []),
              }}
              onErledigt={() => setBlatt(null)}
            />
          ) : undefined
        }
        onSchliessen={() => setBlatt(null)}
      >
        {investition && attribute.data ? (
          <InvestitionFormular investition={investition} attribute={attribute.data} onFertig={() => setBlatt(null)} />
        ) : (
          <Ladeanzeige />
        )}
      </Dialog>
    </div>
    </DichteZeilen>
  );
}
