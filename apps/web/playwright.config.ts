import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests: a real Chromium against the real API (with workers, real Postgres, Mongo,
 * Redis and RabbitMQ from `docker compose up -d`) and a production build of the dashboard.
 * The API uses its own `apexmonitor_e2e` stores, reset on every start (apps/server/test/e2e/serve.ts).
 *
 *   npm run test:e2e            (repo root)
 */
const API_PORT = Number(process.env.E2E_API_PORT ?? 3100);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3101);
export const API_URL = `http://localhost:${API_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  // The tests share one API; each creates its own user and project, so files may run in parallel.
  fullyParallel: false,
  workers: CI ? 1 : 2,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run e2e:api --workspace=apps/server',
      cwd: '../..',
      url: `${API_URL}/ready`,
      env: { E2E_API_PORT: String(API_PORT), E2E_WEB_ORIGIN: WEB_URL },
      timeout: 120_000,
      reuseExistingServer: !CI,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `npx next build && npx next start -p ${WEB_PORT}`,
      url: WEB_URL,
      env: {
        NEXT_DIST_DIR: '.next-e2e',
        NEXT_PUBLIC_API_URL: API_URL,
        NEXT_PUBLIC_WS_URL: API_URL,
        WEB_SESSION_COOKIE_CHECK: 'true',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      timeout: 300_000,
      reuseExistingServer: !CI,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
