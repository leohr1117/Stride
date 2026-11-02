import fs from 'node:fs';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { aktiviereAnfrageSprache } from './anfrageSprache.ts';
import { KONFIG } from './config.ts';
import { mitWelt, schliesseDatenbank } from './db.ts';
import { AppFehler } from './fehler.ts';
import { attributRouten } from './features/attribute/routen.ts';
import { basisRouten } from './features/basis/routen.ts';
import { bewertungRouten } from './features/bewertung/routen.ts';
import { hinweiseRouten } from './features/hinweise/routen.ts';
import { ketteRouten } from './features/kette/routen.ts';
import { pflegeRueckkehr } from './features/kette/rueckkehr.ts';
import { datenRouten } from './features/daten/daten.ts';
import { eintragRouten } from './features/eintraege/routen.ts';
import { faehigkeitRouten } from './features/faehigkeiten/routen.ts';
import { reflexionRouten } from './features/rueckblick/routen.ts';
import { uebersichtRouten } from './features/uebersicht/routen.ts';
import { istOeffentlicherZugang, leseSitzungsToken, sitzungsCookie, verbindungIstSicher } from './features/zugang/routen.ts';
import { verbindungsRouten } from './routes/verbindungen.ts';
import { zielRouten } from './features/ziele/ziele.ts';
import { registrierePasswortAdresse } from './features/zugang/passwortAdresse.ts';
import { zugangRouten } from './features/zugang/routen.ts';
import { rechneBossangriffeAb } from './features/bosse/bossangriffe.ts';
import { schalteErfolgeFrei } from './features/erfolge/erfolge.ts';
import { loeseWeltdatei, schliesseZugang, sitzungGueltig, weltdateiDerSitzung, weltenPfade } from './features/zugang/zugang.ts';
import { starteRegelmaessigenAbgleich } from './features/verbindungen/abgleich.ts';
import { rechneZeitverfallAb } from './features/verfall/verfall.ts';
import { beschreibeValidierungsfehler } from './validierung.ts';

const API_PREFIX = '/api';
const INTERNER_FEHLER = 500;

const app = Fastify({ logger: { level: KONFIG.logLevel }, trustProxy: true });

app.setErrorHandler((fehler: FastifyError | Error, anfrage, antwort) => {
  if (fehler instanceof ZodError) {
    return antwort.status(400).send({ fehler: beschreibeValidierungsfehler(fehler) });
  }
  if (fehler instanceof AppFehler) {
    return antwort.status(fehler.statusCode).send({ fehler: fehler.message });
  }
  const statusCode = 'statusCode' in fehler ? fehler.statusCode : undefined;
  if (statusCode !== undefined && statusCode < INTERNER_FEHLER) {
    return antwort.status(statusCode).send({ fehler: fehler.message });
  }
  anfrage.log.error({ err: fehler }, 'Unerwarteter Fehler');
  return antwort.status(INTERNER_FEHLER).send({ fehler: 'Interner Fehler. Details stehen im Server-Log.' });
});

await app.register(
  async (api) => {
    api.addHook('onRequest', (anfrage, antwort, fertig) => {
      aktiviereAnfrageSprache(anfrage.headers['accept-language']);
      const token = leseSitzungsToken(anfrage.headers.cookie);
      const weltdatei = weltdateiDerSitzung(token);
      const angemeldet = weltdatei !== null;
      if (!angemeldet && !istOeffentlicherZugang(anfrage.method, anfrage.url)) {
        // send() beendet die Antwort selbst. fertig() würde die Route trotzdem starten:
        // onSend ist asynchron, reply.sent bleibt bis writableEnded falsch.
        antwort.status(401).send({ fehler: 'Anmeldung erforderlich.' });
        return;
      }
      const weiter = () => {
        if (angemeldet) {
          rechneBossangriffeAb();
          rechneZeitverfallAb();
          pflegeRueckkehr();
        }
        fertig();
      };
      if (weltdatei) {
        mitWelt(loeseWeltdatei(weltdatei), weiter);
        return;
      }
      weiter();
    });
    api.addHook('onSend', async (anfrage, antwort, payload) => {
      if (!antwort.getHeader('set-cookie') && anfrage.headers.cookie) {
        const token = leseSitzungsToken(anfrage.headers.cookie);
        if (token && sitzungGueltig(token)) {
          const sicher = verbindungIstSicher(anfrage.protocol, anfrage.headers['x-forwarded-proto']);
          antwort.header('set-cookie', sitzungsCookie(token, sicher));
        }
      }
      return payload;
    });
    await api.register(uebersichtRouten);
    await api.register(ketteRouten);
    await api.register(hinweiseRouten);
    await api.register(bewertungRouten);
    await api.register(attributRouten);
    await api.register(zielRouten);
    await api.register(eintragRouten);
    await api.register(faehigkeitRouten);
    await api.register(basisRouten);
    await api.register(reflexionRouten);
    await api.register(datenRouten);
    await api.register(verbindungsRouten);
    await api.register(zugangRouten);
  },
  { prefix: API_PREFIX },
);

schalteErfolgeFrei();
registrierePasswortAdresse(app);

const clientVorhanden = fs.existsSync(KONFIG.clientPfad);
if (clientVorhanden) {
  await app.register(fastifyStatic, { root: KONFIG.clientPfad });
}

app.setNotFoundHandler((anfrage, antwort) => {
  if (anfrage.url.startsWith(`${API_PREFIX}/`) || !clientVorhanden) {
    return antwort.status(404).send({ fehler: `Unbekannter Pfad: ${anfrage.method} ${anfrage.url}` });
  }
  return antwort.sendFile('index.html');
});

let stoppeAbgleich: (() => void) | null = null;

async function beende(signal: string): Promise<void> {
  app.log.info(`${signal} empfangen, Server wird beendet.`);
  stoppeAbgleich?.();
  await app.close();
  schliesseDatenbank();
  schliesseZugang();
  process.exit(0);
}

process.on('SIGINT', () => void beende('SIGINT'));
process.on('SIGTERM', () => void beende('SIGTERM'));

try {
  await app.listen({ port: KONFIG.port, host: KONFIG.host });
  console.log(`Stride läuft auf http://localhost:${KONFIG.port}`);
  stoppeAbgleich = starteRegelmaessigenAbgleich(weltenPfade, (fehler) => app.log.error({ err: fehler }, 'Abgleich fehlgeschlagen'));
} catch (fehler) {
  app.log.error({ err: fehler }, 'Server konnte nicht gestartet werden');
  schliesseDatenbank();
  process.exit(1);
}
