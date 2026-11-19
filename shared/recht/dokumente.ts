import type { RechtBlock, RechtId } from './arten.ts';
import { DATENSCHUTZ } from './datenschutz.ts';
import { IMPRESSUM } from './impressum.ts';
import { LIZENZEN } from './lizenzen.ts';
import { NUTZUNG } from './nutzung.ts';

export const RECHT_DOKUMENTE: Record<RechtId, readonly RechtBlock[]> = {
  impressum: IMPRESSUM,
  datenschutz: DATENSCHUTZ,
  nutzung: NUTZUNG,
  lizenzen: LIZENZEN,
};
