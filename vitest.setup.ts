import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verweigereEchteDatenbank } from './server/testpfad.ts';

const kennung = process.env.VITEST_WORKER_ID ?? process.env.VITEST_POOL_ID ?? String(process.pid);
const ordner = path.join(os.tmpdir(), 'stride-vitest', kennung);
mkdirSync(ordner, { recursive: true });
process.env.DB_PFAD = path.join(ordner, 'app.db');
process.env.ZUGANG_PFAD = path.join(ordner, 'zugang.db');
verweigereEchteDatenbank(process.env.DB_PFAD);
verweigereEchteDatenbank(process.env.ZUGANG_PFAD);
