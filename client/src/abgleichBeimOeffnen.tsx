import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { AbgleichErgebnis } from '../../shared/api/verbindungen.ts';
import { api, SCHLUESSEL } from './api/index.ts';

const PAUSE_MS = 60_000;

let zuletzt = 0;

export function gleicheBeimOeffnen(): Promise<AbgleichErgebnis | null> {
  const jetzt = Date.now();
  if (jetzt - zuletzt < PAUSE_MS) {
    return Promise.resolve(null);
  }
  zuletzt = jetzt;
  return api.gleicheAb().catch(() => null);
}

export function AbgleichBeimOeffnen() {
  const client = useQueryClient();
  useEffect(() => {
    const starte = () => {
      void gleicheBeimOeffnen().then((ergebnis) => {
        if (!ergebnis) {
          return;
        }
        if (ergebnis.neu > 0) {
          void client.invalidateQueries();
          return;
        }
        void client.invalidateQueries({ queryKey: SCHLUESSEL.verbindungen });
      });
    };
    starte();
    const beiSicht = () => {
      if (document.visibilityState === 'visible') {
        starte();
      }
    };
    document.addEventListener('visibilitychange', beiSicht);
    return () => document.removeEventListener('visibilitychange', beiSicht);
  }, [client]);
  return null;
}
