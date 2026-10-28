import type { FastifyInstance } from 'fastify';
import { hinweisAboEndeSchema, hinweisAboSchema, hinweisAenderungSchema, hinweisAngebotSchema } from '../../validierung.ts';
import { aendereHinweisWahl, entferneHinweisAbo, ladeHinweisStand, merkeHinweisAngebot, speichereHinweisAbo } from './stand.ts';

export async function hinweiseRouten(app: FastifyInstance): Promise<void> {
  app.get('/hinweise', async () => ladeHinweisStand());

  app.post('/hinweise/abo', async (anfrage, antwort) => {
    return antwort.status(201).send(speichereHinweisAbo(hinweisAboSchema.parse(anfrage.body)));
  });

  app.delete('/hinweise/abo', async (anfrage) => entferneHinweisAbo(hinweisAboEndeSchema.parse(anfrage.body).endpoint));

  app.patch('/hinweise', async (anfrage) => aendereHinweisWahl(hinweisAenderungSchema.parse(anfrage.body)));

  app.post('/hinweise/angebot', async (anfrage) => {
    hinweisAngebotSchema.parse(anfrage.body);
    return merkeHinweisAngebot();
  });
}
