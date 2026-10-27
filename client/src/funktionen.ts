import { useQuery } from '@tanstack/react-query';
import { standardEbenen, type Ebenen } from '../../shared/spiel/ebenen.ts';
import { standardFunktionen, type Funktionen } from '../../shared/spiel/funktionen.ts';
import type { Sichtbarkeit } from '../../shared/spiel/sichtbarkeit.ts';
import { kartenWahl, type UebersichtKartenWahl } from '../../shared/spiel/uebersichtKarten.ts';
import { api, SCHLUESSEL } from './api/index.ts';

export function useFunktionen(): Funktionen {
  const { data } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  return data?.funktionen ?? standardFunktionen();
}

export function useEbenen(): Ebenen {
  const { data } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  return data?.ebenen ?? standardEbenen();
}

export function useUebersichtKarten(): UebersichtKartenWahl {
  const { data } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  return data?.uebersichtKarten ?? kartenWahl(undefined);
}

export function useSichtbarkeit(): Sichtbarkeit {
  const { data } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  return {
    funktionen: data?.funktionen ?? standardFunktionen(),
    ebenen: data?.ebenen ?? standardEbenen(),
    attribute: data?.attribute,
  };
}
