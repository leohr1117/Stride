import { defineConfig } from '@playwright/test';
import { TEST_URL, TEST_WELT } from './e2e/testdaten.ts';

process.env.ASCEND_TEST = '1';
process.env.PLAYWRIGHT_WELT = TEST_WELT;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: TEST_URL,
    serviceWorkers: 'block',
    locale: 'de-DE',
  },
  projects: [
    { name: 'handy', use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
});
