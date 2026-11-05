import { tx } from '../../text.ts';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { Statistiken, Zeitraum } from '../../../../shared/api/index.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useSichtbarkeit } from '../../funktionen.ts';
import { BalkenListe, type SaeulenWert } from '../../components/DiagrammBasis.tsx';
import { LinienDiagramm, SaeulenDiagramm } from '../../components/mitDiagramm.tsx';
import { Icon } from '../../components/Icons.tsx';
import { AbschnittKopf, Chip, Fehlermeldung, Flaeche, Ladeanzeige, Leer } from '../../ui/index.ts';
import { ausTagesSchluessel, kalenderwoche, kurzesDatum, monatKurz, stunden, zahl } from '../../format.ts';

const ZEITRAUM_LABEL: Record<Zeitraum, string> = {
  '3m': '3 Monate',
  '12m': '12 Monate',
  gesamt: 'Gesamt',
};

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WOCHENTAGE_LANG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

function verlaufWerte(statistiken: Statistiken): SaeulenWert[] {
  return statistiken.verlauf.map((abschnitt) => {
    const beginn = ausTagesSchluessel(abschnitt.beginn);
    if (statistiken.verlaufEinheit === 'woche') {
      const woche = kalenderwoche(beginn).woche;
      const datum = kurzesDatum(beginn.toISOString());
      return {
        label: tx('KW {woche}', { woche }),
        titel: tx('KW {woche} · ab {datum}', { woche, datum }),
        wert: abschnitt.xp,
      };
    }
    const monat = `${monatKurz(beginn)} ${String(beginn.getFullYear()).slice(2)}`;
    return { label: monat, titel: monat, wert: abschnitt.xp };
  });
}

export function StatistikenSeite() {
  const sichtbarkeit = useSichtbarkeit();
  const bosseAn = istAn('bossAngriffe', sichtbarkeit);
  const projekteAn = istAn('projekte', sichtbarkeit);
  const [zeitraum, setZeitraum] = useState<Zeitraum>('3m');
  const { data: statistiken, error, isPending, isPlaceholderData } = useQuery({
    queryKey: SCHLUESSEL.statistiken(zeitraum),
    queryFn: () => api.statistiken(zeitraum),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <div className="chip-reihe flex gap-2 overflow-x-auto pe-4">
        {(Object.keys(ZEITRAUM_LABEL) as Zeitraum[]).map((wert) => (
          <Chip
            key={wert}
            aktiv={zeitraum === wert}
            onClick={() => setZeitraum(wert)}
            className={zeitraum === wert ? 'font-semibold' : ''}
          >
            {tx(ZEITRAUM_LABEL[wert])}
          </Chip>
        ))}
      </div>

      {isPending && <Ladeanzeige />}
      <Fehlermeldung fehler={error} />

      {statistiken && statistiken.kennzahlen.eintraege === 0 && <Leer text={tx("Noch keine Einträge.")} />}

      {statistiken && statistiken.kennzahlen.eintraege > 0 && (
        <div className={`transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          <Flaeche>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3">
              <Kennzahl label={tx("Einträge")} wert={zahl(statistiken.kennzahlen.eintraege)} />
              <Kennzahl label={tx("Stunden")} wert={zahl(Math.round(statistiken.kennzahlen.stunden))} />
              <Kennzahl label={tx("Aktive Tage")} wert={zahl(statistiken.kennzahlen.aktiveTage)} />
              <Kennzahl label={tx("Längster Streak")} wert={zahl(statistiken.kennzahlen.laengsterStreak)} />
              <Kennzahl label={tx("Meilensteine")} wert={zahl(statistiken.kennzahlen.meilensteine)} />
              {bosseAn && <Kennzahl label={tx("Bosse besiegt")} wert={zahl(statistiken.kennzahlen.bosseBesiegt)} />}
            </div>
          </Flaeche>

          <section>
            <AbschnittKopf titel={statistiken.verlaufEinheit === 'woche' ? tx("XP pro Woche") : tx("XP pro Monat")} />
            <Flaeche>
              <div className="px-2 py-3">
                <LinienDiagramm
                  werte={verlaufWerte(statistiken)}
                  einheit="XP"
                  jedeZweiteBeschriftung={statistiken.verlaufEinheit === 'woche'}
                />
              </div>
            </Flaeche>
          </section>

          <div className="grid md:grid-cols-2 md:gap-6">
            <section>
              <AbschnittKopf titel={tx("Tätigkeiten")} />
              {statistiken.vorlagen.length === 0 ? (
                <Flaeche>
                  <Leer text={tx("Noch keine Einträge.")} />
                </Flaeche>
              ) : (
                <Flaeche>
                  <div className="px-4 py-3">
                    <BalkenListe
                      liste
                      farbe="var(--diagramm-vorbild)"
                      werte={statistiken.vorlagen.map((vorlage) => ({
                        schluessel: vorlage.id,
                        label: (
                          <>
                            <Icon name={vorlage.icon} className="size-4 shrink-0 text-leise" />
                            <span className="truncate">{vorlage.name}</span>
                          </>
                        ),
                        wert: vorlage.xp,
                        text: `${zahl(vorlage.xp)} XP${vorlage.stunden > 0 ? ` · ${stunden(vorlage.stunden)}` : ''}`,
                      }))}
                    />
                  </div>
                </Flaeche>
              )}
            </section>
            {projekteAn && (
              <section>
                <AbschnittKopf titel={tx("Projekte")} />
                {statistiken.projekte.length === 0 ? (
                  <Flaeche>
                    <Leer text={tx("Noch keine Einträge.")} />
                  </Flaeche>
                ) : (
                  <Flaeche>
                    <div className="px-4 py-3">
                      <BalkenListe
                        liste
                        werte={statistiken.projekte.map((projekt) => ({
                          schluessel: projekt.id,
                          label: (
                            <>
                              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: projekt.farbe }} />
                              <span className="truncate">{projekt.name}</span>
                            </>
                          ),
                          wert: projekt.xp,
                          text: `${zahl(projekt.xp)} XP`,
                          farbe: projekt.farbe,
                        }))}
                      />
                    </div>
                  </Flaeche>
                )}
              </section>
            )}
          </div>

          <section>
            <AbschnittKopf titel={tx("Wochentage")} />
            <Flaeche>
              <div className="px-2 py-3">
                <SaeulenDiagramm
                  werte={statistiken.wochentage.map((eintrag) => {
                    const kurz = WOCHENTAGE[eintrag.tag];
                    const lang = WOCHENTAGE_LANG[eintrag.tag];
                    return {
                      label: kurz ? tx(kurz) : '',
                      titel: lang ? tx(lang) : '',
                      wert: eintrag.xp,
                    };
                  })}
                  einheit="XP"
                />
              </div>
            </Flaeche>
          </section>
        </div>
      )}
    </div>
  );
}

function Kennzahl({ label, wert }: { label: string; wert: string }) {
  return (
    <div data-kennzahl="">
      <p className="text-xl font-bold">{wert}</p>
      <p className="truncate text-xs text-leise">{label}</p>
    </div>
  );
}
