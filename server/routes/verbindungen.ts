import type { FastifyInstance } from 'fastify';
import {
  aendereKalender,
  erstelleKalender,
  ladeKalenderListe,
  loescheKalender,
} from '../features/verbindungen/kalender.ts';
import { gleicheAllesAb } from '../features/verbindungen/abgleich.ts';
import {
  ladeTodoistStatus,
  trenneTodoist,
  verbindeTodoist,
} from '../features/verbindungen/todoist.ts';
import {
  ordneTodoistLabel,
  ordneTodoistLabelReihenfolge,
  ordneTodoistProjektZu,
} from '../features/verbindungen/todoistZuordnung.ts';
import {
  idParameter,
  kalenderAenderungSchema,
  kalenderSchema,
  todoistLabelSchema,
  todoistParameter,
  todoistReihenfolgeSchema,
  todoistTokenSchema,
  todoistZuordnungSchema,
} from '../validierung.ts';

export async function verbindungsRouten(app: FastifyInstance): Promise<void> {
  app.get('/verbindungen', async () => ({ todoist: ladeTodoistStatus(), kalender: ladeKalenderListe() }));

  app.put('/verbindungen/todoist', async (anfrage) => {
    const { token } = todoistTokenSchema.parse(anfrage.body);
    return verbindeTodoist(token);
  });

  app.delete('/verbindungen/todoist', async (_anfrage, antwort) => {
    trenneTodoist();
    return antwort.status(204).send();
  });

  app.patch('/verbindungen/todoist/projekte/:todoistId', async (anfrage) => {
    const { todoistId } = todoistParameter.parse(anfrage.params);
    return ordneTodoistProjektZu(todoistId, todoistZuordnungSchema.parse(anfrage.body));
  });

  app.put('/verbindungen/todoist/label-reihenfolge', async (anfrage) => {
    const { ids } = todoistReihenfolgeSchema.parse(anfrage.body);
    return ordneTodoistLabelReihenfolge(ids);
  });

  app.patch('/verbindungen/todoist/labels/:todoistId', async (anfrage) => {
    const { todoistId } = todoistParameter.parse(anfrage.params);
    return ordneTodoistLabel(todoistId, todoistLabelSchema.parse(anfrage.body));
  });

  app.post('/verbindungen/kalender', async (anfrage, antwort) => {
    return antwort.status(201).send(await erstelleKalender(kalenderSchema.parse(anfrage.body)));
  });

  app.patch('/verbindungen/kalender/:id', async (anfrage) => {
    const { id } = idParameter.parse(anfrage.params);
    return aendereKalender(id, kalenderAenderungSchema.parse(anfrage.body));
  });

  app.delete('/verbindungen/kalender/:id', async (anfrage, antwort) => {
    const { id } = idParameter.parse(anfrage.params);
    loescheKalender(id);
    return antwort.status(204).send();
  });

  app.post('/verbindungen/abgleichen', async () => gleicheAllesAb());
}
