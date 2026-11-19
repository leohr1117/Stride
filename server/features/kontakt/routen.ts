import type { FastifyInstance, FastifyRequest } from 'fastify';
import { kontaktErlaubt } from '../../anfrageGrenzen.ts';
import { AppFehler, ungueltig } from '../../fehler.ts';
import { clientAdresse } from '../zugang/routen.ts';
import { kontaktSchema } from '../../validierung.ts';
import { liesSmtp, sendeBrief, type KontaktBrief, type SmtpZugang } from './smtp.ts';

type Versand = (brief: KontaktBrief, zugang: SmtpZugang) => Promise<unknown>;

let ersatz: Versand | null = null;

export function setzeKontaktVersand(fn: Versand | null): void {
  ersatz = fn;
}

function adresseVon(anfrage: FastifyRequest): string {
  return clientAdresse(anfrage.ip, {
    cfConnectingIp: anfrage.headers['cf-connecting-ip'],
    xForwardedFor: anfrage.headers['x-forwarded-for'],
  });
}

function honeypot(roh: unknown): boolean {
  if (roh === null || typeof roh !== 'object') {
    return false;
  }
  const wert = (roh as { website?: unknown }).website;
  return typeof wert === 'string' && wert.trim().length > 0;
}

function kontaktEingabe(roh: unknown): unknown {
  if (roh === null || typeof roh !== 'object') {
    return roh;
  }
  const quelle = roh as Record<string, unknown>;
  const eingabe: Record<string, unknown> = {};
  if (Object.prototype.hasOwnProperty.call(quelle, 'name')) {
    eingabe.name = quelle.name;
  }
  if (Object.prototype.hasOwnProperty.call(quelle, 'email')) {
    eingabe.email = quelle.email;
  }
  if (Object.prototype.hasOwnProperty.call(quelle, 'nachricht')) {
    eingabe.nachricht = quelle.nachricht;
  }
  return eingabe;
}

function fehlerCode(fehler: unknown): string {
  if (fehler !== null && typeof fehler === 'object' && 'code' in fehler) {
    const code = (fehler as { code: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return code;
    }
  }
  return 'unbekannt';
}

export async function kontaktRouten(app: FastifyInstance): Promise<void> {
  app.get('/kontakt', async () => ({ verfuegbar: liesSmtp() !== null }));

  app.post('/kontakt', async (anfrage) => {
    if (honeypot(anfrage.body)) {
      return { ok: true };
    }
    const zugang = liesSmtp();
    if (!zugang) {
      throw new AppFehler(503, 'Das Kontaktformular ist nicht verfügbar.');
    }
    if (!kontaktErlaubt(adresseVon(anfrage))) {
      throw new AppFehler(429, 'Zu viele Versuche. Bitte später erneut versuchen.');
    }
    const geprueft = kontaktSchema.safeParse(kontaktEingabe(anfrage.body));
    if (!geprueft.success) {
      throw ungueltig(geprueft.error.issues[0]?.message ?? 'Ungültige Eingabe.');
    }
    const brief: KontaktBrief = {
      name: geprueft.data.name ?? '',
      email: geprueft.data.email,
      nachricht: geprueft.data.nachricht,
    };
    try {
      if (ersatz) {
        await ersatz(brief, zugang);
      } else {
        await sendeBrief(brief, zugang);
      }
    } catch (fehler) {
      anfrage.log.error({ code: fehlerCode(fehler) }, 'Kontaktversand fehlgeschlagen');
      throw new AppFehler(502, 'Die Nachricht konnte nicht gesendet werden. Bitte versuch es später noch einmal.');
    }
    return { ok: true };
  });
}
