import type { FastifyInstance } from 'fastify';
import { aufgabeAbfrageSchema, aufgabeAenderungSchema, aufgabeSchema, idParameter } from '../../validierung.ts';
import { aendereAufgabe, erledigeAufgabe, erstelleAufgabe, ladeAufgaben, loescheAufgabe } from './aufgaben.ts';

export async function aufgabenRouten(app: FastifyInstance): Promise<void> {
  app.get('/aufgaben', async (anfrage) => {
    const { archiv } = aufgabeAbfrageSchema.parse(anfrage.query);
    return ladeAufgaben(archiv === '1');
  });

  app.post('/aufgaben', async (anfrage, antwort) => {
    return antwort.status(201).send(erstelleAufgabe(aufgabeSchema.parse(anfrage.body)));
  });

  app.patch('/aufgaben/:id', async (anfrage) => {
    const { id } = idParameter.parse(anfrage.params);
    return aendereAufgabe(id, aufgabeAenderungSchema.parse(anfrage.body));
  });

  app.delete('/aufgaben/:id', async (anfrage, antwort) => {
    const { id } = idParameter.parse(anfrage.params);
    loescheAufgabe(id);
    return antwort.status(204).send();
  });

  app.post('/aufgaben/:id/erledigen', async (anfrage, antwort) => {
    const { id } = idParameter.parse(anfrage.params);
    return antwort.status(201).send(erledigeAufgabe(id));
  });
}
