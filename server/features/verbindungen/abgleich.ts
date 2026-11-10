import { ABGLEICH_MINUTEN, type AbgleichErgebnis } from '../../../shared/api/index.ts';
import { aktiverPfad, mitWeltAsync } from '../../db.ts';
import type { HinweisLog } from '../hinweise/sender.ts';
import { pruefeHinweise } from '../../integrationen/webPush.ts';
import { istTodoistFaellig, stundeInZone } from '../../services/todoistRegeln.ts';
import { leseJetzt } from '../../services/zeit.ts';
import { gleicheKalenderAb } from './kalender.ts';
import { leseWert, setzeWert } from './gemeinsam.ts';
import { gleicheTodoistAb } from './todoistAbgleich.ts';
import { SCHLUESSEL } from './todoist.ts';

const MS_PRO_MINUTE = 60 * 1000;
const ABGLEICH_INTERVALL_MS = ABGLEICH_MINUTEN * MS_PRO_MINUTE;
const ERSTER_ABGLEICH_MS = 30 * 1000;

interface AbgleichLauf {
  voll: boolean;
  promise: Promise<AbgleichErgebnis>;
}

const laufendeAbgleiche = new Map<string, AbgleichLauf>();

function nutzerZone(): string {
  const gespeichert = leseWert('zeitzone');
  if (gespeichert && stundeInZone(new Date(), gespeichert) !== null) {
    return gespeichert;
  }
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!gespeichert) {
    setzeWert('zeitzone', zone);
  }
  return zone;
}

function starteAbgleich(voll: boolean, jetzt = leseJetzt()): Promise<AbgleichErgebnis> {
  const pfad = aktiverPfad();
  const laufend = laufendeAbgleiche.get(pfad);
  if (laufend && (laufend.voll || !voll)) {
    return laufend.promise;
  }
  const promise = (async () => {
    if (laufend && voll && !laufend.voll) {
      await laufend.promise.catch(() => undefined);
    }
    const todoist =
      voll || istTodoistFaellig(jetzt, nutzerZone(), leseWert(SCHLUESSEL.abgleich))
        ? await gleicheTodoistAb(jetzt)
        : { neu: 0, fehler: [] };
    const kalender = await gleicheKalenderAb(jetzt);
    return { neu: todoist.neu + kalender.neu, fehler: [...todoist.fehler, ...kalender.fehler] };
  })().finally(() => {
    if (laufendeAbgleiche.get(pfad)?.promise === promise) {
      laufendeAbgleiche.delete(pfad);
    }
  });
  laufendeAbgleiche.set(pfad, { voll, promise });
  return promise;
}

export function gleicheAllesAb(): Promise<AbgleichErgebnis> {
  return starteAbgleich(true);
}

export function gleicheGeplantAb(jetzt = leseJetzt()): Promise<AbgleichErgebnis> {
  return starteAbgleich(false, jetzt);
}

export function starteRegelmaessigenAbgleich(
  welten: () => string[],
  beiFehler: (fehler: unknown) => void,
  log?: HinweisLog,
): () => void {
  const abgleichen = () => {
    void (async () => {
      for (const pfad of welten()) {
        await mitWeltAsync(pfad, async () => {
          await gleicheGeplantAb();
          await pruefeHinweise(new Date(), log);
        });
      }
    })().catch(beiFehler);
  };
  const erster = setTimeout(abgleichen, ERSTER_ABGLEICH_MS);
  const intervall = setInterval(abgleichen, ABGLEICH_INTERVALL_MS);
  erster.unref();
  intervall.unref();
  return () => {
    clearTimeout(erster);
    clearInterval(intervall);
  };
}
