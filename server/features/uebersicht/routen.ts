import type { FastifyInstance } from 'fastify';
import { aendereEinstellungen, ladeEinstellungen } from '../einstellungen/einstellungen.ts';
import { merkeVersionsstand } from '../einstellungen/versionHinweis.ts';
import { setzeProfilZurueck } from '../../services/profilZurueck.ts';
import { leseJetzt } from '../../services/zeit.ts';
import { ladeCharakter, ladeUebersicht } from './uebersicht.ts';
import { einstellungenAenderungSchema, versionHinweisSchema } from '../../validierung.ts';

export async function uebersichtRouten(app: FastifyInstance): Promise<void> {
  app.get('/uebersicht', async () => ladeUebersicht(leseJetzt()));

  app.get('/charakter', async () => ladeCharakter());

  app.get('/einstellungen', async () => ladeEinstellungen());

  app.patch('/einstellungen', async (anfrage) => aendereEinstellungen(einstellungenAenderungSchema.parse(anfrage.body)));

  app.patch('/version-hinweis', async (anfrage) => {
    merkeVersionsstand(versionHinweisSchema.parse(anfrage.body));
    return ladeEinstellungen();
  });

  app.post('/profil/zuruecksetzen', async () => setzeProfilZurueck());
}
