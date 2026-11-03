import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import type { Kalender } from '../../../../shared/api/index.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { SchnellMenueKnopf } from '../../components/SchnellAktion.tsx';
import { AnlegeZeile, Zeile } from '../../components/Zeile.tsx';
import { kurzesDatum, uhrzeit } from '../../format.ts';
import { tx } from '../../text.ts';
import { AbschnittKopf, FlaecheInnen, FlaechenRahmen, InfoHinweis } from '../../ui/index.ts';
import { KalenderFormular } from './Einrichtung.tsx';
import { kalenderAnzeige, letzterAbgleich, zeigeProjektArchiviert, type KalenderAnzeige } from './stand.ts';

function zeitpunktText(iso: string | null): string | null {
  return iso ? `${kurzesDatum(iso)}, ${uhrzeit(iso)}` : null;
}

function Spaltenkopf({ className = '' }: { className?: string }) {
  return (
    <div className={`flex justify-between px-4 pt-2 pb-1 text-[13px] leading-[18px] text-leise ${className}`}>
      <span>{tx('Termine in')}</span>
      <span className="pe-7">{tx('zählen als')}</span>
    </div>
  );
}

function satz(name: string, wert: string, fehler: boolean): string {
  const basis = `${tx('Termine in')} ${name}, ${tx('zählen als')} ${wert}`;
  return fehler ? `${basis}, ${tx('Fehler')}` : basis;
}

function wertKnoten(anzeige: KalenderAnzeige, fehler: boolean): ReactNode {
  if (fehler) {
    return (
      <span className="inline-flex items-center gap-1 text-gefahr">
        <span aria-hidden="true">⚠</span>
        {tx('Fehler')}
      </span>
    );
  }
  return anzeige.eigene ? <span className="text-haupt">{anzeige.text}</span> : anzeige.text;
}

function useBlick() {
  const { data: ziele } = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele });
  const { data: vorlagen = [] } = useQuery({ queryKey: SCHLUESSEL.vorlagen, queryFn: api.vorlagen });
  return { projekte: ziele?.projekte ?? [], vorlagen };
}

export function KalenderAbschnitt({ kalender }: { kalender: Kalender[] }) {
  const { projekte, vorlagen } = useBlick();
  const [dialog, setDialog] = useState<{ kalender: Kalender | null } | null>(null);
  const zeit = zeitpunktText(letzterAbgleich(kalender.map((eintrag) => eintrag.letzterAbgleich)));
  const nameVon = (id: number | null) => (id === null ? null : (vorlagen.find((eintrag) => eintrag.id === id)?.name ?? null));

  return (
    <section id="kalender">
      <AbschnittKopf titel={tx('Kalender')} hinweis={tx('Jeder vergangene Termin wird ein Eintrag mit XP.')} />
      <FlaechenRahmen>
        {kalender.length > 0 ? (
          <>
            <FlaecheInnen>
              <div>
                <Spaltenkopf className="bg-grund md:bg-transparent" />
                <div className="liste">
                  {kalender.map((eintrag) => {
                    const projekt = projekte.find((kandidat) => kandidat.id === eintrag.projektId);
                    const anzeige = kalenderAnzeige({
                      vorlageId: eintrag.vorlageId,
                      vorlageName: nameVon(eintrag.vorlageId),
                      projektId: eintrag.projektId,
                      standardName: nameVon(projekt?.standardVorlageId ?? null),
                    });
                    const fehler = eintrag.fehler !== null;
                    const archiviert = zeigeProjektArchiviert(eintrag.projektId, projekt ? projekt.aktiv : null);
                    return (
                      <Zeile
                        key={eintrag.id}
                        titel={eintrag.name}
                        name={satz(eintrag.name, anzeige.text, fehler)}
                        neben={archiviert ? tx('Projekt archiviert') : fehler ? anzeige.text : undefined}
                        wert={wertKnoten(anzeige, fehler)}
                        onKlick={() => setDialog({ kalender: eintrag })}
                      />
                    );
                  })}
                </div>
              </div>
            </FlaecheInnen>
            <p className="flex items-center px-4 pt-3 text-[13px] leading-[18px] text-leise">
              <span className="min-w-0">{zeit ? tx('Zuletzt abgeglichen {zeit}', { zeit }) : tx('Noch nicht abgeglichen')}</span>
              <InfoHinweis name="Zuletzt abgeglichen" text="Beim Öffnen und alle 15 Minuten." />
            </p>
          </>
        ) : null}
        <div className={kalender.length > 0 ? 'mt-2' : undefined}>
          <FlaecheInnen>
            <AnlegeZeile text="Kalender verbinden" onKlick={() => setDialog({ kalender: null })} />
          </FlaecheInnen>
        </div>
      </FlaechenRahmen>
      <Dialog
        offen={dialog !== null}
        titel={dialog?.kalender ? dialog.kalender.name : tx('Kalender verbinden')}
        menu={
          dialog?.kalender ? (
            <SchnellMenueKnopf
              ziel={{ art: 'kalender', id: dialog.kalender.id, name: dialog.kalender.name }}
              onErledigt={() => setDialog(null)}
            />
          ) : undefined
        }
        onSchliessen={() => setDialog(null)}
      >
        {dialog ? (
          <KalenderFormular key={dialog.kalender?.id ?? 'neu'} kalender={dialog.kalender} onFertig={() => setDialog(null)} />
        ) : null}
      </Dialog>
    </section>
  );
}
