import { tx } from '../../text.ts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { ChronikEintrag, EintragFilter } from '../../../../shared/api/index.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { lokalesDatum, tagesUeberschrift } from '../../format.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { EintragDetail, EintragKarte } from '../../components/EintragKarte.tsx';
import { SkillDetail, SkillKarte } from '../../components/SkillKarte.tsx';
import { Fehlermeldung, Karte, Knopf, Ladeanzeige } from '../../ui/index.ts';

interface Tag {
  schluessel: string;
  eintraege: ChronikEintrag[];
}

function zeitVon(eintrag: ChronikEintrag): string {
  return eintrag.typ === 'eintrag' ? eintrag.eintrag.erstelltAm : eintrag.skill.erstelltAm;
}

function schluesselVon(eintrag: ChronikEintrag): string {
  return eintrag.typ === 'eintrag' ? `e-${eintrag.eintrag.id}` : `s-${eintrag.skill.knotenId}`;
}

function titelVon(eintrag: ChronikEintrag): string {
  return eintrag.typ === 'eintrag' ? eintrag.eintrag.vorlageName : eintrag.skill.titel;
}

function gruppiereNachTag(eintraege: ChronikEintrag[]): Tag[] {
  const tage: Tag[] = [];
  for (const eintrag of eintraege) {
    const schluessel = lokalesDatum(new Date(zeitVon(eintrag)));
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
        <Karte className="py-10 text-center text-sm text-leise">{leerText}</Karte>
      ) : (
        tage.map((tag) => (
          <section key={tag.schluessel}>
            <div className="mb-2 flex items-center gap-3">
              <h2 className="text-xs font-medium text-leise">{tagesUeberschrift(tag.schluessel)}</h2>
              <span className="h-px flex-1 bg-rand" />
            </div>
            <div className="space-y-2">
              {tag.eintraege.map((eintrag) =>
                eintrag.typ === 'eintrag' ? (
                  <EintragKarte
                    key={schluesselVon(eintrag)}
                    eintrag={eintrag.eintrag}
                    onOeffnen={() => setAuswahl(schluesselVon(eintrag))}
                  />
                ) : (
                  <SkillKarte
                    key={schluesselVon(eintrag)}
                    skill={eintrag.skill}
                    onOeffnen={() => setAuswahl(schluesselVon(eintrag))}
                  />
                ),
              )}
            </div>
          </section>
        ))
      )}

      {abfrage.hasNextPage && (
        <Knopf className="w-full" onClick={() => void abfrage.fetchNextPage()} disabled={abfrage.isFetchingNextPage}>
          {abfrage.isFetchingNextPage ? tx("Lädt …") : tx("Ältere Einträge laden")}
        </Knopf>
      )}

      <Dialog offen={gewaehlt !== null} titel={gewaehlt ? titelVon(gewaehlt) : ''} onSchliessen={() => setAuswahl(null)}>
        {gewaehlt?.typ === 'eintrag' ? (
          <EintragDetail eintrag={gewaehlt.eintrag} onEntfernt={() => setAuswahl(null)} />
        ) : null}
        {gewaehlt?.typ === 'skill' ? <SkillDetail skill={gewaehlt.skill} /> : null}
      </Dialog>
    </div>
  );
}
