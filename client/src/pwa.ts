import { leseSitzungszahl, merkeSitzungszahl } from './speicher.ts';

const SERVICE_WORKER = '/sw.js';
const NEU_GELADEN_SCHLUESSEL = 'ascend.neuGeladen';
const NEU_LADEN_SPERRE_MS = 10_000;

export function registriereServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return;
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SERVICE_WORKER).catch((fehler: unknown) => {
      console.error('Service Worker konnte nicht registriert werden.', fehler);
    });
  });
}

export function ladeBeiVeraltetenDateienNeu(): void {
  window.addEventListener('vite:preloadError', (ereignis) => {
    const zuletzt = leseSitzungszahl(NEU_GELADEN_SCHLUESSEL);
    if (zuletzt !== null && Date.now() - zuletzt < NEU_LADEN_SPERRE_MS) {
      return;
    }
    ereignis.preventDefault();
    merkeSitzungszahl(NEU_GELADEN_SCHLUESSEL, Date.now());
    window.location.reload();
  });
}
