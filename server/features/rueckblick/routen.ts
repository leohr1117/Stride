import type { FastifyInstance } from 'fastify';
import { ladeErfolge, setzeTitel } from '../erfolge/erfolge.ts';
import { aktuelleWoche, ladeRueckblick, speichereRueckblick } from './rueckblick.ts';
import { ladeStatistiken } from '../statistiken/statistiken.ts';
import {
  rueckblickAbfrageSchema,
  rueckblickSchema,
  statistikAbfrageSchema,
  titelSchema,
  wocheParameter,
} from '../../validierung.ts';

export async function reflexionRouten(app: FastifyInstance): Promise<void> {
  app.get('/erfolge', async () => ladeErfolge());

  app.put('/titel', async (anfrage) => {
    const { schluessel } = titelSchema.parse(anfrage.body);
    return setzeTitel(schluessel);
  });

  app.get('/rueckblick', async (anfrage) => {
    const { woche } = rueckblickAbfrageSchema.parse(anfrage.query);
    return ladeRueckblick(woche ?? aktuelleWoche());
  });

  app.put('/rueckblick/:woche', async (anfrage) => {
    const { woche } = wocheParameter.parse(anfrage.params);
    return speichereRueckblick(woche, rueckblickSchema.parse(anfrage.body));
  });

  app.get('/statistiken', async (anfrage) => {
    const { zeitraum } = statistikAbfrageSchema.parse(anfrage.query);
    return ladeStatistiken(zeitraum);
  });
}
