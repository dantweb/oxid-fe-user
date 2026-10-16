import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: 'tests/e2e/.env', quiet: true });

/** Point the suite at a deployed storefront (e.g. https://daniil.oxiddev.de:8443). */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

/** Screens the peroxid layout must work on. Playwright ships no Galaxy S25 descriptor yet. */
const RESPONSIVE_DEVICES = {
  'iphone-17-pro': { ...devices['iPhone 17 Pro'] },
  'galaxy-s24': { ...devices['Galaxy S24'] },
  'galaxy-s25-ultra': {
    ...devices['Galaxy S24'],
    viewport: { width: 412, height: 915 },
    screen: { width: 412, height: 915 },
    deviceScaleFactor: 3.5,
    userAgent:
      'Mozilla/5.0 (Linux; Android 15; SM-S938B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  },
  'galaxy-z-fold-7': { ...devices['Galaxy Z Fold 7'] },
};

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  // deployed targets sit behind a tunnel: lazy route chunks need more than the default 5 s
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /peroxid-responsive/,
    },
    // Device profiles for the responsiveness proof (tests/e2e/peroxid-responsive.spec.ts).
    // iPhone runs in WebKit, the engine of every iPhone browser (`npx playwright install webkit`);
    // the Samsung screens run in Chromium, like Samsung Internet / Chrome on Android.
    ...Object.entries(RESPONSIVE_DEVICES).map(([name, use]) => ({
      name,
      use,
      testMatch: /peroxid-responsive\.spec\.ts/,
    })),
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev -- --port 5173',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
