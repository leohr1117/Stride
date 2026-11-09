import { klassenText, tx } from '../../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Flame, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { WillkommenKarte } from './Willkommen.tsx';
import { Heatmap } from './Heatmap.tsx';
import type { Attribut, Erschoepfung, VorhabenMitProjekt } from '../../../../shared/api/index.ts';
import { abzugNebenNamen, erschoepfungsBild } from '../../../../shared/spiel/belastung.ts';
import { LEVEL_KURVEN, verlustBalken } from '../../../../shared/spiel/level.ts';
import { NEUER_ANLAUF, WEITERMACHEN } from '../../../../shared/spiel/xp.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { BossRing, bossListenEinzug } from '../bosse/BossRing.tsx';
import { bossSeit } from '../../components/VorhabenInfo.tsx';
import { Abschnitt, KurzListe } from '../../components/Ausklappbar.tsx';
import { DichteZeilen, Zeile } from '../../components/Zeile.tsx';
import { BasisKarte } from '../basis/Basis.tsx';
import { useFeiern } from '../../components/Belohnung.tsx';
import { Icon } from '../../components/Icons.tsx';
import { useEintragOeffnen } from '../../components/Layout.tsx';
import {
  AbschnittKopf,
  AllgemeinerXpAbzug,
  AttributBezeichnung,
  Fehlermeldung,
  Flaeche,
  Fortschrittsbalken,
  InfoHinweis,
  Knopf,
  Ladeanzeige,
  LevelRing,
} from '../../ui/index.ts';
import { InstallBanner } from '../../installHinweis.tsx';
import { BewertungKarte } from './Bewertung.tsx';
import { HeuteKarte } from './Heute.tsx';
import { HinweisAngebot } from './HinweisAngebot.tsx';

import { faktorText, kurzesDatum, zahl } from '../../format.ts';
import { useSichtbarkeit, useUebersichtKarten } from '../../funktionen.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { karteGewaehlt } from '../../../../shared/spiel/uebersichtKarten.ts';

const WERTE_SICHTBAR = 5;
const BOSS_SYMBOL = 'pointer-events-none flex shrink-0 items-center justify-center';

export function UebersichtSeite() {
  const { data: uebersicht, error, isPending } = useQuery({ queryKey: SCHLUESSEL.uebersicht, queryFn: api.uebersicht });
  const kette = useQuery({ queryKey: SCHLUESSEL.ketteHeute, queryFn: api.ketteHeute, retry: false });
  const sichtbarkeit = useSichtbarkeit();
  const karten = useUebersichtKarten();
  const funktionen = sichtbarkeit.funktionen;

  if (isPending) {
    return <Ladeanzeige />;
  }
  if (error) {
    return <Fehlermeldung fehler={error} />;
  }
  const klasseAnzeige = klassenText(uebersicht.klasse);
  const identitaet = uebersicht.titel ? `${klasseAnzeige} · ${uebersicht.titel}` : klasseAnzeige;
  const levelZeile = tx('{xp} XP · noch {rest} bis Level {level}', {
    xp: zahl(uebersicht.level.xpGesamt),
    rest: zahl(uebersicht.level.xpFuerNaechstes - uebersicht.level.xpImLevel),
    level: uebersicht.level.level + 1,
  });

  return (
    <div>
      <div className="space-y-6">
        <WillkommenKarte xp={uebersicht.level.xpGesamt} />

        {karteGewaehlt('identitaet', karten) && (
          <Flaeche className="identitaets-flaeche p-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <LevelRing level={uebersicht.level.level} anteil={uebersicht.level.fortschritt} groesse={104} />
                <div className="min-w-0 flex-1">
                  <p className="kopfblock-name truncate text-2xl font-bold tracking-tight">{uebersicht.name}</p>
                  <p className="text-[13px] leading-[18px] break-words text-leise">{identitaet}</p>
                  <p className="zahl text-[13px] leading-[18px] break-words text-leise" data-xp-zeile="">
                    {levelZeile}
                  </p>
                </div>
              </div>
              <div className="grid min-w-0" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <Wochenwert label={tx('XP diese Woche')} wert={`+${zahl(uebersicht.wocheXp)}`} hervorheben="fortschritt" />
                <Wochenwert
                  label={tx('Streak')}
                  info={
                    <InfoHinweis
                      name="Streak"
                      text="Ein Tag Pause ist frei. Danach ist der Streak angeschlagen."
                      abstand={false}
                      amKasten
                      knopfKlasse={INFO_NEBEN_WORT}
                    />
                  }
                  wert={
                    <span
                      className={`flex items-center justify-center gap-1 ${kette.data?.rueckkehr || uebersicht.serie.angeknackst ? 'text-leise' : uebersicht.serie.laenge > 0 ? 'text-streak' : ''}`}
                      title={uebersicht.serie.angeknackst ? tx('Gestern ausgesetzt') : undefined}
                    >
                      <Flame className="size-4" />
                      {uebersicht.serie.laenge}
                    </span>
                  }
                />
                <Wochenwert label={tx('Momentum')} wert={faktorText(uebersicht.momentum)} />
              </div>
            </div>
          </Flaeche>
        )}

        <BewertungKarte />
        <HinweisAngebot />
        <InstallBanner />
      </div>

      <HeuteKarte />

      {karteGewaehlt('bosse', karten) && istAn('bossAngriffe', sichtbarkeit) && uebersicht.angriffe.length > 0 && (
        <Angriffe
          bosse={uebersicht.angriffe}
          projekteAn={istAn('projekte', sichtbarkeit)}
          laufendAn={istAn('laufend', sichtbarkeit)}
        />
      )}

      {karteGewaehlt('comeback', karten) && istAn('vorhaben', sichtbarkeit) && uebersicht.comebacks.length > 0 && (
        <Comebacks comebacks={uebersicht.comebacks} projekteAn={istAn('projekte', sichtbarkeit)} />
      )}

      {karteGewaehlt('basis', karten) && funktionen.basis && <BasisKarte />}

      {karteGewaehlt('werte', karten) && (funktionen.koennen || funktionen.status) && (
        <div className="inhalt-max">
          <Abschnitt titel={tx('Werte')} kennung="uebersicht-werte" anfangEingeklappt kopfKlasse="abschnitt-kopf">
            <Flaeche>
              <div className="grid md:grid-cols-2">
                {funktionen.koennen && (
                  <Werte
                    kennung="koennen"
                    titel={tx('Können')}
                    pfad="/koennen"
                    werte={uebersicht.attribute}
                    erschoepfungen={uebersicht.erschoepfungen}
                  />
                )}
                {funktionen.status && (
                  <Werte
                    kennung="haben"
                    titel={tx('Haben')}
                    pfad="/haben"
                    trennung={funktionen.koennen}
                    werte={uebersicht.status}
                    erschoepfungen={uebersicht.erschoepfungen}
                  />
                )}
              </div>
            </Flaeche>
          </Abschnitt>
        </div>
      )}

      {karteGewaehlt('aktivitaet', karten) && (
        <div className="inhalt-max">
          <Abschnitt titel={tx('Aktivität')} kennung="uebersicht-aktivitaet" anfangEingeklappt kopfKlasse="abschnitt-kopf">
            <Flaeche className="p-4">
              <Heatmap tage={uebersicht.heatmap} />
            </Flaeche>
          </Abschnitt>
        </div>
      )}
    </div>
  );
}

const INFO_NEBEN_WORT =
  "relative inline-flex size-4 shrink-0 items-center justify-center rounded-full text-leise hover:text-haupt before:absolute before:-inset-4 before:content-['']";

function Wochenwert({
  label,
  wert,
  hervorheben,
  info,
}: {
  label: string;
  wert: ReactNode;
  hervorheben?: 'fortschritt';
  info?: ReactNode;
}) {
  return (
    <div
      className="relative min-w-0 border-e border-transparent py-2 ps-[8.5px] pe-[7.5px] text-center last:border-e-0 last:ps-2 last:pe-2 [&:last-child>[data-kennzahl-trenner]]:hidden"
      data-wochenwert={label}
      data-info-kasten
    >
      <span aria-hidden="true" data-kennzahl-trenner="" className="pointer-events-none absolute inset-y-0 end-[-1.5px] w-px bg-rand" />
      <p className={`zahl text-center text-lg font-bold ${hervorheben === 'fortschritt' ? 'text-fortschritt' : ''}`}>{wert}</p>
      {info ? (
        <p className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center text-center text-[11px] leading-tight text-leise">
          <span aria-hidden="true" />
          <span>{label}</span>
          <span className="relative min-w-0">
            <span className="absolute start-0 top-1/2 z-10 ms-1 flex -translate-y-1/2">{info}</span>
          </span>
        </p>
      ) : (
        <p className="text-center text-[11px] leading-tight text-leise">{label}</p>
      )}
    </div>
  );
}

function Angriffe({
  bosse,
  projekteAn,
  laufendAn,
}: {
  bosse: VorhabenMitProjekt[];
  projekteAn: boolean;
  laufendAn: boolean;
}) {
  return (
    <section className="inhalt-max">
      <AbschnittKopf
        titel={tx('Bosse greifen an')}
        aktion={
          laufendAn ? (
            <Link to="/laufend" className="inline-flex items-center text-[13px] font-semibold leading-[18px]">
              {tx('Laufend')}
              <ChevronRight className="size-4 shrink-0" aria-hidden />
            </Link>
          ) : undefined
        }
      />
      <Flaeche className="symbol-liste">
        <DichteZeilen>
          {bosse.map((vorhaben) => {
            const boss = vorhaben.boss;
            const projekt = projekteAn ? vorhaben.projektName : null;
            const neben = [projekt, boss ? bossSeit(boss) : null].filter((teil) => teil).join(' · ');
            const ziel = projekteAn && vorhaben.projektId !== null ? `/projekte/${vorhaben.projektId}` : undefined;
            return (
              <Zeile
                key={vorhaben.id}
                titel={vorhaben.titel}
                neben={neben || undefined}
                pfeil={false}
                nach={ziel}
                symbol={
                  boss ? <BossRing ring={boss.ring} erwacht={boss.phase === 'erwacht'} /> : undefined
                }
                symbolKlasse={BOSS_SYMBOL}
                listenEinzug={boss ? bossListenEinzug() : undefined}
                wert={
                  <span className="font-semibold text-gefahr">
                    −{zahl(boss?.angriffXp ?? 0)} {tx('Disziplin')}
                  </span>
                }
              />
            );
          })}
        </DichteZeilen>
      </Flaeche>
    </section>
  );
}

function Comebacks({ comebacks, projekteAn }: { comebacks: VorhabenMitProjekt[]; projekteAn: boolean }) {
  const queryClient = useQueryClient();
  const feiern = useFeiern();
  const eintragOeffnen = useEintragOeffnen();
  const anlauf = useMutation({
    mutationFn: (id: number) => api.starteNeuenAnlauf(id),
    onSuccess: (ergebnis) => {
      void queryClient.invalidateQueries();
      feiern(ergebnis.belohnung);
    },
  });

  return (
    <section className="inhalt-max">
      <AbschnittKopf titel={tx('Zurück aufstehen')} />
      <Flaeche>
        {comebacks.map((vorhaben) => (
          <div key={vorhaben.id} className="space-y-3 px-4 py-3">
            <div>
              <p className="font-medium">{vorhaben.titel}</p>
              {((projekteAn && vorhaben.projektName) || vorhaben.abgeschlossenAm) && (
                <p className="text-xs text-leise">
                  {[projekteAn ? vorhaben.projektName : null, vorhaben.abgeschlossenAm ? kurzesDatum(vorhaben.abgeschlossenAm) : null]
                    .filter((teil) => teil)
                    .join(' · ')}
                </p>
              )}
              {vorhaben.erkenntnis && (
                <p className="mt-2 text-sm break-words">
                  <span className="text-leise">{tx('Mitgenommen:')} </span>
                  {vorhaben.erkenntnis}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Knopf variante="primaer" onClick={() => anlauf.mutate(vorhaben.id)} aria-busy={anlauf.isPending || undefined}>
                <RotateCcw className="size-4" />
                {tx('Neuer Anlauf · +{xp}', { xp: NEUER_ANLAUF.disziplin + NEUER_ANLAUF.geist })}
              </Knopf>
              {vorhaben.weitermachenOffen && (
                <Knopf
                  onClick={() =>
                    eintragOeffnen(projekteAn && vorhaben.projektId !== null ? { projektId: vorhaben.projektId } : undefined)
                  }
                >
                  {tx('Weitermachen · +{xp}', { xp: WEITERMACHEN.disziplin + WEITERMACHEN.geist })}
                </Knopf>
              )}
            </div>
          </div>
        ))}
      </Flaeche>
      <Fehlermeldung fehler={anlauf.error} />
    </section>
  );
}

function Werte({
  kennung,
  titel,
  pfad,
  werte,
  erschoepfungen,
  trennung = false,
}: {
  kennung: 'koennen' | 'haben';
  titel: string;
  pfad: string;
  werte: Attribut[];
  erschoepfungen: Erschoepfung[];
  trennung?: boolean;
}) {
  const bild = erschoepfungsBild(
    erschoepfungen.map((eintrag) => ({ quelleId: eintrag.attributId, zielId: eintrag.zielId, faktor: eintrag.faktor })),
  );
  const rand = trennung ? 'relative border-t border-rand md:border-t-0' : '';
  return (
    <div data-werte={kennung} className={`min-w-0 p-4 ${rand}`}>
      {trennung ? (
        <span className="pointer-events-none absolute inset-y-0 start-0 hidden w-px bg-rand md:block" aria-hidden="true" />
      ) : null}
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="ueberschrift abschnittskopf min-w-0 text-[13px] font-semibold leading-[18px] tracking-normal text-leise normal-case">
          <Link to={pfad} className="inline-flex items-center">
            {titel}
            <ChevronRight className="size-4 shrink-0" aria-hidden />
          </Link>
        </h2>
        <AllgemeinerXpAbzug prozent={bild.allgemein} />
      </div>
      <KurzListe
        eintraege={werte}
        anzahl={WERTE_SICHTBAR}
        className="space-y-3"
        darstellen={(attribut) => {
          const ursache = bild.ursachen.includes(attribut.id);
          const prozent = abzugNebenNamen(bild, attribut.id);
          const hoechstXp = Number.isFinite(attribut.hoechstXp) ? attribut.hoechstXp : attribut.level.xpGesamt;
          const balken = verlustBalken(attribut.level.xpGesamt, hoechstXp, LEVEL_KURVEN[attribut.typ]);
          return (
            <div key={attribut.id} className="space-y-1.5">
              <div className="flex items-start gap-2">
                <Icon name={attribut.icon} className="mt-0.5 size-4 shrink-0" style={{ color: attribut.farbe }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <AttributBezeichnung
                      name={attribut.name}
                      kennung={attribut.kennung}
                      prozent={prozent}
                      zuNiedrig={ursache}
                    />
                    <span className={`zahl shrink-0 whitespace-nowrap text-right text-xs ${ursache ? 'text-gefahr' : 'text-leise'}`}>
                      {tx('Lvl {level}', { level: attribut.level.level })}
                    </span>
                  </div>
                </div>
              </div>
              <Fortschrittsbalken anteil={balken.stand} verlustBis={balken.verlustBis} farbe={attribut.farbe} hoehe="h-1.5" />
            </div>
          );
        }}
      />
    </div>
  );
}
