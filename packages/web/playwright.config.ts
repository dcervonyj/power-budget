import { defineConfig, devices } from '@playwright/test';
import { FULL_STACK, STACK } from './e2e/support/stack.js';

// TEST_ENV=e2e: the whole suite runs against a real backend (CLN-017). Playwright
// starts the fake Resend API, the backend (scripts/e2e-backend.sh: migrations, app
// role, seeds, API with the embedded worker) and a production build of the web app;
// Postgres and Redis must already run (docker/e2e/docker-compose.yml). Without TEST_ENV only the
// @smoke specs run, against whatever serves BASE_URL (e.g. `pnpm dev`).
const smokeGrep = FULL_STACK ? undefined : /smoke/;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: !FULL_STACK,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  // One worker on the real stack: the auth endpoints are rate limited per IP.
  workers: FULL_STACK || process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL: STACK.webUrl,
    trace: 'retain-on-failure',
  },
  webServer: FULL_STACK
    ? [
        {
          command: 'node e2e/support/fake-resend.mjs',
          url: `${STACK.fakeResendUrl}/health`,
          env: { FAKE_RESEND_PORT: new URL(STACK.fakeResendUrl).port },
          reuseExistingServer: !process.env['CI'],
        },
        {
          // The backend built from the repo (see scripts/e2e-backend.sh).
          command: 'bash ../../scripts/e2e-backend.sh',
          url: `${STACK.apiUrl}/health`,
          timeout: 120_000,
          reuseExistingServer: !process.env['CI'],
          stdout: 'pipe',
        },
        {
          // A production build pointed at the e2e API, served by `vite preview`
          // (with the production CSP headers).
          command: `pnpm exec vite build && pnpm exec vite preview --port ${new URL(STACK.webUrl).port} --strictPort`,
          url: STACK.webUrl,
          env: { VITE_API_URL: STACK.apiUrl },
          timeout: 180_000,
          reuseExistingServer: !process.env['CI'],
        },
      ]
    : undefined,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      grep: smokeGrep,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      grep: smokeGrep,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      grep: smokeGrep,
    },
  ],
});
