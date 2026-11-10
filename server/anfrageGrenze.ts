import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ANFRAGE_GRENZE, ZU_VIELE } from './anfrageGrenzen.ts';
import { AppFehler } from './fehler.ts';
import { istGesundheitsanfrage } from './gesundheit.ts';
import { clientAdresse, leseSitzungsToken } from './features/zugang/routen.ts';
import { sitzungsBenutzer } from './features/zugang/zugang.ts';

const KONTO = 'konto:';

export function anfrageSchluessel(anfrage: FastifyRequest): string {
  const benutzer = sitzungsBenutzer(leseSitzungsToken(anfrage.headers.cookie));
  if (benutzer) {
    return `${KONTO}${benutzer.id}`;
  }
  return `adresse:${clientAdresse(anfrage.ip, {
    cfConnectingIp: anfrage.headers['cf-connecting-ip'],
    xForwardedFor: anfrage.headers['x-forwarded-for'],
  })}`;
}

export function anfrageMaximum(schluessel: string): number {
  if (process.env.STRIDE_TEST === '1') {
    return ANFRAGE_GRENZE.testJeMinute;
  }
  return schluessel.startsWith(KONTO) ? ANFRAGE_GRENZE.jeMinuteKonto : ANFRAGE_GRENZE.jeMinuteAdresse;
}

export async function registriereAnfrageGrenze(api: FastifyInstance): Promise<void> {
  await api.register(rateLimit, {
    global: false,
    max: (_anfrage, schluessel) => anfrageMaximum(String(schluessel)),
    timeWindow: ANFRAGE_GRENZE.fensterMs,
    keyGenerator: (anfrage) => anfrageSchluessel(anfrage),
    errorResponseBuilder: () => new AppFehler(429, ZU_VIELE),
  });
  const begrenze = api.rateLimit();
  api.addHook('onRequest', async (anfrage, antwort) => {
    if (istGesundheitsanfrage(anfrage.method, anfrage.url)) {
      return;
    }
    await begrenze.call(api, anfrage, antwort);
  });
}
