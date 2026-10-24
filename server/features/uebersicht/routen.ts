import type { FastifyInstance } from 'fastify';
import { aendereEinstellungen, ladeEinstellungen } from '../einstellungen/einstellungen.ts';
import { setzeProfilZurueck } from '../../services/profilZurueck.ts';
import { ladeCharakter, ladeUebersicht } from './uebersicht.ts';
import { einstellungenAenderungSchema } from '../../validierung.ts';

export async function uebersichtRouten(app: FastifyInstance): Promise<void> {
  app.get('/uebersicht', async () => ladeUebersicht());

  app.get('/charakter', async () => ladeCharakter());

  app.get('/einstellungen', async () => ladeEinstellungen());

  app.patch('/einstellungen', async (anfrage) => aendereEinstellungen(einstellungenAenderungSchema.parse(anfrage.body)));

  app.post('/profil/zuruecksetzen', async () => setzeProfilZurueck());
}
