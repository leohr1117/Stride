import type { FastifyInstance } from 'fastify';
import { schutzSchema } from '../../validierung.ts';
import { ladeKetteHeute, setzeSchutzEin } from './kette.ts';

export async function ketteRouten(app: FastifyInstance): Promise<void> {
  app.get('/kette/heute', async () => ladeKetteHeute());

  app.post('/kette/schutz', async (anfrage) => {
    schutzSchema.parse(anfrage.body ?? {});
    return setzeSchutzEin();
  });
}
