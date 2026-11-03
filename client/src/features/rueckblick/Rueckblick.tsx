import { attributName, tx } from '../../text.ts';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, ChevronLeft, ChevronRight, Trophy } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { Rueckblick, RueckblickAntworten } from '../../../../shared/api/index.ts';
import { GRENZEN } from '../../../../shared/spiel/begriffe.ts';
import { TAGE_PRO_WOCHE } from '../../../../shared/spiel/datum.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { RUECKBLICK } from '../../../../shared/spiel/xp.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useSichtbarkeit } from '../../funktionen.ts';
import { KurzListe } from '../../components/Ausklappbar.tsx';
import { useFeiern } from '../../components/Belohnung.tsx';
import { BalkenListe } from '../../components/DiagrammBasis.tsx';
import { AbschnittKopf, EINGABE_STIL, Feld, Fehlermeldung, Flaeche, Formular, Knopf, Ladeanzeige } from '../../ui/index.ts';
import {
  ausTagesSchluessel,
  datumLang,
  kalenderwoche,
  kurzesDatum,
  lokalesDatum,
  mitVorzeichen,
  verschiebeTag,
  wochenbeginn,
  zahl,
} from '../../format.ts';

const HOEHEPUNKTE_SICHTBAR = 6;

const FRAGEN: { feld: keyof RueckblickAntworten; frage: string }[] = [
  { feld: 'gut', frage: 'Was lief gut?' },
  { feld: 'lernen', frage: 'Was nehme ich mit?' },
  { feld: 'fokus', frage: 'Worauf konzentriere ich mich nächste Woche?' },
];

function wochenTitel(rueckblick: Rueckblick): string {
  const beginn = ausTagesSchluessel(rueckblick.woche);
  const ende = ausTagesSchluessel(rueckblick.wocheBis);
  return tx('KW {woche} · {anfang} bis {ende}', {
    woche: kalenderwoche(beginn).woche,
    anfang: kurzesDatum(beginn.toISOString()),
    ende: kurzesDatum(ende.toISOString()),
  });
}

function veraenderung(xp: number, vorwoche: number): string | null {
  if (vorwoche <= 0) {
    return null;
  }
  return tx('{prozent} % zur Vorwoche', { prozent: mitVorzeichen(Math.round(((xp - vorwoche) / vorwoche) * 100)) });
}

export function RueckblickSeite() {
  const sichtbarkeit = useSichtbarkeit();
  const projekteAn = istAn('projekte', sichtbarkeit);
  const [woche, setWoche] = useState(() => lokalesDatum(wochenbeginn(new Date())));
  const { data: rueckblick, error, isPending, isPlaceholderData } = useQuery({
    queryKey: SCHLUESSEL.rueckblick(woche),
    queryFn: () => api.rueckblick(woche),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      {isPending && <Ladeanzeige />}
      <Fehlermeldung fehler={error} />

      {rueckblick && (
        <div className={`transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between gap-3">
            <Knopf
              variante="leise"
              className="size-12 p-0"
              aria-label={tx("Vorherige Woche")}
              onClick={() => setWoche(verschiebeTag(woche, -TAGE_PRO_WOCHE))}
            >
              <ChevronLeft className="size-5" />
            </Knopf>
            <p className="zahl text-center text-sm font-medium">{wochenTitel(rueckblick)}</p>
            <Knopf
              variante="leise"
              className="size-12 p-0"
              aria-label={tx("Nächste Woche")}
              disabled={rueckblick.aktuelleWoche}
              onClick={() => setWoche(verschiebeTag(woche, TAGE_PRO_WOCHE))}
            >
              <ChevronRight className="size-5" />
            </Knopf>
          </div>

          {(rueckblick.meilensteine.length > 0 || rueckblick.erfolge.length > 0) && (
            <section>
              <AbschnittKopf titel={tx("Höhepunkte")} />
              <Flaeche>
              <div className="px-4 py-3">
              <KurzListe
                eintraege={[
                  ...rueckblick.meilensteine.map((meilenstein, index) => ({
                    schluessel: `m-${index}`,
                    icon: Trophy,
                    titel: meilenstein.titel,
                    zusatz: projekteAn ? meilenstein.projektName : null,
                  })),
                  ...rueckblick.erfolge.map((erfolg) => ({ schluessel: `e-${erfolg}`, icon: Award, titel: tx(erfolg), zusatz: null })),
                ]}
                anzahl={HOEHEPUNKTE_SICHTBAR}
                className="space-y-2 text-sm"
                darstellen={({ schluessel, icon: Symbol, titel, zusatz }) => (
                  <div key={schluessel} className="flex min-h-12 items-center gap-2">
                    <Symbol className="size-4 shrink-0 text-xp" />
                    <span className="min-w-0 truncate">{titel}</span>
                    {zusatz && <span className="shrink-0 text-xs text-leise">{zusatz}</span>}
                  </div>
                )}
              />
              </div>
              </Flaeche>
            </section>
          )}

          {rueckblick.attribute.length > 0 && (
            <section>
              <AbschnittKopf titel={tx("Gewachsen")} />
              <Flaeche>
                <div className="px-4 py-3">
              <BalkenListe
                werte={rueckblick.attribute.map((attribut) => ({
                  schluessel: attribut.attributId,
                  label: (
                    <>
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: attribut.farbe }} />
                      <span className="min-w-0 break-words">{attributName({ name: attribut.name })}</span>
                    </>
                  ),
                  wert: attribut.xp,
                  text: `${mitVorzeichen(attribut.xp)} XP`,
                  farbe: attribut.farbe,
                }))}
              />
                </div>
              </Flaeche>
            </section>
          )}

          <WochenZahlen rueckblick={rueckblick} />

          <RueckblickFormular key={rueckblick.woche} rueckblick={rueckblick} />
        </div>
      )}
    </div>
  );
}

function WochenZahlen({ rueckblick }: { rueckblick: Rueckblick }) {
  const trend = rueckblick.aktuelleWoche ? null : veraenderung(rueckblick.xp, rueckblick.xpVorwoche);
  return (
    <section>
      <AbschnittKopf titel={tx("Zahlen")} />
      <Flaeche>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 sm:grid-cols-4">
        <div>
          <p className="text-xl font-bold text-xp">+{zahl(rueckblick.xp)}</p>
          <p className="text-xs text-leise">XP{trend && ` · ${trend}`}</p>
        </div>
        <div>
          <p className="text-xl font-bold">{zahl(rueckblick.eintraege)}</p>
          <p className="text-xs text-leise">{tx("Einträge")}</p>
        </div>
        <div>
          <p className="text-xl font-bold">
            {rueckblick.aktiveTage}/{TAGE_PRO_WOCHE}
          </p>
          <p className="text-xs text-leise">{tx("Aktive Tage")}</p>
        </div>
        <div>
          <p className="text-xl font-bold">{rueckblick.besterTag ? zahl(rueckblick.besterTag.xp) : '–'}</p>
          <p className="truncate text-xs text-leise">
            {rueckblick.besterTag
              ? tx('Bester Tag · {datum}', { datum: datumLang(rueckblick.besterTag.datum) })
              : tx('Bester Tag')}
          </p>
        </div>
      </div>
      </Flaeche>
    </section>
  );
}

function RueckblickFormular({ rueckblick }: { rueckblick: Rueckblick }) {
  const queryClient = useQueryClient();
  const feiern = useFeiern();
  const [antworten, setAntworten] = useState<RueckblickAntworten>(rueckblick.antworten);
  const [leer, setLeer] = useState(false);
  const speichern = useMutation({
    mutationFn: () => api.speichereRueckblick(rueckblick.woche, antworten),
    onSuccess: (ergebnis) => {
      void queryClient.invalidateQueries();
      if (ergebnis.belohnung) {
        feiern(ergebnis.belohnung);
      }
    },
  });
  const geaendert =
    antworten.gut !== rueckblick.antworten.gut ||
    antworten.lernen !== rueckblick.antworten.lernen ||
    antworten.fokus !== rueckblick.antworten.fokus;

  const hatText =
    antworten.gut.trim() !== '' || antworten.lernen.trim() !== '' || antworten.fokus.trim() !== '';

  const absenden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (!hatText && !geaendert) {
      setLeer(true);
      return;
    }
    if (speichern.isPending) {
      return;
    }
    setLeer(false);
    speichern.mutate();
  };

  return (
    <section>
      <AbschnittKopf titel={tx("Reflexion")} />
      <Flaeche>
      <Formular className="p-4" onAbsenden={absenden}>
        {FRAGEN.map(({ feld, frage }) => (
          <Feld key={feld} label={frage} fehler={leer && feld === 'gut' ? 'Schreib zuerst eine Antwort.' : null}>
            <textarea
              className={`${EINGABE_STIL} min-h-20 resize-y`}
              maxLength={GRENZEN.notizMax}
              value={antworten[feld]}
              onChange={(ereignis) => {
                setLeer(false);
                setAntworten({ ...antworten, [feld]: ereignis.target.value });
              }}
            />
          </Feld>
        ))}
        <Fehlermeldung fehler={speichern.error} />
        <Knopf type="submit" variante="primaer" className="w-full" aria-busy={speichern.isPending || undefined}>
          {rueckblick.bonusMoeglich
            ? tx('Speichern · +{xp} {name}', {
                xp: zahl(RUECKBLICK.geistXp),
                name: attributName({ kennung: 'geist', name: 'Geist' }),
              })
            : tx('Speichern')}
        </Knopf>
      </Formular>
      </Flaeche>
    </section>
  );
}
