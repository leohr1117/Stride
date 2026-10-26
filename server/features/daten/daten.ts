import type { FastifyInstance } from 'fastify';
import { exportiereDaten, importiereDaten } from './datensicherung.ts';
import { lokalesDatum } from '../../services/zeit.ts';
import { datenImportSchema } from '../../validierung.ts';

const IMPORT_MAX_BYTES = 50 * 1024 * 1024;

export async function datenRouten(app: FastifyInstance): Promise<void> {
  app.get('/export', async (_anfrage, antwort) => {
    const jetzt = new Date();
    return antwort
      .header('Content-Disposition', `attachment; filename="stride-${lokalesDatum(jetzt)}.json"`)
      .send(exportiereDaten(jetzt));
  });

  app.post('/import', { bodyLimit: IMPORT_MAX_BYTES }, async (anfrage) => {
    return importiereDaten(datenImportSchema.parse(anfrage.body));
  });
}
