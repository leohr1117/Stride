import type { FastifyInstance } from 'fastify';
import {
  aendereBasisAufgabe,
  erledigeBasisAufgabe,
  erstelleBasisAufgabe,
  ladeBasisAufgaben,
} from './basis.ts';
import { loescheBasisAufgabe } from '../../services/loeschen.ts';
import { basisAufgabeAenderungSchema, basisAufgabeSchema, idParameter } from '../../validierung.ts';

export async function basisRouten(app: FastifyInstance): Promise<void> {
  app.get('/basis', async () => ladeBasisAufgaben());

  app.post('/basis', async (anfrage, antwort) => {
    return antwort.status(201).send(erstelleBasisAufgabe(basisAufgabeSchema.parse(anfrage.body)));
  });

  app.patch('/basis/:id', async (anfrage) => {
    const { id } = idParameter.parse(anfrage.params);
    return aendereBasisAufgabe(id, basisAufgabeAenderungSchema.parse(anfrage.body));
  });

  app.delete('/basis/:id', async (anfrage, antwort) => {
    const { id } = idParameter.parse(anfrage.params);
    loescheBasisAufgabe(id);
    return antwort.status(204).send();
  });

  app.post('/basis/:id/erledigen', async (anfrage, antwort) => {
    const { id } = idParameter.parse(anfrage.params);
    return antwort.status(201).send(erledigeBasisAufgabe(id));
  });
}
