import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { AKTUELLE_VERSION } from '../shared/versionen.ts';
import { starteTodoistAttrappe, type TodoistAttrappe } from '../server/integrationen/todoistAttrappe.ts';
import { leereGeerbteZugangsVariablen, verweigereEchteDatenbank } from '../server/testpfad.ts';
import { mitDatenbankPfaden } from '../server/umgebung.ts';
import { erstelleTestkopie, loescheTestkopie } from './kopie.ts';
import {
  TEST_APP,
  TEST_GOOGLE_CLIENT_ID,
  TEST_GOOGLE_CLIENT_SECRET,
  TEST_PASSWORT,
  TEST_PORT,
  TEST_URL,
  TEST_ZUGANG,
  WURZEL,
} from './testdaten.ts';
import { TESTDATUM, testJetzt } from './uhr.ts';

function portFrei(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const pruefung = net.createServer();
    pruefung.once('error', () => resolve(false));
    pruefung.once('listening', () => {
      pruefung.close(() => resolve(true));
    });
    pruefung.listen(port, '127.0.0.1');
  });
}

async function warteAufServer(kind: ChildProcess): Promise<void> {
  const ende = Date.now() + 30_000;
  let letzter = 'keine Antwort';
  while (Date.now() < ende) {
    if (kind.exitCode !== null) {
      throw new Error(`Testserver endete vor dem Start (Code ${kind.exitCode}).`);
    }
    try {
      const antwort = await fetch(TEST_URL);
      if (antwort.status < 500) return;
      letzter = `Status ${antwort.status}`;
    } catch (fehler) {
      letzter = fehler instanceof Error ? fehler.message : 'Netzwerkfehler';
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Testserver auf ${TEST_URL} nicht bereit: ${letzter}`);
}

async function setzeTestuhr(): Promise<void> {
  const antwort = await fetch(`${TEST_URL}/api/test/heute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ datum: TESTDATUM }),
  });
  if (!antwort.ok) {
    throw new Error(`Testuhr ließ sich nicht setzen: ${antwort.status} ${await antwort.text()}`);
  }
}

async function setzeHinweisAktuell(): Promise<void> {
  const passwort = TEST_PASSWORT;
  const login = await fetch(`${TEST_URL}/api/zugang`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ benutzername: 'testvoll', passwort }),
  });
  if (!login.ok) {
    throw new Error(`Anmeldung für den Update-Hinweis fehlgeschlagen: ${login.status}`);
  }
  const keks = login.headers.getSetCookie().map((zeile) => zeile.split(';')[0]).join('; ');
  const schreiben = await fetch(`${TEST_URL}/api/version-hinweis`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', cookie: keks },
    body: JSON.stringify({ benachrichtigt: AKTUELLE_VERSION, gesehen: AKTUELLE_VERSION }),
  });
  if (!schreiben.ok) {
    throw new Error(`Update-Hinweis ließ sich nicht setzen: ${schreiben.status}`);
  }
}

function beende(kind: ChildProcess): Promise<void> {
  if (kind.exitCode !== null || kind.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (kind.exitCode === null && kind.pid !== undefined) {
        kind.kill('SIGKILL');
      }
    }, 2_000);
    kind.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    kind.kill();
  });
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  verweigereEchteDatenbank(TEST_APP);
  verweigereEchteDatenbank(TEST_ZUGANG);
  if (!(await portFrei(TEST_PORT))) {
    throw new Error(`Abbruch: Port ${TEST_PORT} ist belegt. Der echte Server auf 3000 bleibt unberührt.`);
  }
  await loescheTestkopie();
  erstelleTestkopie();

  const attrappe: TodoistAttrappe = await starteTodoistAttrappe({
    nutzer: 'Todoist Test',
    projekte: [
      { id: 'p-post', name: 'Posteingang' },
      { id: 'p-sport', name: 'Sport' },
    ],
    labels: [
      { id: 'l-lesen', name: 'Lesen' },
      { id: 'l-sport', name: 'Sport' },
    ],
    ereignisse: [
      {
        id: 'e-alt',
        aufgabeId: 'a-alt',
        datum: new Date(testJetzt().getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        projektId: 'p-post',
        inhalt: 'Alte Aufgabe',
        labels: [],
        dauer: null,
        deadline: null,
      },
    ],
  });

  const env = mitDatenbankPfaden({
    ...process.env,
    STRIDE_TEST: '1',
    STRIDE_ADMIN: 'testvoll',
    STRIDE_CLIENT_DIR: path.join(WURZEL, 'client', 'dist'),
    PORT: String(TEST_PORT),
    TODOIST_API: attrappe.basis,
    STRIDE_TOKEN_SCHLUESSEL: Buffer.from('stride-test-token-schluessel-v3!').toString('base64'),
    ASCEND_TOKEN_SCHLUESSEL: '',
  }, TEST_APP, TEST_ZUGANG);
  leereGeerbteZugangsVariablen(env);
  env.STRIDE_REGISTRIERUNG = '1';
  env.STRIDE_GOOGLE = '1';
  env.STRIDE_GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;
  env.STRIDE_GOOGLE_CLIENT_SECRET = TEST_GOOGLE_CLIENT_SECRET;
  env.STRIDE_SMTP_HOST = '127.0.0.1';
  env.STRIDE_SMTP_PORT = '9';
  env.STRIDE_SMTP_BENUTZER = 'kontakt@leohr.de';
  env.STRIDE_SMTP_PASSWORT = 'nur-test';

  const kind = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.ts'], {
    cwd: WURZEL,
    env,
    stdio: 'inherit',
    windowsHide: true,
  });

  try {
    await warteAufServer(kind);
    await setzeTestuhr();
    await setzeHinweisAktuell();
  } catch (fehler) {
    await beende(kind);
    await attrappe.stop();
    throw fehler;
  }

  return async () => {
    await beende(kind);
    await attrappe.stop();
  };
}
