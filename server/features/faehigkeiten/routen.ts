import type { FastifyInstance } from 'fastify';
import {
  aendereFaehigkeit,
  aendereKnoten,
  erstelleFaehigkeit,
  erstelleKnoten,
  ladeFaehigkeit,
  ladeFaehigkeiten,
  loescheKnoten,
  schalteSkillFrei,
  sperreSkill,
} from './faehigkeiten.ts';
import { loescheFaehigkeit } from '../../services/loeschen.ts';
import {
  faehigkeitAenderungSchema,
  faehigkeitSchema,
  idParameter,
  knotenAenderungSchema,
  knotenSchema,
} from '../../validierung.ts';

export async function faehigkeitRouten(app: FastifyInstance): Promise<void> {
  app.get('/faehigkeiten', async () => ladeFaehigkeiten());

  app.get('/faehigkeiten/:id', async (anfrage) => {
    const { id } = idParameter.parse(anfrage.params);
    return ladeFaehigkeit(id);
  });

  app.post('/faehigkeiten', async (anfrage, antwort) => {
    return antwort.status(201).send(erstelleFaehigkeit(faehigkeitSchema.parse(anfrage.body)));
  });

  app.patch('/faehigkeiten/:id', async (anfrage) => {
    const { id } = idParameter.parse(anfrage.params);
    return aendereFaehigkeit(id, faehigkeitAenderungSchema.parse(anfrage.body));
  });

  app.delete('/faehigkeiten/:id', async (anfrage, antwort) => {
    const { id } = idParameter.parse(anfrage.params);
    loescheFaehigkeit(id);
    return antwort.status(204).send();
  });

  app.post('/faehigkeiten/:id/knoten', async (anfrage, antwort) => {
    const { id } = idParameter.parse(anfrage.params);
    return antwort.status(201).send(erstelleKnoten(id, knotenSchema.parse(anfrage.body)));
  });

  app.patch('/knoten/:id', async (anfrage) => {
    const { id } = idParameter.parse(anfrage.params);
    return aendereKnoten(id, knotenAenderungSchema.parse(anfrage.body));
  });

  app.delete('/knoten/:id', async (anfrage) => {
    const { id } = idParameter.parse(anfrage.params);
    return loescheKnoten(id);
  });

  app.post('/knoten/:id/freischalten', async (anfrage) => {
    const { id } = idParameter.parse(anfrage.params);
    return schalteSkillFrei(id);
  });

  app.post('/knoten/:id/sperren', async (anfrage) => {
    const { id } = idParameter.parse(anfrage.params);
    return sperreSkill(id);
  });
}
