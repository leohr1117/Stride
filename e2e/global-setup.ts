import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { starteTodoistAttrappe, type TodoistAttrappe } from '../server/integrationen/todoistAttrappe.ts';
import { verweigereEchteDatenbank } from '../server/testpfad.ts';
import { erstelleTestkopie, loescheTestkopie } from './kopie.ts';
import { TEST_APP, TEST_PORT, TEST_URL, TEST_ZUGANG, WURZEL } from './testdaten.ts';

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
        datum: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        projektId: 'p-post',
        inhalt: 'Alte Aufgabe',
        labels: [],
        dauer: null,
        deadline: null,
      },
    ],
  });

  const kind = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.ts'], {
    cwd: WURZEL,
    env: {
      ...process.env,
      ASCEND_TEST: '1',
      PORT: String(TEST_PORT),
      DB_PFAD: TEST_APP,
      ZUGANG_PFAD: TEST_ZUGANG,
      TODOIST_API: attrappe.basis,
    },
    stdio: 'inherit',
    windowsHide: true,
  });

  try {
    await warteAufServer(kind);
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
