import { klassenText, tx } from '../../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookMarked, Flame, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { Attribut, Erschoepfung, HeatmapTag, VorhabenMitProjekt } from '../../../../shared/api/index.ts';
import { abzugNebenNamen, erschoepfungsBild } from '../../../../shared/spiel/belastung.ts';
import { TAGE_PRO_WOCHE } from '../../../../shared/spiel/datum.ts';
import { LEVEL_KURVEN, verlustBalken } from '../../../../shared/spiel/level.ts';
import { NEUER_ANLAUF, WEITERMACHEN } from '../../../../shared/spiel/xp.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { BossRing } from '../bosse/BossRing.tsx';
import { bossZeile } from '../../components/VorhabenInfo.tsx';
import { Abschnitt, KurzListe } from '../../components/Ausklappbar.tsx';
import { BasisKarte } from '../basis/Basis.tsx';
import { Heute } from './Heute.tsx';
import { useFeiern } from '../../components/Belohnung.tsx';
import { Icon } from '../../components/Icons.tsx';
import { useEintragOeffnen } from '../../components/Layout.tsx';
import {
  AllgemeinerXpAbzug,
  AttributBezeichnung,
  Fehlermeldung,
  Fortschrittsbalken,
  Karte,
  Knopf,
  Ladeanzeige,
  LevelRing,
  Ueberschrift,
} from '../../ui/index.ts';

import { ausTagesSchluessel, faktorText, kurzesDatum, monatKurz, zahl } from '../../format.ts';
import { useSichtbarkeit } from '../../funktionen.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';

const HEATMAP_STUFEN = [0.25, 0.5, 0.75, 1];
const WOCHENTAG_LABEL = ['Mo', '', 'Mi', '', 'Fr', '', ''];

export function UebersichtSeite() {
  const { data: uebersicht, error, isPending } = useQuery({ queryKey: SCHLUESSEL.uebersicht, queryFn: api.uebersicht });
  const sichtbarkeit = useSichtbarkeit();
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
    <div className="space-y-6">
      <Karte className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-5">
          <LevelRing level={uebersicht.level.level} anteil={uebersicht.level.fortschritt} />
          <div className="min-w-0 flex-1 sm:hidden">
            <h1 className="truncate text-2xl font-bold tracking-tight">{uebersicht.name}</h1>
            <p className="text-sm font-medium break-words text-akzent">{identitaet}</p>
            <p className="zahl text-sm text-leise break-words">{levelZeile}</p>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="hidden min-w-0 sm:block">
            <h1 className="truncate text-2xl font-bold tracking-tight">{uebersicht.name}</h1>
            <p className="text-sm font-medium break-words text-akzent">{identitaet}</p>
            <p className="zahl text-sm text-leise">{levelZeile}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Wochenwert label={tx("XP diese Woche")} wert={`+${zahl(uebersicht.wocheXp)}`} hervorheben />
            <Wochenwert
              label={tx("Streak")}
              wert={
                <span
                  className={`flex items-center justify-center gap-1 ${uebersicht.serie.angeknackst ? 'text-leise' : uebersicht.serie.laenge > 0 ? 'text-xp' : ''}`}
                  title={uebersicht.serie.angeknackst ? tx("Gestern ausgesetzt") : undefined}
                >
                  <Flame className="size-4" />
                  {uebersicht.serie.laenge}
                </span>
              }
            />
            <Wochenwert label={tx("Momentum")} wert={faktorText(uebersicht.momentum)} />
          </div>
        </div>
      </Karte>

      {uebersicht.level.xpGesamt === 0 && istAn('handbuch', sichtbarkeit) && (
        <Karte className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{tx("Willkommen bei Ascend")}</h2>
          </div>
          <Link
            to="/handbuch"
            className="knopf knopf-primaer inline-flex items-center gap-2 rounded-xl bg-akzent px-4 py-2.5 text-sm font-medium text-akzent-text"
          >
            <BookMarked className="size-4" />
            {tx("Zum Handbuch")}
          </Link>
        </Karte>
      )}

      {istAn('bossAngriffe', sichtbarkeit) && uebersicht.angriffe.length > 0 && (
        <Angriffe bosse={uebersicht.angriffe} projekteAn={istAn('projekte', sichtbarkeit)} />
      )}

      {istAn('vorhaben', sichtbarkeit) && uebersicht.comebacks.length > 0 && (
        <Comebacks comebacks={uebersicht.comebacks} projekteAn={istAn('projekte', sichtbarkeit)} />
      )}

      <Heute />
      {funktionen.basis && <BasisKarte />}

      {(funktionen.koennen || funktionen.status) && (
        <Abschnitt titel={tx("Werte")} kennung="uebersicht-werte" anfangEingeklappt>
          <div className="grid gap-4 md:grid-cols-2">
            {funktionen.koennen && (
              <Werte titel={tx("Können")} werte={uebersicht.attribute} erschoepfungen={uebersicht.erschoepfungen} />
            )}
            {funktionen.status && (
              <Werte titel={tx("Haben")} werte={uebersicht.status} erschoepfungen={uebersicht.erschoepfungen} />
            )}
          </div>
        </Abschnitt>
      )}

      <Abschnitt titel={tx("Aktivität")} kennung="uebersicht-aktivitaet" anfangEingeklappt>
        <Karte>
          <Heatmap tage={uebersicht.heatmap} />
        </Karte>
      </Abschnitt>
    </div>
  );
}

function Wochenwert({ label, wert, hervorheben = false }: { label: string; wert: ReactNode; hervorheben?: boolean }) {
  return (
    <div className="rounded-xl bg-flaeche-2 px-2 py-2">
      <p className={`zahl text-lg font-bold ${hervorheben ? 'text-xp' : ''}`}>{wert}</p>
      <p className="text-[11px] leading-tight text-leise">{label}</p>
    </div>
  );
}

function Angriffe({ bosse, projekteAn }: { bosse: VorhabenMitProjekt[]; projekteAn: boolean }) {
  return (
    <section>
      <Ueberschrift titel={tx("Bosse greifen an")} />
      <div className="space-y-2">
        {bosse.map((vorhaben) => {
          const klasse =
            'flex items-center gap-3 rounded-2xl border border-gefahr/40 bg-gefahr/5 px-4 py-3 transition hover:border-gefahr';
          const boss = vorhaben.boss;
          const inhalt = (
            <>
              {boss && <BossRing ring={boss.ring} erwacht />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{vorhaben.titel}</p>
                {projekteAn && vorhaben.projektName && <p className="truncate text-xs text-leise">{vorhaben.projektName}</p>}
                {boss && <p className="text-xs break-words text-leise">{bossZeile(boss)}</p>}
              </div>
              <span className="zahl shrink-0 text-sm font-semibold text-gefahr">−{zahl(boss?.angriffXp ?? 0)} {tx('Disziplin')}</span>
            </>
          );
          return projekteAn && vorhaben.projektId !== null ? (
            <Link key={vorhaben.id} to={`/projekte/${vorhaben.projektId}`} className={klasse}>
              {inhalt}
            </Link>
          ) : (
            <div key={vorhaben.id} className={klasse}>
              {inhalt}
            </div>
          );
        })}
      </div>
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
    <section>
      <Ueberschrift titel={tx("Zurück aufstehen")} />
      <div className="space-y-2">
        {comebacks.map((vorhaben) => (
          <Karte key={vorhaben.id} className="space-y-3">
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
              <Knopf variante="primaer" onClick={() => anlauf.mutate(vorhaben.id)} disabled={anlauf.isPending}>
                <RotateCcw className="size-4" />
                {tx('Neuer Anlauf · +{xp}', { xp: NEUER_ANLAUF.disziplin + NEUER_ANLAUF.geist })}
              </Knopf>
              {vorhaben.weitermachenOffen && (
                <Knopf
                  onClick={() =>
                    eintragOeffnen(
                      projekteAn && vorhaben.projektId !== null ? { projektId: vorhaben.projektId } : undefined,
                    )
                  }
                >
                  {tx('Weitermachen · +{xp}', { xp: WEITERMACHEN.disziplin + WEITERMACHEN.geist })}
                </Knopf>
              )}
            </div>
          </Karte>
        ))}
      </div>
      <Fehlermeldung fehler={anlauf.error} />
    </section>
  );
}

const WERTE_SICHTBAR = 5;

function Werte({
  titel,
  werte,
  erschoepfungen,
}: {
  titel: string;
  werte: Attribut[];
  erschoepfungen: Erschoepfung[];
}) {
  const bild = erschoepfungsBild(
    erschoepfungen.map((eintrag) => ({ quelleId: eintrag.attributId, zielId: eintrag.zielId, faktor: eintrag.faktor })),
  );
  return (
    <Karte>
      <Ueberschrift titel={titel} aktion={<AllgemeinerXpAbzug prozent={bild.allgemein} />} />
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
              <div className="flex items-center gap-2">
                <Icon name={attribut.icon} className="size-4 shrink-0" style={{ color: attribut.farbe }} />
                <AttributBezeichnung name={attribut.name} kennung={attribut.kennung} ursache={ursache} prozent={prozent} />
                <span className={`zahl shrink-0 whitespace-nowrap text-right text-xs ${ursache ? 'font-semibold text-gefahr' : 'text-leise'}`}>
                  {tx('Lvl {level}', { level: attribut.level.level })}
                </span>
              </div>
              <Fortschrittsbalken anteil={balken.stand} verlustBis={balken.verlustBis} farbe={attribut.farbe} hoehe="h-1.5" />
            </div>
          );
        }}
      />
    </Karte>
  );
}

function heatmapStufe(xp: number, maximum: number): number {
  if (xp <= 0 || maximum === 0) {
    return 0;
  }
  const anteil = xp / maximum;
  return HEATMAP_STUFEN.find((grenze) => grenze >= anteil) ?? 1;
}

function heatmapFarbe(stufe: number): string {
  return stufe === 0
    ? 'var(--flaeche-2)'
    : `color-mix(in srgb, var(--akzent) ${Math.round(stufe * 100)}%, var(--flaeche-2))`;
}

function inWochen(tage: HeatmapTag[]): (HeatmapTag | null)[][] {
  const erster = tage[0];
  const versatz = erster ? (ausTagesSchluessel(erster.datum).getDay() + TAGE_PRO_WOCHE - 1) % TAGE_PRO_WOCHE : 0;
  const zellen: (HeatmapTag | null)[] = [...new Array<null>(versatz).fill(null), ...tage];
  const wochen: (HeatmapTag | null)[][] = [];
  for (let index = 0; index < zellen.length; index += TAGE_PRO_WOCHE) {
    wochen.push(zellen.slice(index, index + TAGE_PRO_WOCHE));
  }
  return wochen;
}

function monatsBeschriftungen(wochen: (HeatmapTag | null)[][]): string[] {
  let letzterMonat = -1;
  return wochen.map((woche) => {
    const tag = woche.find((zelle) => zelle !== null);
    if (!tag) {
      return '';
    }
    const datum = ausTagesSchluessel(tag.datum);
    if (datum.getMonth() === letzterMonat) {
      return '';
    }
    letzterMonat = datum.getMonth();
    return monatKurz(datum);
  });
}

function Heatmap({ tage }: { tage: HeatmapTag[] }) {
  let maximum = 0;
  for (const tag of tage) {
    maximum = Math.max(maximum, tag.xp);
  }
  const wochen = inWochen(tage);
  const monate = monatsBeschriftungen(wochen);

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-2">
        <div
          className="inline-grid gap-[2px] text-[10px] leading-none text-leise"
          style={{ gridTemplateColumns: `auto repeat(${wochen.length}, minmax(0.75rem, 1.25rem))` }}
        >
          <span />
          {monate.map((monat, index) => (
            <span key={`monat-${index}`} className="h-3 w-0 overflow-visible whitespace-nowrap">
              {monat}
            </span>
          ))}
          {WOCHENTAG_LABEL.map((label, zeile) => (
            <HeatmapZeile key={zeile} label={label ? tx(label) : ''} wochen={wochen} zeile={zeile} maximum={maximum} />
          ))}
        </div>
        <div className="flex items-center justify-end gap-[2px] text-[10px] text-leise">
          <span className="mr-1">{tx("Weniger")}</span>
          {[0, ...HEATMAP_STUFEN].map((stufe) => (
            <span key={stufe} className="size-2.5 rounded-[3px]" style={{ backgroundColor: heatmapFarbe(stufe) }} />
          ))}
          <span className="ml-1">{tx("Mehr")}</span>
        </div>
      </div>
    </div>
  );
}

function HeatmapZeile({
  label,
  wochen,
  zeile,
  maximum,
}: {
  label: string;
  wochen: (HeatmapTag | null)[][];
  zeile: number;
  maximum: number;
}) {
  return (
    <>
      <span className="flex items-center pr-1.5">{label}</span>
      {wochen.map((woche, spalte) => {
        const tag = woche[zeile] ?? null;
        if (tag === null) {
          return <span key={`leer-${spalte}`} />;
        }
        return (
          <span
            key={tag.datum}
            title={`${kurzesDatum(`${tag.datum}T12:00:00`)}: ${zahl(tag.xp)} XP`}
            className="aspect-square rounded-[3px]"
            style={{ backgroundColor: heatmapFarbe(heatmapStufe(tag.xp, maximum)) }}
          />
        );
      })}
    </>
  );
}
