import { klassenText, tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';

import { useEffect, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import type { SchnellPunkt } from '../../schnell.ts';
import { SchnellZeile } from '../../components/SchnellAktion.tsx';
import { auswahlAus, gespeicherteRichtung, speichereRichtung, type VorbildAuswahl } from './vorbilderAuswahl.ts';
import { useVorbildFavoriten } from './favoritAktion.ts';
import {
  aehnlichkeit,
  besteAehnlichkeit,
  DURCHSCHNITT,
  richtungenMitPersonen,
  VORBILDER,
  type Vorbild,
} from '../../../../shared/features/vorbilder/index.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { KlassenBild } from '../../components/KlassenBild.tsx';
import { DichteZeilen, Liste, Zeile } from '../../components/Zeile.tsx';
import { AbschnittKopf, Chip, Fehlermeldung, Ladeanzeige } from '../../ui/index.ts';
import { prozentText, zahl } from '../../format.ts';
import { useFunktionen } from '../../funktionen.ts';
import { eigenesProfil, type EigenesProfil } from '../../pages/eigenesProfil.ts';
import { WerteHinweis } from './vorbildTeile.tsx';

const ALLE = 'alle';

interface VorbildAuswertung {
  vorbild: Vorbild;
  aehnlichkeit: number | null;
}

function auswerten(profil: EigenesProfil): VorbildAuswertung[] {
  return VORBILDER.map((vorbild) => ({
    vorbild,
    aehnlichkeit: aehnlichkeit(profil.level, vorbild.profil, vorbild.unsicher),
  })).sort((a, b) => (b.aehnlichkeit ?? -1) - (a.aehnlichkeit ?? -1));
}

/** Nur-Lesen, 48 px, in der eigenen Fläche. Die Klasse fehlt, wenn Können aus ist. */
function duZeile(level: number, klasse: string | null) {
  const basis = tx('Du · Level {level}', { level: zahl(level) });
  const text = klasse ? `${basis} · ${klassenText(klasse)}` : basis;
  return (
    <Liste>
      <Zeile
        typ="lesen"
        className="zahl"
        titel={text}
        name={text}
        symbol={klasse ? <KlassenBild klasse={klasse} groesse="size-5" rahmen={false} /> : undefined}
        symbolKlasse="pointer-events-none flex size-5 shrink-0 items-center justify-center"
      />
    </Liste>
  );
}

export function VorbilderSeite() {
  const funktionen = useFunktionen();
  const [params, setParams] = useSearchParams();
  const auswahl = auswahlAus(params.get('richtung'), gespeicherteRichtung());
  const setzeAuswahl = (naechste: VorbildAuswahl) => {
    speichereRichtung(naechste);
    const naechsteParams = new URLSearchParams(params);
    if (naechste === ALLE) {
      naechsteParams.delete('richtung');
    } else {
      naechsteParams.set('richtung', naechste);
    }
    setParams(naechsteParams, { replace: true });
  };
  useEffect(() => {
    speichereRichtung(auswahl);
    const parameter = params.get('richtung');
    const soll = auswahl === ALLE ? null : auswahl;
    if (parameter === soll) {
      return;
    }
    const naechste = new URLSearchParams(params);
    if (soll) {
      naechste.set('richtung', soll);
    } else {
      naechste.delete('richtung');
    }
    setParams(naechste, { replace: true });
  }, [auswahl, params, setParams]);
  const favoritenAktion = useVorbildFavoriten();
  const { data: attribute, error, isPending } = useQuery({ queryKey: SCHLUESSEL.attribute, queryFn: api.attribute });
  const { data: uebersicht } = useQuery({ queryKey: SCHLUESSEL.uebersicht, queryFn: api.uebersicht });
  const { data: einstellungen } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const profil = useMemo(
    () => eigenesProfil(attribute ?? [], { koennen: funktionen.koennen, status: funktionen.status }),
    [attribute, funktionen.koennen, funktionen.status],
  );
  const auswertungen = useMemo(() => auswerten(profil), [profil]);
  const massstab = auswertungen.find((eintrag) => eintrag.vorbild.schluessel === DURCHSCHNITT);
  const personen = auswertungen.filter((eintrag) => eintrag.vorbild.schluessel !== DURCHSCHNITT);
  const favoritenSchluessel = new Set(einstellungen?.vorbildFavoriten ?? []);
  const favoriten = personen.filter((eintrag) => favoritenSchluessel.has(eintrag.vorbild.schluessel));
  const sichtbar = personen.filter(
    (eintrag) => !favoritenSchluessel.has(eintrag.vorbild.schluessel) && (auswahl === ALLE || eintrag.vorbild.richtung === auswahl),
  );

  if (isPending) {
    return <Ladeanzeige />;
  }
  if (error) {
    return <Fehlermeldung fehler={error} />;
  }

  return (
    <DichteZeilen>
    <div>
      {uebersicht ? duZeile(uebersicht.level.level, funktionen.koennen ? uebersicht.klasse : null) : null}
      {favoriten.length > 0 && (
        <section>
          <AbschnittKopf titel={tx('Favoriten')} />
          <Liste>
            {favoriten.map((auswertung) => (
              <VorbildZeile
                key={auswertung.vorbild.schluessel}
                auswertung={auswertung}
                favorit
                onFavorit={() => favoritenAktion.weg(auswertung.vorbild.schluessel)}
              />
            ))}
          </Liste>
        </section>
      )}
      {massstab && (
        <Liste className="mt-6">
          <VorbildZeile auswertung={massstab} />
        </Liste>
      )}
      <div className="mt-4 min-w-0 overflow-x-auto overscroll-x-contain">
        <div className="flex w-max min-w-full gap-2 px-4 pb-1">
          <RichtungsChip
            label="Alle"
            aktiv={auswahl === ALLE}
            prozent={besteAehnlichkeit(personen.map((eintrag) => eintrag.aehnlichkeit))}
            onClick={() => setzeAuswahl(ALLE)}
          />
          {richtungenMitPersonen().map((richtung) => {
            const gruppe = personen.filter((eintrag) => eintrag.vorbild.richtung === richtung);
            return (
              <RichtungsChip
                key={richtung}
                label={richtung}
                aktiv={auswahl === richtung}
                prozent={besteAehnlichkeit(gruppe.map((eintrag) => eintrag.aehnlichkeit))}
                onClick={() => setzeAuswahl(richtung)}
              />
            );
          })}
        </div>
      </div>
      <section>
        <AbschnittKopf titel={tx('Ähnlich')} zusatz={<WerteHinweis name="Ähnlich" />} />
        <Liste>
          {sichtbar.map((auswertung) => (
            <VorbildZeile
              key={auswertung.vorbild.schluessel}
              auswertung={auswertung}
              onFavorit={() => favoritenAktion.dazu(auswertung.vorbild.schluessel)}
            />
          ))}
        </Liste>
      </section>
    </div>
    </DichteZeilen>
  );
}

function RichtungsChip({
  label,
  aktiv,
  prozent,
  onClick,
}: {
  label: string;
  aktiv: boolean;
  prozent: number | null;
  onClick: () => void;
}) {
  return (
    <Chip aktiv={aktiv} onClick={onClick} className="whitespace-nowrap">
      {tx(label)}
      {prozent !== null && <span className="zahl whitespace-nowrap"> {prozentText(prozent)}</span>}
    </Chip>
  );
}

function VorbildZeile({
  auswertung,
  favorit = false,
  onFavorit,
}: {
  auswertung: VorbildAuswertung;
  favorit?: boolean;
  onFavorit?: () => void;
}) {
  const name = tx(auswertung.vorbild.name);
  const wert =
    auswertung.aehnlichkeit !== null
      ? tx('{prozent} ähnlich', { prozent: prozentText(auswertung.aehnlichkeit) })
      : undefined;
  const zeile = (menue?: ReactNode) => (
    <Zeile nach={`/vorbilder/${auswertung.vorbild.schluessel}`} titel={name} name={name} wert={wert} menue={menue} />
  );
  if (!onFavorit) {
    return zeile();
  }
  const label = favorit ? 'Aus Favoriten entfernen' : 'Zu Favoriten';
  const punkt: SchnellPunkt = {
    art: 'archivieren',
    id: 'favorit',
    label,
    wisch: true,
    symbol: favorit ? 'stern-voll' : 'stern',
  };
  return (
    <SchnellZeile
      ziel={{ art: 'vorbild', id: 0, name }}
      hintergrund="bg-flaeche"
      eintraege={[punkt]}
      onEintrag={() => onFavorit()}
    >
      {(menue) => zeile(menue)}
    </SchnellZeile>
  );
}
