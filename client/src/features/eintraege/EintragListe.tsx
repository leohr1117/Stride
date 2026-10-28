import { tx } from '../../text.ts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { RotateCcw, Shield } from 'lucide-react';
import { useState } from 'react';
import type { ChronikEintrag, EintragFilter, ProtokollArt, ProtokollZeile } from '../../../../shared/api/index.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { lokalesDatum, tagesUeberschrift } from '../../format.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { EintragDetail, EintragKarte } from '../../components/EintragKarte.tsx';
import { SkillDetail, SkillKarte } from '../../components/SkillKarte.tsx';
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

function ProtokollAnsicht({ protokoll }: { protokoll: ProtokollZeile }) {
  const Icon = protokollIcon(protokoll.art);
  return (
    <div data-protokoll={protokoll.art} className="flex min-h-10 items-center gap-3 rounded-2xl border border-rand bg-flaeche px-3 py-2 text-sm text-leise">
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{protokollText(protokoll.art)}</span>
    </div>
  );
}

function ChronikZeile({ eintrag, onOeffnen }: { eintrag: ChronikEintrag; onOeffnen: () => void }) {
  switch (eintrag.typ) {
    case 'eintrag':
      return <EintragKarte eintrag={eintrag.eintrag} onOeffnen={onOeffnen} />;
    case 'skill':
      return <SkillKarte skill={eintrag.skill} onOeffnen={onOeffnen} />;
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

export function EintragListe({ filter, leerText }: { filter: EintragFilter; leerText: string }) {
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
    <div className="space-y-5">
      <Fehlermeldung fehler={abfrage.error} />

      {tage.length === 0 ? (
        <Leer text={leerText} />
      ) : (
        tage.map((tag) => (
          <section key={tag.schluessel}>
            <div className="mb-2 flex items-center gap-3">
              <h2 className="text-xs font-medium text-leise">{tagesUeberschrift(tag.schluessel)}</h2>
              <span className="h-px flex-1 bg-rand" />
            </div>
            <div className="space-y-2">
              {tag.eintraege.map((eintrag) => (
                <ChronikZeile
                  key={schluesselVon(eintrag)}
                  eintrag={eintrag}
                  onOeffnen={() => setAuswahl(schluesselVon(eintrag))}
                />
              ))}
            </div>
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
