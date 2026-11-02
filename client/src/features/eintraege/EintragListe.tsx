import { tx } from '../../text.ts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { RotateCcw, Shield, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { ChronikEintrag, Eintrag, EintragFilter, ProtokollArt, ProtokollZeile, SkillEreignis } from '../../../../shared/api/index.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { dauerText, lokalesDatum, tagesUeberschrift, zahl } from '../../format.ts';
import { useSichtbarkeit } from '../../funktionen.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { EintragDetail } from '../../components/EintragKarte.tsx';
import { Icon } from '../../components/Icons.tsx';
import { SchnellZeile } from '../../components/SchnellAktion.tsx';
import { SkillDetail } from '../../components/SkillKarte.tsx';
import { Liste } from '../../components/Zeile.tsx';
import { Fehlermeldung, Knopf, Ladeanzeige, Leer } from '../../ui/index.ts';

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
  }
}

function titelVon(eintrag: ChronikEintrag): string {
  switch (eintrag.typ) {
    case 'eintrag':
      return eintrag.eintrag.vorlageName;
    case 'skill':
      return eintrag.skill.titel;
    case 'protokoll':
      return protokollText(eintrag.protokoll.art);
  }
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
    <div data-protokoll={protokoll.art} className="zeile flex min-h-12 items-center gap-3 px-4 py-3 text-leise">
      <Symbol className="size-5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-base">{protokollText(protokoll.art)}</span>
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
        <div className="flex min-h-12 items-center">
          <button
            type="button"
            onClick={onOeffnen}
            aria-label={eintrag.vorlageName}
            className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-3 pr-1 pl-4 text-left"
          >
            <Icon name={eintrag.vorlageIcon} className="size-5 shrink-0 text-leise" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base">{eintrag.vorlageName}</span>
              {neben ? <span className="block truncate text-[13px] leading-[18px] text-leise">{neben}</span> : null}
            </span>
            <span className="zahl shrink-0 text-[15px] leading-5 font-medium text-xp">+{zahl(eintrag.xp)} XP</span>
          </button>
          <span className="relative z-10 shrink-0">{menue}</span>
        </div>
      )}
    </SchnellZeile>
  );
}

function SkillZeile({ skill, onOeffnen }: { skill: SkillEreignis; onOeffnen: () => void }) {
  return (
    <button type="button" onClick={onOeffnen} className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left">
      <Sparkles className="size-5 shrink-0 text-xp" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base">{skill.titel}</span>
        <span className="block truncate text-[13px] leading-[18px] text-leise">{skill.faehigkeitName}</span>
      </span>
      <span className="zahl shrink-0 text-[15px] leading-5 font-medium text-xp">+{zahl(skill.xp)} XP</span>
    </button>
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
  const abfrage = useInfiniteQuery({
    queryKey: SCHLUESSEL.eintraege(filter),
    queryFn: ({ pageParam }) => api.eintraege(filter, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (seite) => seite.naechsterCursor ?? undefined,
  });

  if (abfrage.isPending) {
    return <Ladeanzeige />;
  }

  const eintraege = abfrage.data?.pages.flatMap((seite) => seite.eintraege) ?? [];
  const tage = gruppiereNachTag(eintraege);
  const gewaehlt = eintraege.find((eintrag) => schluesselVon(eintrag) === auswahl) ?? null;

  return (
    <div className="space-y-6">
      <Fehlermeldung fehler={abfrage.error} />

      {tage.length === 0 ? (
        <Leer
          text={leerText}
          aktion={
            onZuruecksetzen ? (
              <Knopf onClick={onZuruecksetzen}>{tx('Filter zurücksetzen')}</Knopf>
            ) : undefined
          }
        />
      ) : (
        tage.map((tag) => (
          <section key={tag.schluessel}>
            <h2 className="ueberschrift abschnittskopf mb-2 text-[13px] font-semibold leading-[18px] tracking-normal text-leise normal-case">
              {tagesUeberschrift(tag.schluessel)}
            </h2>
            <Liste>
              {tag.eintraege.map((eintrag) => (
                <ChronikZeile
                  key={schluesselVon(eintrag)}
                  eintrag={eintrag}
                  onOeffnen={() => setAuswahl(schluesselVon(eintrag))}
                />
              ))}
            </Liste>
          </section>
        ))
      )}

      {abfrage.hasNextPage && (
        <Knopf className="w-full" onClick={() => void abfrage.fetchNextPage()} disabled={abfrage.isFetchingNextPage}>
          {abfrage.isFetchingNextPage ? tx("Lädt …") : tx("Ältere Einträge laden")}
        </Knopf>
      )}

      <Dialog
        offen={gewaehlt !== null && gewaehlt.typ !== 'protokoll'}
        titel={gewaehlt ? titelVon(gewaehlt) : ''}
        onSchliessen={() => setAuswahl(null)}
      >
        {gewaehlt?.typ === 'eintrag' ? (
          <EintragDetail eintrag={gewaehlt.eintrag} onEntfernt={() => setAuswahl(null)} />
        ) : null}
        {gewaehlt?.typ === 'skill' ? <SkillDetail skill={gewaehlt.skill} /> : null}
      </Dialog>
    </div>
  );
}
