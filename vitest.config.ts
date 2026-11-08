import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const testDaten = path.join(os.tmpdir(), 'stride-vitest');
mkdirSync(testDaten, { recursive: true });
const testApp = path.join(testDaten, 'app.db');
const testZugang = path.join(testDaten, 'zugang.db');

export default defineConfig({
  test: {
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts', 'client/src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    env: {
      STRIDE_DB_PFAD: testApp,
      DB_PFAD: testApp,
      STRIDE_ZUGANG_PFAD: testZugang,
      ZUGANG_PFAD: testZugang,
    },
  },
});
