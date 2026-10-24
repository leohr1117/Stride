import type { FastifyInstance } from 'fastify';
import {
  aendereOrganisation,
  aendereProjekt,
  aendereVision,
  erstelleOrganisation,
  erstelleProjekt,
  erstelleVision,
  ladeProjektauswahl,
  ladeProjektDetail,
  ladeZiele,
} from '../../services/struktur.ts';
import { aendereInvestition, erstelleInvestition, ladeInvestitionen } from '../investitionen/ausruestung.ts';
import {
  loescheInvestition,
  loescheOrganisation,
  loescheProjekt,
  loescheVision,
  loescheVorhaben,
} from '../../services/loeschen.ts';
import { pruefeFunktion } from '../einstellungen/einstellungen.ts';
import { erreicheVision, nimmVisionZurueck } from './visionen.ts';
import {
  aendereVorhaben,
  erstelleVorhaben,
  ladeLaufendes,
  lasseVorhabenLos,
  starteNeuenAnlauf,
} from './vorhaben.ts';
import {
  idParameter,
  organisationAenderungSchema,
  organisationSchema,
  investitionAenderungSchema,
  investitionSchema,
  projektAenderungSchema,
  projektSchema,
  visionAenderungSchema,
  visionSchema,
  vorhabenAenderungSchema,
  vorhabenAnlegenSchema,
  vorhabenSchema,
} from '../../validierung.ts';

export async function zielRouten(app: FastifyInstance): Promise<void> {
  app.get('/ziele', async () => ladeZiele());

  app.get('/laufend', async () => ladeLaufendes());

  app.post('/visionen', async (anfrage, antwort) => {
    return antwort.status(201).send(erstelleVision(visionSchema.parse(anfrage.body)));
  });

  app.patch('/visionen/:id', async (anfrage) => {
    const { id } = idParameter.parse(anfrage.params);
    return aendereVision(id, visionAenderungSchema.parse(anfrage.body));
  });

  app.delete('/visionen/:id', async (anfrage, antwort) => {
    const { id } = idParameter.parse(anfrage.params);
    loescheVision(id);
    return antwort.status(204).send();
  });

  app.post('/visionen/:id/erreichen', async (anfrage, antwort) => {
    const { id } = idParameter.parse(anfrage.params);
    return antwort.status(201).send(erreicheVision(id));
  });

  app.post('/visionen/:id/zuruecknehmen', async (anfrage) => {
    const { id } = idParameter.parse(anfrage.params);
    return nimmVisionZurueck(id);
  });

  app.post('/organisationen', async (anfrage, antwort) => {
    return antwort.status(201).send(erstelleOrganisation(organisationSchema.parse(anfrage.body)));
  });

  app.patch('/organisationen/:id', async (anfrage) => {
    const { id } = idParameter.parse(anfrage.params);
    return aendereOrganisation(id, organisationAenderungSchema.parse(anfrage.body));
  });

  app.delete('/organisationen/:id', async (anfrage, antwort) => {
    const { id } = idParameter.parse(anfrage.params);
    loescheOrganisation(id);
    return antwort.status(204).send();
  });

  app.get('/projekte/auswahl', async () => ladeProjektauswahl());

  app.get('/projekte/:id', async (anfrage) => {
    const { id } = idParameter.parse(anfrage.params);
    return ladeProjektDetail(id);
  });

  app.post('/projekte', async (anfrage, antwort) => {
    return antwort.status(201).send(erstelleProjekt(projektSchema.parse(anfrage.body)));
  });

  app.patch('/projekte/:id', async (anfrage) => {
    const { id } = idParameter.parse(anfrage.params);
    const aenderung = projektAenderungSchema.parse(anfrage.body);
    if (
      aenderung.investition !== undefined ||
      aenderung.investitionZiel !== undefined ||
      aenderung.investitionRessourcen !== undefined ||
      aenderung.investitionGroesse !== undefined
    ) {
      pruefeFunktion('ausruestung');
    }
    return aendereProjekt(id, aenderung);
  });

  app.delete('/projekte/:id', async (anfrage, antwort) => {
    const { id } = idParameter.parse(anfrage.params);
    loescheProjekt(id);
    return antwort.status(204).send();
  });

  app.get('/investitionen', async () => {
    pruefeFunktion('ausruestung');
    return ladeInvestitionen();
  });

  app.post('/investitionen', async (anfrage, antwort) => {
    pruefeFunktion('ausruestung');
    return antwort.status(201).send(erstelleInvestition(investitionSchema.parse(anfrage.body)));
  });

  app.delete('/investitionen/:id', async (anfrage, antwort) => {
    const { id } = idParameter.parse(anfrage.params);
    loescheInvestition(id);
    return antwort.status(204).send();
  });

  app.patch('/investitionen/:id', async (anfrage) => {
    pruefeFunktion('ausruestung');
    const { id } = idParameter.parse(anfrage.params);
    return aendereInvestition(id, investitionAenderungSchema.parse(anfrage.body));
  });

  app.post('/projekte/:id/vorhaben', async (anfrage, antwort) => {
    const { id } = idParameter.parse(anfrage.params);
    const { titel } = vorhabenSchema.parse(anfrage.body);
    return antwort.status(201).send(erstelleVorhaben(id, titel));
  });

  app.post('/vorhaben', async (anfrage, antwort) => {
    const daten = vorhabenAnlegenSchema.parse(anfrage.body);
    return antwort.status(201).send(erstelleVorhaben(daten.projektId, daten.titel));
  });

  app.delete('/vorhaben/:id', async (anfrage, antwort) => {
    const { id } = idParameter.parse(anfrage.params);
    loescheVorhaben(id);
    return antwort.status(204).send();
  });

  app.patch('/vorhaben/:id', async (anfrage) => {
    const { id } = idParameter.parse(anfrage.params);
    return aendereVorhaben(id, vorhabenAenderungSchema.parse(anfrage.body));
  });

  app.post('/vorhaben/:id/loslassen', async (anfrage) => {
    const { id } = idParameter.parse(anfrage.params);
    return lasseVorhabenLos(id);
  });

  app.post('/vorhaben/:id/neuer-anlauf', async (anfrage, antwort) => {
    const { id } = idParameter.parse(anfrage.params);
    return antwort.status(201).send(starteNeuenAnlauf(id));
  });
}
