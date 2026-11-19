import { createTransport, type SendMailOptions } from 'nodemailer';
import { KONTAKT_BETREFF, KONTAKT_EMPFAENGER } from '../../../shared/kontakt.ts';
import { strideVariable } from '../../umgebung.ts';

export interface SmtpZugang {
  host: string;
  port: number;
  benutzer: string;
  passwort: string;
}

export interface KontaktBrief {
  name: string;
  email: string;
  nachricht: string;
}

const VERBINDUNG_MS = 10_000;
const SOCKET_MS = 15_000;

function gesetzt(wert: string | undefined): string | null {
  if (wert === undefined) {
    return null;
  }
  const text = wert.trim();
  return text.length > 0 ? text : null;
}

export function liesSmtp(env: NodeJS.ProcessEnv = process.env): SmtpZugang | null {
  const host = gesetzt(strideVariable('SMTP_HOST', env));
  const portText = gesetzt(strideVariable('SMTP_PORT', env));
  const benutzer = gesetzt(strideVariable('SMTP_BENUTZER', env));
  const passwort = strideVariable('SMTP_PASSWORT', env);
  if (!host || !portText || !benutzer || passwort === undefined || passwort.trim().length === 0) {
    return null;
  }
  if (!/^\d+$/.test(portText)) {
    return null;
  }
  const port = Number(portText);
  if (port < 1 || port > 65535) {
    return null;
  }
  return { host, port, benutzer, passwort };
}

function eineZeile(name: string): string {
  return name.replace(/[\r\n"]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function antwortAdresse(name: string, email: string): string {
  const sauber = eineZeile(name);
  if (!sauber) {
    return email;
  }
  return `"${sauber}" <${email}>`;
}

export function kontaktText(name: string, email: string, nachricht: string): string {
  const zeile = eineZeile(name);
  return `Name: ${zeile.length > 0 ? zeile : '—'}\nE-Mail: ${email}\n\n${nachricht}`;
}

export function briefOptionen(brief: KontaktBrief, zugang: SmtpZugang): SendMailOptions {
  return {
    from: zugang.benutzer,
    to: KONTAKT_EMPFAENGER,
    replyTo: antwortAdresse(brief.name, brief.email),
    subject: KONTAKT_BETREFF,
    text: kontaktText(brief.name, brief.email, brief.nachricht),
  };
}

export async function sendeBrief(
  brief: KontaktBrief,
  zugang: SmtpZugang,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  const mail = briefOptionen(brief, zugang);
  if (env.STRIDE_TEST === '1') {
    const transport = createTransport({ jsonTransport: true });
    try {
      return await transport.sendMail(mail);
    } finally {
      transport.close();
    }
  }
  const transport = createTransport({
    host: zugang.host,
    port: zugang.port,
    secure: zugang.port === 465,
    auth: { user: zugang.benutzer, pass: zugang.passwort },
    connectionTimeout: VERBINDUNG_MS,
    greetingTimeout: VERBINDUNG_MS,
    socketTimeout: SOCKET_MS,
  });
  try {
    return await transport.sendMail(mail);
  } finally {
    transport.close();
  }
}
