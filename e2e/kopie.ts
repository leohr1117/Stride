import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { verweigereEchteDatenbank } from '../server/testpfad.ts';
import { TEST_APP, TEST_KOPIE, TEST_WELT, TEST_ZUGANG, WURZEL } from './testdaten.ts';

export function erstelleTestkopie(): void {
  verweigereEchteDatenbank(TEST_APP);
  verweigereEchteDatenbank(TEST_ZUGANG);
  verweigereEchteDatenbank(TEST_WELT);
  const ergebnis = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'e2e/samen.ts'], {
    cwd: WURZEL,
    env: {
      ...process.env,
      STRIDE_TEST: '1',
      DB_PFAD: TEST_APP,
      ZUGANG_PFAD: TEST_ZUGANG,
    },
    stdio: 'inherit',
    windowsHide: true,
  });
  if (ergebnis.status !== 0) {
    throw new Error(`Abbruch: Die Testwelt ließ sich nicht anlegen (Code ${ergebnis.status ?? 'kein'}).`);
  }
  if (!fs.existsSync(TEST_WELT)) {
    throw new Error(`Abbruch: Die Testwelt ${TEST_WELT} fehlt.`);
  }
}

export async function loescheTestkopie(): Promise<void> {
  for (let versuch = 0; versuch < 15; versuch += 1) {
    try {
      fs.rmSync(TEST_KOPIE, { recursive: true, force: true });
      return;
    } catch (fehler) {
      const code = (fehler as NodeJS.ErrnoException).code;
      if (code !== 'EPERM' && code !== 'EBUSY' && code !== 'ENOTEMPTY') throw fehler;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  fs.rmSync(TEST_KOPIE, { recursive: true, force: true });
}
