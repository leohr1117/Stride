import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { schreibePfadVariable } from './server/umgebung.ts';
import { verweigereEchteDatenbank } from './server/testpfad.ts';

const kennung = process.env.VITEST_WORKER_ID ?? process.env.VITEST_POOL_ID ?? String(process.pid);
const ordner = path.join(os.tmpdir(), 'stride-vitest', kennung);
mkdirSync(ordner, { recursive: true });
const app = path.join(ordner, 'app.db');
const zugang = path.join(ordner, 'zugang.db');
schreibePfadVariable('DB_PFAD', app);
schreibePfadVariable('ZUGANG_PFAD', zugang);
verweigereEchteDatenbank(app);
verweigereEchteDatenbank(zugang);
