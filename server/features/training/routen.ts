import type { FastifyInstance } from 'fastify';
import {
  idParameter,
  trainingAbfrageSchema,
  trainingsplanAenderungSchema,
  trainingsplanSchema,
  uebungAenderungSchema,
  uebungSchema,
} from '../../validierung.ts';
import { aendereTrainingsplan, erstelleTrainingsplan, ladeTrainingsplaene, loescheTrainingsplan } from './plaene.ts';
import { aendereUebung, erstelleUebung, ladeUebungen, loescheUebung } from './uebungen.ts';

export async function trainingRouten(app: FastifyInstance): Promise<void> {
  app.get('/trainingsplaene', async (anfrage) => {
    const { archiv } = trainingAbfrageSchema.parse(anfrage.query);
    return ladeTrainingsplaene(archiv === '1');
  });

  app.post('/trainingsplaene', async (anfrage, antwort) => {
    return antwort.status(201).send(erstelleTrainingsplan(trainingsplanSchema.parse(anfrage.body)));
  });

  app.patch('/trainingsplaene/:id', async (anfrage) => {
    const { id } = idParameter.parse(anfrage.params);
    return aendereTrainingsplan(id, trainingsplanAenderungSchema.parse(anfrage.body));
  });

  app.delete('/trainingsplaene/:id', async (anfrage, antwort) => {
    const { id } = idParameter.parse(anfrage.params);
    loescheTrainingsplan(id);
    return antwort.status(204).send();
  });

  app.get('/uebungen', async (anfrage) => {
    const { archiv } = trainingAbfrageSchema.parse(anfrage.query);
    return ladeUebungen(archiv === '1');
  });

  app.post('/uebungen', async (anfrage, antwort) => {
    return antwort.status(201).send(erstelleUebung(uebungSchema.parse(anfrage.body)));
  });

  app.patch('/uebungen/:id', async (anfrage) => {
    const { id } = idParameter.parse(anfrage.params);
    return aendereUebung(id, uebungAenderungSchema.parse(anfrage.body));
  });

  app.delete('/uebungen/:id', async (anfrage, antwort) => {
    const { id } = idParameter.parse(anfrage.params);
    loescheUebung(id);
    return antwort.status(204).send();
  });
}
