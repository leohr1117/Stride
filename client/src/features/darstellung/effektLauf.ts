import { useQuery } from '@tanstack/react-query';
import { useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { effektStufe, wirksameEffektStufe, type EffektStufe } from '../../../../shared/spiel/effekte.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { leseText, merkeText } from '../../speicher.ts';

const EFFEKT_SCHLUESSEL = 'stride.effekte';

export function gespeicherteEffektStufe(): EffektStufe {
  return effektStufe(leseText(EFFEKT_SCHLUESSEL));
}

export function wendeEffektStufe(wahl: EffektStufe): void {
  document.documentElement.dataset.effekte = wahl;
  merkeText(EFFEKT_SCHLUESSEL, wahl);
}

export function useEffektWahl(): EffektStufe {
  const { data } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const wahl = data ? effektStufe(data.effekte) : gespeicherteEffektStufe();
  useEffect(() => {
    wendeEffektStufe(wahl);
  }, [wahl]);
  return wahl;
}

export function useEffektStufe(): EffektStufe {
  return wirksameEffektStufe(useEffektWahl(), useReducedMotion() === true);
}
