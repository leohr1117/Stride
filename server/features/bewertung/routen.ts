import type { FastifyInstance } from 'fastify';
import { bewertungSchema } from '../../validierung.ts';
import { speichereBewertung } from './bewertung.ts';

export async function bewertungRouten(app: FastifyInstance): Promise<void> {
  app.post('/bewertung', async (anfrage) => speichereBewertung(bewertungSchema.parse(anfrage.body)));
}
