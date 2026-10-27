import type { FastifyInstance } from 'fastify';
import { aendereAttribut, aktiviereAttribut, ladeAttribute } from './attribute.ts';
import { loescheAttribut, loescheVorlage } from '../../services/loeschen.ts';
import { aendereVorlage, erstelleVorlage, ladeVorlagen, ordneVorlagen } from '../taetigkeiten/vorlagen.ts';
import {
  attributAenderungSchema,
  attributAktivierungSchema,
  idParameter,
  vorlageAenderungSchema,
  vorlageReihenfolgeSchema,
  vorlageSchema,
} from '../../validierung.ts';

export async function attributRouten(app: FastifyInstance): Promise<void> {
  app.get('/attribute', async () => ladeAttribute(true));

  app.post('/attribute', async (anfrage, antwort) => {
    const { kennung, modus, level } = attributAktivierungSchema.parse(anfrage.body);
    return antwort.status(201).send(aktiviereAttribut(kennung, modus, level));
  });

  app.patch('/attribute/:id', async (anfrage) => {
    const { id } = idParameter.parse(anfrage.params);
    return aendereAttribut(id, attributAenderungSchema.parse(anfrage.body));
  });

  app.delete('/attribute/:id', async (anfrage, antwort) => {
    const { id } = idParameter.parse(anfrage.params);
    loescheAttribut(id);
    return antwort.status(204).send();
  });

  app.get('/vorlagen', async () => ladeVorlagen());

  app.put('/vorlagen/reihenfolge', async (anfrage) => {
    const { ids } = vorlageReihenfolgeSchema.parse(anfrage.body);
    return ordneVorlagen(ids);
  });

  app.post('/vorlagen', async (anfrage, antwort) => {
    const vorlage = erstelleVorlage(vorlageSchema.parse(anfrage.body));
    return antwort.status(201).send(vorlage);
  });

  app.patch('/vorlagen/:id', async (anfrage) => {
    const { id } = idParameter.parse(anfrage.params);
    return aendereVorlage(id, vorlageAenderungSchema.parse(anfrage.body));
  });

  app.delete('/vorlagen/:id', async (anfrage, antwort) => {
    const { id } = idParameter.parse(anfrage.params);
    loescheVorlage(id);
    return antwort.status(204).send();
  });
}
