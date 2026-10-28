import { createRequire } from 'node:module';
import { leseVapid, oeffentlicherVapidSchluessel } from '../config.ts';
import {
  ergebnisFuerFehler,
  sendeHinweiseWennBereit,
  type PushErgebnis,
  type PushNutzlast,
  type PushZiel,
} from '../features/hinweise/sender.ts';

const require = createRequire(import.meta.url);
const { sendNotification } = require('web-push') as Pick<typeof import('web-push'), 'sendNotification'>;

/** Einziger Import von web-push. Der private Schlüssel geht nur an sendNotification. */
export async function sendeWebPush(abo: PushZiel, nutzlast: PushNutzlast): Promise<PushErgebnis> {
  const vapid = leseVapid();
  if (vapid === null) {
    return { status: 'nicht-eingerichtet', httpStatus: null };
  }
  try {
    await sendNotification(
      { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
      JSON.stringify({ title: nutzlast.title, body: nutzlast.body, data: { ziel: nutzlast.data.ziel } }),
      {
        vapidDetails: {
          subject: vapid.betreff,
          publicKey: vapid.oeffentlich,
          privateKey: vapid.privat,
        },
        urgency: 'normal',
      },
    );
    return { status: 'ok', httpStatus: 201 };
  } catch (fehler: unknown) {
    return ergebnisFuerFehler(fehler);
  }
}

export function pruefeHinweise(jetzt = new Date()): Promise<number> {
  return sendeHinweiseWennBereit(oeffentlicherVapidSchluessel() !== null, sendeWebPush, jetzt);
}
