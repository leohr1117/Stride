import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { verweigereEchteDatenbank } from '../server/testpfad.ts';
import { TEST_APP, TEST_KOPIE, TEST_ZUGANG } from './testdaten.ts';

function kopiereDatei(von: string, nach: string): void {
  fs.mkdirSync(path.dirname(nach), { recursive: true });
  fs.copyFileSync(von, nach);
  const wal = `${von}-wal`;
  const zielWal = `${nach}-wal`;
  if (fs.existsSync(wal)) {
    fs.copyFileSync(wal, zielWal);
  } else if (fs.existsSync(zielWal)) {
    fs.rmSync(zielWal, { force: true });
  }
  fs.rmSync(`${nach}-shm`, { force: true });
}

function lesbar(pfad: string): boolean {
  verweigereEchteDatenbank(pfad);
  const datenbank = new DatabaseSync(pfad, { readOnly: true });
  try {
    const zeile = datenbank.prepare('PRAGMA integrity_check').get() as { integrity_check?: string } | undefined;
    return zeile?.integrity_check === 'ok';
  } finally {
    datenbank.close();
  }
}

function stelleSicher(pfad: string): void {
  const kopie = verweigereEchteDatenbank(pfad);
  try {
    if (lesbar(kopie)) return;
  } catch {
    // Die mitkopierte WAL kann bei einem laufenden Original unvollständig sein.
  }
  fs.rmSync(`${kopie}-wal`, { force: true });
  fs.rmSync(`${kopie}-shm`, { force: true });
  if (!lesbar(kopie)) {
    throw new Error(`Abbruch: Die Kopie ${kopie} ist nicht lesbar. Die echte Datenbank bleibt unberührt.`);
  }
}

export function erstelleTestkopie(): void {
  verweigereEchteDatenbank(TEST_APP);
  verweigereEchteDatenbank(TEST_ZUGANG);
  const quelle = path.resolve('data');
  kopiereDatei(path.join(quelle, 'app.db'), TEST_APP);
  kopiereDatei(path.join(quelle, 'zugang.db'), TEST_ZUGANG);
  const welten = path.join(quelle, 'welten');
  for (const name of fs.readdirSync(welten)) {
    if (!name.endsWith('.db')) continue;
    const ziel = path.join(TEST_KOPIE, 'welten', name);
    kopiereDatei(path.join(welten, name), ziel);
    stelleSicher(ziel);
  }
  stelleSicher(TEST_APP);
  stelleSicher(TEST_ZUGANG);
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
