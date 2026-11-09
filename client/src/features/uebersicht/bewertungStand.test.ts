import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

async function standLaden() {
  vi.resetModules();
  const stand = await import('./bewertungStand.ts');
  const api = await import('../../api/index.ts');
  return { stand, schluessel: api.SCHLUESSEL.bewertung };
}

describe('bewertungWeglegen', () => {
  it('lässt merkeBewertungFaellig ins Leere laufen und nach neuem Modulstand wieder fällig werden', async () => {
    const erste = await standLaden();
    const client = new QueryClient();
    erste.stand.merkeBewertungFaellig(client, { bewertungFaellig: true });
    expect(erste.stand.bewertungIstFaellig()).toBe(true);
    expect(client.getQueryData(erste.schluessel)).toBe(true);

    erste.stand.bewertungWeglegen(client);
    expect(erste.stand.bewertungIstFaellig()).toBe(false);
    expect(client.getQueryData(erste.schluessel)).toBe(false);

    erste.stand.merkeBewertungFaellig(client, { bewertungFaellig: true });
    expect(erste.stand.bewertungIstFaellig()).toBe(false);
    expect(client.getQueryData(erste.schluessel)).toBe(false);

    const zweite = await standLaden();
    const clientNeu = new QueryClient();
    zweite.stand.merkeBewertungFaellig(clientNeu, { bewertungFaellig: true });
    expect(zweite.stand.bewertungIstFaellig()).toBe(true);
    expect(clientNeu.getQueryData(zweite.schluessel)).toBe(true);
  });
});
