import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { Einstellungen } from '../../shared/api/einstellungen.ts';
import { entscheideUpdateHinweis, hoehereVersion } from '../../shared/spiel/updateHinweis.ts';
import { AKTUELLE_VERSION } from '../../shared/versionen.ts';
import { api, SCHLUESSEL } from './api/index.ts';
import { Toast } from './components/Toast.tsx';

const DAUER_MS = 10_000;
const NEU_PFAD = '/mehr/neu';

export function verbindeVersionsstand(alt: Einstellungen | undefined, neu: Einstellungen): Einstellungen {
  if (!alt) {
    return neu;
  }
  return {
    ...neu,
    versionHinweis: {
      benachrichtigt: hoehereVersion(alt.versionHinweis.benachrichtigt, neu.versionHinweis.benachrichtigt),
      gesehen: hoehereVersion(alt.versionHinweis.gesehen, neu.versionHinweis.gesehen),
    },
  };
}

function schreibeStand(
  client: ReturnType<typeof useQueryClient>,
  daten: { benachrichtigt?: string; gesehen?: string },
): void {
  void api.merkeVersionHinweis(daten).then((neu) => {
    client.setQueryData<Einstellungen>(SCHLUESSEL.einstellungen, (alt) => verbindeVersionsstand(alt, neu));
  });
}

export function useNeuMarkierung(): boolean {
  const { data } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  if (!data) {
    return false;
  }
  const frisch = !data.profilAngelegt && data.weltLeer;
  return entscheideUpdateHinweis(data.versionHinweis, AKTUELLE_VERSION, frisch).badge;
}

/** Eine Snackbar nach dem Update. Kein Dialog. Fokus und Zeiger halten die Zeit an. */
export function UpdateHinweis() {
  const { data } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const client = useQueryClient();
  const navigiere = useNavigate();
  const { pathname } = useLocation();
  const [zeigen, setZeigen] = useState(false);
  const entschieden = useRef(false);

  useEffect(() => {
    if (!data || entschieden.current) {
      return;
    }
    entschieden.current = true;
    const frisch = !data.profilAngelegt && data.weltLeer;
    const entscheid = entscheideUpdateHinweis(data.versionHinweis, AKTUELLE_VERSION, frisch);
    if (entscheid.schreiben) {
      schreibeStand(client, entscheid.schreiben);
    }
    setZeigen(entscheid.snackbar);
  }, [data, client]);

  if (!zeigen || pathname === NEU_PFAD) {
    return null;
  }
  return (
    <Toast
      text="Stride wurde aktualisiert."
      rolle="status"
      aktionLabel="Neuigkeiten"
      aktion={() => {
        setZeigen(false);
        void navigiere(NEU_PFAD);
      }}
      onEnde={() => setZeigen(false)}
      dauerMs={DAUER_MS}
      pauseBeiZeiger
      wurzelId="update-hinweis"
      markierung="update"
    />
  );
}
