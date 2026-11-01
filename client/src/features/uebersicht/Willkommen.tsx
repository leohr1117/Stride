import { tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { Faehigkeit } from '../../../../shared/api/faehigkeiten.ts';
import type { Vorlage } from '../../../../shared/api/taetigkeiten.ts';
import type { Projekt, Vision, Vorhaben, Ziele } from '../../../../shared/api/ziele.ts';
import {
  startZielArt,
  willkommensZeilen,
  type PfadStand,
  type WillkommenZeile,
} from '../../../../shared/features/handbuch/handbuchPfad.ts';
import { standardEbenen } from '../../../../shared/spiel/ebenen.ts';
import { standardFunktionen } from '../../../../shared/spiel/funktionen.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useEintragOeffnen } from '../../components/Layout.tsx';
import { Zeile } from '../../components/Zeile.tsx';
import { useSichtbarkeit } from '../../funktionen.ts';
import { Karte } from '../../ui/index.ts';

const ZIEL_OFFEN = {
  visionen: 'Vision anlegen',
  projekte: 'Projekt anlegen',
  vorhaben: 'Vorhaben anlegen',
} as const;

const ZIEL_NAME = {
  visionen: 'Vision „{name}"',
  projekte: 'Projekt „{name}"',
  vorhaben: 'Vorhaben „{name}"',
} as const;

function erster<T extends { id: number }>(liste: readonly T[], name: (eintrag: T) => string): string | null {
  const reihe = [...liste].sort((a, b) => a.id - b.id);
  const gewaehlt = reihe.find((eintrag) => !('archiviert' in eintrag && eintrag.archiviert)) ?? reihe[0];
  return gewaehlt ? name(gewaehlt) : null;
}

function zielName(art: 'visionen' | 'projekte' | 'vorhaben', ziele: Ziele): string | null {
  if (art === 'visionen') {
    return erster(ziele.visionen, (vision: Vision) => vision.titel);
  }
  if (art === 'projekte') {
    return erster(ziele.projekte, (projekt: Projekt) => projekt.name);
  }
  return erster(ziele.vorhaben, (vorhaben: Vorhaben) => vorhaben.titel);
}

export function WillkommenKarte({ xp }: { xp: number }) {
  const sichtbar = useSichtbarkeit();
  const an = xp === 0;
  const art = startZielArt(sichtbar.ebenen, sichtbar.funktionen);
  const { data: vorlagen } = useQuery({ queryKey: SCHLUESSEL.vorlagen, queryFn: api.vorlagen, enabled: an });
  const { data: ziele } = useQuery({
    queryKey: SCHLUESSEL.ziele,
    queryFn: api.ziele,
    enabled: an && art !== null && art !== 'faehigkeit',
  });
  const { data: faehigkeiten } = useQuery({
    queryKey: SCHLUESSEL.faehigkeiten,
    queryFn: api.faehigkeiten,
    enabled: an && art === 'faehigkeit',
  });
  const { data: erfolge } = useQuery({ queryKey: SCHLUESSEL.erfolge, queryFn: api.erfolge, enabled: an });
  const eintragOeffnen = useEintragOeffnen();
  const navigiere = useNavigate();

  if (!an) {
    return null;
  }
  const wartetAufZiel = art !== null && art !== 'faehigkeit' && !ziele;
  const wartetAufFaehigkeit = art === 'faehigkeit' && !faehigkeiten;
  if (!vorlagen || !erfolge || wartetAufZiel || wartetAufFaehigkeit) {
    return (
      <Karte dicht className="overflow-hidden">
        <h2 className="px-4 py-4 font-semibold">{tx('Willkommen bei Stride')}</h2>
      </Karte>
    );
  }

  const stand: PfadStand = {
    taetigkeiten: vorlagen.filter((vorlage: Vorlage) => !vorlage.archiviert).length,
    visionen: ziele?.visionen.length ?? 0,
    projekte: ziele?.projekte.length ?? 0,
    vorhaben: ziele?.vorhaben.length ?? 0,
    faehigkeiten: faehigkeiten?.length ?? 0,
    eintraege: erfolge.kategorien.find((kategorie) => kategorie.kennzahl === 'eintraege')?.wert ?? 0,
    stufe: null,
    funktionen: sichtbar.funktionen ?? standardFunktionen(),
    ebenen: sichtbar.ebenen ?? standardEbenen(),
  };
  const zeilen = willkommensZeilen(stand);

  const oeffne = (zeile: WillkommenZeile) => {
    if (zeile.schluessel === 'eintrag') {
      eintragOeffnen();
      return;
    }
    if (zeile.schluessel === 'ersteTaetigkeit') {
      navigiere('/mehr/inhalte', { state: { anlegen: 'taetigkeit' } });
      return;
    }
    if (zeile.schluessel === 'faehigkeit') {
      navigiere('/faehigkeiten', { state: { anlegen: 'faehigkeit' } });
      return;
    }
    if (zeile.art === 'vorhaben') {
      navigiere('/ziele');
      return;
    }
    navigiere('/ziele', { state: { anlegen: zeile.art === 'visionen' ? 'vision' : 'projekt' } });
  };

  return (
    <Karte dicht className="overflow-hidden" label={tx('Willkommen bei Stride')}>
      <h2 className="px-4 pt-4 font-semibold">{tx('Willkommen bei Stride')}</h2>
      <div className="liste">
        {zeilen.map((zeile) => {
          const erledigt = zeile.erledigt;
          const titel = titelVon(zeile, ziele, faehigkeiten);
          return (
            <Zeile
              key={zeile.schluessel}
              id={`willkommen-${zeile.schluessel}`}
              titel={titel}
              name={titel}
              pfeil={!erledigt}
              onKlick={erledigt ? undefined : () => oeffne(zeile)}
              symbol={erledigt ? <Check className="text-fortschritt" aria-hidden /> : undefined}
            />
          );
        })}
      </div>
    </Karte>
  );
}

function titelVon(zeile: WillkommenZeile, ziele: Ziele | undefined, faehigkeiten: Faehigkeit[] | undefined): string {
  if (zeile.schluessel === 'ersteTaetigkeit') {
    return tx('Erste Tätigkeit anlegen');
  }
  if (zeile.schluessel === 'eintrag') {
    return tx('Ersten Eintrag anlegen');
  }
  if (zeile.schluessel === 'faehigkeit') {
    const name = faehigkeiten ? erster(faehigkeiten, (faehigkeit) => faehigkeit.name) : null;
    return zeile.erledigt && name ? tx('Fähigkeit „{name}"', { name }) : tx('Fähigkeit anlegen');
  }
  const name = ziele ? zielName(zeile.art, ziele) : null;
  return zeile.erledigt && name ? tx(ZIEL_NAME[zeile.art], { name }) : tx(ZIEL_OFFEN[zeile.art]);
}
