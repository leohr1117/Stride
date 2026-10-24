import { AsyncLocalStorage } from 'node:async_hooks';
import { FALLBACK_SPRACHE, spracheAusKopf, type Sprache } from '../shared/sprache/kern.ts';

const speicher = new AsyncLocalStorage<Sprache>();

export function mitAnfrageSprache<T>(kopf: string | string[] | undefined, arbeit: () => T): T {
  return speicher.run(spracheAusKopf(kopf), arbeit);
}

/** Gilt für den Rest dieser Anfrage, ohne den Fastify-Hook ein zweites Mal anzustoßen. */
export function aktiviereAnfrageSprache(kopf: string | string[] | undefined): void {
  speicher.enterWith(spracheAusKopf(kopf));
}

export function anfrageSprache(): Sprache {
  return speicher.getStore() ?? FALLBACK_SPRACHE;
}
