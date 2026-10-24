import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Einstellungen } from '../../shared/api/index.ts';
import { migriere, uebernimmDatenbank } from '../db.ts';
import { sperreEchteDatenbankImTest } from '../testpfad.ts';
import { schalteErfolgeFrei } from '../features/erfolge/erfolge.ts';
import { ladeEinstellungen } from '../features/einstellungen/einstellungen.ts';

const NEBENDATEIEN = ['', '-journal', '-wal', '-shm'];

function entferne(pfad: string): void {
  for (const endung of NEBENDATEIEN) {
    fs.rmSync(`${pfad}${endung}`, { force: true });
  }
}

export function setzeProfilZurueck(): Einstellungen {
  const pfad = path.join(os.tmpdir(), `ascend-neustart-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
  try {
    sperreEchteDatenbankImTest(pfad);
    const frisch = new DatabaseSync(pfad);
    try {
      migriere(frisch);
    } finally {
      frisch.close();
    }
    uebernimmDatenbank(pfad);
    schalteErfolgeFrei();
    return ladeEinstellungen();
  } finally {
    entferne(pfad);
  }
}
