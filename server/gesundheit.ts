import type { FastifyInstance } from 'fastify';
import { AKTUELLE_VERSION } from '../shared/versionen.ts';

export function istGesundheitsanfrage(methode: string, url: string): boolean {
  if (methode.toUpperCase() !== 'GET') {
    return false;
  }
  const ohneQuery = url.split('?')[0] ?? url;
  const pfad = ohneQuery.length > 1 && ohneQuery.endsWith('/') ? ohneQuery.slice(0, -1) : ohneQuery;
  return pfad === '/api/gesundheit';
}

function version(): { version: string } {
  return { version: AKTUELLE_VERSION };
}

export async function registriereGesundheit(api: FastifyInstance): Promise<void> {
  const still = { logLevel: 'silent' as const };
  api.get('/gesundheit', still, version);
  api.get('/gesundheit/', still, version);
}
