import type { RechtBlock, RechtId } from './arten.ts';
import { APP_ADRESSE_STANDARD } from '../appAdresse.ts';
import { datenschutz } from './datenschutz.ts';
import { IMPRESSUM } from './impressum.ts';
import { LIZENZEN } from './lizenzen.ts';
import { nutzung } from './nutzung.ts';

export function rechtDokumente(adresse: string = APP_ADRESSE_STANDARD): Record<RechtId, readonly RechtBlock[]> {
  return {
    impressum: IMPRESSUM,
    datenschutz: datenschutz(adresse),
    nutzung: nutzung(adresse),
    lizenzen: LIZENZEN,
  };
}

export const RECHT_DOKUMENTE: Record<RechtId, readonly RechtBlock[]> = rechtDokumente();
