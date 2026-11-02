import { klassenText, tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
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
  RICHTUNGEN,
  VORBILDER,
  type Vorbild,
} from '../../../../shared/features/vorbilder/index.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { KlassenBild } from '../../components/KlassenBild.tsx';
import { Liste, Zeile } from '../../components/Zeile.tsx';
import { Chip, Fehlermeldung, Ladeanzeige } from '../../ui/index.ts';
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
    <div className="space-y-4">
      {uebersicht && (
        <p className="inline-flex min-w-0 items-center gap-1.5 text-sm text-leise">
          {funktionen.koennen && <KlassenBild klasse={uebersicht.klasse} groesse="size-4" rahmen={false} />}
          <span className="zahl min-w-0 break-words">
            {tx('Du · Level {level}', { level: zahl(uebersicht.level.level) })}
            {funktionen.koennen && ` · ${klassenText(uebersicht.klasse)}`}
          </span>
        </p>
      )}
      {favoriten.length > 0 && (
        <section>
          <div className="mb-2 flex items-center">
            <h2 className="ueberschrift abschnittskopf min-w-0 text-[13px] leading-[18px] font-semibold tracking-normal text-leise normal-case">
              {tx('Favoriten')}
            </h2>
          </div>
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
        <Liste>
          <VorbildZeile auswertung={massstab} />
        </Liste>
      )}
      <div className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1">
        <RichtungsChip
          label="Alle"
          aktiv={auswahl === ALLE}
          prozent={besteAehnlichkeit(personen.map((eintrag) => eintrag.aehnlichkeit))}
          onClick={() => setzeAuswahl(ALLE)}
        />
        {RICHTUNGEN.map((richtung) => {
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
      <section>
        <div className="mb-2 flex items-center">
          <h2 className="ueberschrift abschnittskopf min-w-0 text-[13px] leading-[18px] font-semibold tracking-normal text-leise normal-case">
            {tx("Ähnlich")}
          </h2>
          <WerteHinweis />
        </div>
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
      {aktiv ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : null}
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
  const zeile = (rechts?: ReactNode) => (
    <Zeile nach={`/vorbilder/${auswertung.vorbild.schluessel}`} titel={name} name={name} wert={wert} rechts={rechts} />
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
