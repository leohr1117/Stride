import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useParams } from 'react-router';
import { attributVorlage } from '../../../../shared/features/attribute/attributKatalog.ts';
import type { AttributKennung } from '../../../../shared/spiel/begriffe.ts';
import { hoechsteStufe } from '../../../../shared/spiel/erfolge.ts';
import { MIN_RADAR_ACHSEN, achsenMaximum } from '../../../../shared/spiel/radar.ts';
import {
  aehnlichkeit,
  DURCHSCHNITT,
  findeVorbild,
  klasseAus,
  staerken,
  vergleichspunkte,
  type Vergleichspunkt,
  type Vorbild,
} from '../../../../shared/features/vorbilder/index.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useKopf } from '../../components/Kopf.tsx';
import { Zeile } from '../../components/Zeile.tsx';
import { KlassenBild } from '../../components/KlassenBild.tsx';
import type { LebenswegPunkt } from '../../components/LebenswegDiagramm.tsx';
import { LebenswegDiagramm, ProfilRadar } from '../../components/mitDiagramm.tsx';
import { Fehlermeldung, Karte, Ladeanzeige, Ueberschrift } from '../../ui/index.ts';
import { prozentText, zahl } from '../../format.ts';
import { useFunktionen } from '../../funktionen.ts';
import { attributName, klassenText, tx } from '../../text.ts';
import { eigenesProfil } from '../../pages/eigenesProfil.ts';
import { Legende, WerteHinweis } from './vorbildTeile.tsx';

const ANZAHL_STAERKEN = 3;

function lebensdaten(vorbild: Vorbild): string | null {
  if (vorbild.geboren === null) {
    return null;
  }
  return vorbild.gestorben === null
    ? tx('geboren {jahr}', { jahr: vorbild.geboren })
    : tx('{von} bis {bis}', { von: vorbild.geboren, bis: vorbild.gestorben });
}

function lebensweg(vorbild: Vorbild, durchschnitt: Vorbild | undefined, du: LebenswegPunkt | null): LebenswegPunkt[] {
  const punkte = new Map<number, LebenswegPunkt>();
  const setze = (alter: number, werte: Partial<LebenswegPunkt>) => {
    punkte.set(alter, { ...(punkte.get(alter) ?? { alter }), ...werte });
  };
  for (const station of vorbild.verlauf) {
    setze(station.alter, { vorbild: station.level, ereignis: station.ereignis });
  }
  if (durchschnitt && durchschnitt.schluessel !== vorbild.schluessel) {
    for (const station of durchschnitt.verlauf) {
      setze(station.alter, { durchschnitt: station.level });
    }
  }
  if (du) {
    setze(du.alter, { du: du.du });
  }
  return [...punkte.values()].sort((a, b) => a.alter - b.alter);
}

function Balken({ anteil, farbe }: { anteil: number; farbe: string }) {
  const breite = Math.min(1, Math.max(0, anteil)) * 100;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-flaeche-2">
      {breite > 0 && <div className="h-full rounded-full" style={{ width: `${breite}%`, backgroundColor: farbe }} />}
    </div>
  );
}

function VergleichListe({
  punkte,
  maximum,
  namen,
  person,
}: {
  punkte: Vergleichspunkt[];
  maximum: number;
  namen: (kennung: AttributKennung) => string;
  person: string;
}) {
  return (
    <ul className="space-y-3">
      {punkte.map((punkt) => (
        <li key={punkt.kennung} data-kennung={punkt.kennung} data-du={punkt.du} data-vorbild={punkt.vorbild} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 break-words">{attributName({ kennung: punkt.kennung, name: namen(punkt.kennung) })}</span>
            <span className="zahl shrink-0 font-medium">{prozentText(punkt.anteil)}</span>
          </div>
          <Balken anteil={punkt.du / maximum} farbe="var(--akzent)" />
          <Balken anteil={punkt.vorbild / maximum} farbe="var(--diagramm-vorbild)" />
          <p className="text-xs text-leise break-words">
            {tx('Du')} {tx('Lvl {level}', { level: zahl(punkt.du) })}
            {' · '}
            {person} {tx('Lvl {level}', { level: zahl(punkt.vorbild) })}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function VorbildProfilSeite() {
  const vorbild = findeVorbild(useParams().schluessel ?? '');
  const funktionen = useFunktionen();
  const { data: attribute, error, isPending } = useQuery({ queryKey: SCHLUESSEL.attribute, queryFn: api.attribute });
  const { data: uebersicht } = useQuery({ queryKey: SCHLUESSEL.uebersicht, queryFn: api.uebersicht });
  const { data: einstellungen } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const profil = useMemo(
    () => eigenesProfil(attribute ?? [], { koennen: funktionen.koennen, status: funktionen.status }),
    [attribute, funktionen.koennen, funktionen.status],
  );
  useKopf(vorbild ? { titel: tx(vorbild.name), roh: true } : null);
  if (!vorbild) {
    return <Fehlermeldung fehler={new Error(tx('Dieses Vorbild gibt es nicht.'))} />;
  }
  if (isPending) {
    return <Ladeanzeige />;
  }
  if (error) {
    return <Fehlermeldung fehler={error} />;
  }

  const eigenesAlter = einstellungen?.geburtsjahr ? new Date().getFullYear() - einstellungen.geburtsjahr : null;
  const duPunkt = eigenesAlter !== null && uebersicht ? { alter: eigenesAlter, du: uebersicht.level.level } : null;
  const daten = lebensweg(vorbild, findeVorbild(DURCHSCHNITT), duPunkt);
  const titel = hoechsteStufe('level', vorbild.level);
  const punkte = vergleichspunkte(profil.level, vorbild, profil.kennungen);
  const maximum = achsenMaximum(punkte.flatMap((punkt) => [punkt.du, punkt.vorbild]));
  const wert = aehnlichkeit(profil.level, vorbild.profil, vorbild.unsicher);
  const name = (kennung: AttributKennung) => profil.namen.get(kennung) ?? attributVorlage(kennung).name;
  const klasse = klasseAus(vorbild.schaetzung);
  const legende = [
    { name: tx(vorbild.name), farbe: 'var(--diagramm-vorbild)' },
    ...(vorbild.schluessel !== DURCHSCHNITT ? [{ name: tx('Durchschnitt'), farbe: 'var(--leise)' }] : []),
    ...(duPunkt ? [{ name: tx('Du'), farbe: 'var(--akzent)' }] : []),
  ];
  const staerkeListe = staerken(vorbild.profil, profil.kennungen, ANZAHL_STAERKEN)
    .map((kennung) => attributName({ kennung, name: name(kennung) }))
    .join(', ');

  return (
    <div className="space-y-6">
      <Karte className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 sm:flex-1">
            <span className="profil-name min-w-0 break-words text-[1.05rem] leading-tight font-bold sm:text-2xl">
              {tx(vorbild.name)}
            </span>
            <p className="break-words text-sm text-leise">
              {tx(vorbild.bekanntFuer)}
              {lebensdaten(vorbild) && ` · ${lebensdaten(vorbild)}`}
            </p>
          </div>
          <div className="shrink-0 self-end text-right sm:self-start">
            <p className="text-3xl leading-tight font-bold break-words">{tx('Lvl {level}', { level: zahl(vorbild.level) })}</p>
            <p className="inline-flex items-center justify-end gap-1.5 text-sm font-medium text-akzent">
              <KlassenBild klasse={klasse} groesse="size-5" rahmen={false} />
              {klassenText(klasse)}
            </p>
            {titel && <p className="text-xs text-xp">{tx(titel)}</p>}
          </div>
        </div>
        {wert !== null && (
          <p data-aehnlichkeit="" className="text-3xl leading-none font-bold text-akzent">
            {tx('{prozent} ähnlich', { prozent: prozentText(wert) })}
          </p>
        )}
        <p className="text-sm leading-relaxed">{tx(vorbild.beschreibung)}</p>
      </Karte>

      {staerkeListe ? (
        <section>
          <Ueberschrift titel={tx('Stärken')} />
          <p className="text-sm break-words">{staerkeListe}</p>
        </section>
      ) : null}

      {punkte.length > 0 && (
        <div data-vergleich="" data-achsen-max={maximum}>
          <Karte className="space-y-3">
            <div className="mb-2 flex items-center">
              <h2 className="ueberschrift abschnittskopf min-w-0 text-[13px] leading-[18px] font-semibold tracking-normal text-leise normal-case">
                {tx('Profil im Vergleich')}
              </h2>
              <WerteHinweis />
            </div>
            {punkte.length >= MIN_RADAR_ACHSEN && (
              <ProfilRadar
                person={tx(vorbild.name)}
                zeilen={punkte.map((punkt) => ({
                  name: attributName({ kennung: punkt.kennung, name: name(punkt.kennung) }),
                  du: punkt.du,
                  vorbild: punkt.vorbild,
                }))}
                maximum={maximum}
                hoehe="h-72"
              />
            )}
            <VergleichListe punkte={punkte} maximum={maximum} namen={name} person={tx(vorbild.name)} />
            <Legende
              eintraege={[
                { name: tx('Du'), farbe: 'var(--akzent)' },
                { name: tx(vorbild.name), farbe: 'var(--diagramm-vorbild)' },
              ]}
            />
          </Karte>
        </div>
      )}

      <Karte className="space-y-3">
        <Ueberschrift titel={tx('Lebensweg')} />
        {einstellungen && einstellungen.geburtsjahr === null ? (
          <Zeile className="-mx-4 border-t border-rand" titel={tx('Geburtsjahr')} wert={tx('Jahr eintragen')} nach="/mehr/profil/jahr" />
        ) : null}
        <LebenswegDiagramm daten={daten} name={tx(vorbild.name)} />
        <Legende eintraege={legende} />
        <ul className="divide-y divide-rand border-t border-rand text-sm">
          {vorbild.verlauf.map((station) => (
            <li key={station.alter} className="flex items-baseline gap-3 py-2">
              <span className="zahl w-14 shrink-0 text-xs text-leise">{tx('{alter} Jahre', { alter: station.alter })}</span>
              <span className="min-w-0 flex-1 break-words">{tx(station.ereignis)}</span>
              <span className="zahl shrink-0 whitespace-nowrap text-xs text-leise">{tx('Lvl {level}', { level: zahl(station.level) })}</span>
            </li>
          ))}
        </ul>
      </Karte>
    </div>
  );
}
