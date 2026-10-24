import type { FastifyInstance } from 'fastify';
import { erstelleEintrag, ladeChronik, loescheEintrag } from './eintraege.ts';
import { eintragAbfrageSchema, eintragSchema, idParameter } from '../../validierung.ts';

export async function eintragRouten(app: FastifyInstance): Promise<void> {
  app.get('/eintraege', async (anfrage) => {
    const { cursor, limit, ...filter } = eintragAbfrageSchema.parse(anfrage.query);
    return ladeChronik(filter, cursor, limit);
  });

  app.post('/eintraege', async (anfrage, antwort) => {
    const ergebnis = erstelleEintrag(eintragSchema.parse(anfrage.body));
    return antwort.status(201).send(ergebnis);
  });

  app.delete('/eintraege/:id', async (anfrage, antwort) => {
    const { id } = idParameter.parse(anfrage.params);
    loescheEintrag(id);
    return antwort.status(204).send();
  });
}
