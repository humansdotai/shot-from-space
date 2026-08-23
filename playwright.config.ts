import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * SHOT FROM SPACE — automated test suite.
 *
 * Three projects, one runner:
 *
 *   unit         pure functions. No database, no browser, fully parallel.
 *   integration  the mission layer against the real SQLite file. Serial,
 *                because it writes; every test deletes exactly what it made.
 *   e2e          Chromium against the dev server already running on :3200.
 *
 * The server is NOT started by this config. Port 3200 belongs to the running
 * dev process and port 3000 is a different project entirely — never target it.
 * Override with BASE_URL if the dev server moves.
 *
 *   npx playwright test                     everything
 *   npx playwright test --project=unit      pure functions only
 *   npx playwright test --project=e2e       browser only
 */

const ROOT = __dirname;

// DATABASE_URL and MOCK_MODE live in .env; the integration project talks to
// the same SQLite file the dev server does, so it has to read them.
if (existsSync(path.join(ROOT, '.env'))) {
  process.loadEnvFile(path.join(ROOT, '.env'));
}

export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3200';

export default defineConfig({
  testDir: './tests',
  // Sweeps anything an interrupted test left behind. It can only reach records
  // in this suite's own sfs-qa+…@example.test namespace.
  globalTeardown: './tests/support/global-teardown.ts',
  // Nothing in this suite waits on wall-clock time, so the budgets are tight
  // on purpose: a test that needs longer is a test that is sleeping.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  // Traces, screenshots and the HTML report stay inside tests/ — this suite
  // does not scatter artefacts across the repo root.
  outputDir: './tests/.artifacts/results',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'unit',
      testDir: './tests/unit',
      fullyParallel: true,
    },
    {
      name: 'integration',
      testDir: './tests/integration',
      // One writer at a time against one SQLite file.
      fullyParallel: false,
      workers: 1,
    },
    {
      name: 'e2e',
      testDir: './tests/e2e',
      fullyParallel: true,
      // SQLite runs in rollback-journal mode, so the dev server and the test
      // workers are competing writers. Three keeps the suite quick without
      // turning every cleanup into a lock fight.
      workers: 3,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
