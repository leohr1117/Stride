import { defineConfig, devices } from '@playwright/test';
import { TEST_URL, TEST_WELT } from './e2e/testdaten.ts';

const iphone = devices['iPhone 13'];

process.env.STRIDE_TEST = '1';
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
    timezoneId: 'Europe/Berlin',
  },
  projects: [
    {
      name: 'handy',
      use: {
        browserName: 'chromium',
        viewport: iphone.viewport,
        deviceScaleFactor: iphone.deviceScaleFactor,
        isMobile: iphone.isMobile,
        hasTouch: iphone.hasTouch,
      },
    },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
  ],
});
