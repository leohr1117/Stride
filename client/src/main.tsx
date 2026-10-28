import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiFehler } from './api/index.ts';
import { App } from './App.tsx';
import { ZugangTor } from './features/zugang/Anmeldung.tsx';
import { BelohnungProvider } from './components/Belohnung.tsx';
import { BestaetigungProvider } from './components/Bestaetigung.tsx';
import { SchnellProvider } from './components/SchnellAktion.tsx';
import { beobachteAngebotAbmeldung } from './features/uebersicht/angebotStand.ts';
import { beobachteFokusArt } from './fokus.ts';
import { beobachteSichtfeld } from './sichtfeld.ts';
import { ladeBeiVeraltetenDateienNeu, registriereServiceWorker } from './pwa.ts';
import { standardVorlage } from '../../shared/features/darstellung/paletten.ts';
import { SpracheProvider } from './sprache.tsx';
import { gespeicherteFarben, gespeicherterStil, gespeichertesGlimmen, wendeErscheinung, wendeStilAn } from './features/darstellung/stil.ts';
import './features/darstellung/styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, fehler) => {
        if (fehler instanceof ApiFehler && fehler.status === 401) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});

const wurzel = document.getElementById('root');
if (!wurzel) {
  throw new Error('Element #root fehlt in index.html.');
}

beobachteFokusArt();
beobachteAngebotAbmeldung();
beobachteSichtfeld();
ladeBeiVeraltetenDateienNeu();
registriereServiceWorker();
const startStil = gespeicherterStil();
await wendeStilAn(startStil);
const startFarben = gespeicherteFarben() ?? standardVorlage(startStil, window.matchMedia('(prefers-color-scheme: dark)').matches);
wendeErscheinung({ ...startFarben, glimmen: gespeichertesGlimmen() });

createRoot(wurzel).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SpracheProvider>
      <ZugangTor>
        <BelohnungProvider>
          <BestaetigungProvider>
            <SchnellProvider>
              <App />
            </SchnellProvider>
          </BestaetigungProvider>
        </BelohnungProvider>
      </ZugangTor>
      </SpracheProvider>
    </QueryClientProvider>
  </StrictMode>,
);
