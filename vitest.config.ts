import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const testDaten = path.join(os.tmpdir(), 'ascend-vitest');
mkdirSync(testDaten, { recursive: true });

export default defineConfig({
  test: {
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts', 'client/src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    env: {
      DB_PFAD: path.join(testDaten, 'app.db'),
      ZUGANG_PFAD: path.join(testDaten, 'zugang.db'),
    },
  },
});
