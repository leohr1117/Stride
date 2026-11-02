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
import { Fehlermeldung, Ladeanzeige, Leer, Segmentauswahl, Ueberschrift } from '../../ui/index.ts';
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
      <div className="max-w-sm">
        <Segmentauswahl<Zeitraum>
          optionen={(Object.keys(ZEITRAUM_LABEL) as Zeitraum[]).map((wert) => ({ wert, label: ZEITRAUM_LABEL[wert] }))}
          wert={zeitraum}
          onAendern={setZeitraum}
        />
      </div>

      {isPending && <Ladeanzeige />}
      <Fehlermeldung fehler={error} />

      {statistiken && statistiken.kennzahlen.eintraege === 0 && <Leer text={tx("Noch keine Einträge.")} />}

      {statistiken && statistiken.kennzahlen.eintraege > 0 && (
        <div className={`space-y-6 transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Kennzahl label={tx("Einträge")} wert={zahl(statistiken.kennzahlen.eintraege)} />
            <Kennzahl label={tx("Stunden")} wert={zahl(Math.round(statistiken.kennzahlen.stunden))} />
            <Kennzahl label={tx("Aktive Tage")} wert={zahl(statistiken.kennzahlen.aktiveTage)} />
            <Kennzahl label={tx("Längster Streak")} wert={zahl(statistiken.kennzahlen.laengsterStreak)} />
            <Kennzahl label={tx("Meilensteine")} wert={zahl(statistiken.kennzahlen.meilensteine)} />
            {bosseAn && <Kennzahl label={tx("Bosse besiegt")} wert={zahl(statistiken.kennzahlen.bosseBesiegt)} />}
          </div>

          <section>
            <Ueberschrift titel={statistiken.verlaufEinheit === 'woche' ? tx("XP pro Woche") : tx("XP pro Monat")} />
            <LinienDiagramm werte={verlaufWerte(statistiken)} einheit="XP" />
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section>
              <Ueberschrift titel={tx("Tätigkeiten")} />
              {statistiken.vorlagen.length === 0 ? (
                <Leer text={tx("Noch keine Einträge.")} />
              ) : (
                <BalkenListe
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
              )}
            </section>
            {projekteAn && (
              <section>
                <Ueberschrift titel={tx("Projekte")} />
                {statistiken.projekte.length === 0 ? (
                  <Leer text={tx("Noch keine Einträge.")} />
                ) : (
                  <BalkenListe
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
                )}
              </section>
            )}
          </div>

          <section>
            <Ueberschrift titel={tx("Wochentage")} />
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
