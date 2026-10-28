import { defineConfig, devices } from '@playwright/test';
import { FULL_STACK, STACK } from './e2e/support/stack.js';

// TEST_ENV=e2e: the whole suite runs against a real backend (CLN-017). Playwright
// starts the fake Resend API, the backend (scripts/e2e-backend.sh: migrations, app
// role, seeds, API with the embedded worker) and a production build of the web app;
// Postgres and Redis must already run (docker/e2e/docker-compose.yml). Without TEST_ENV only the
// @smoke specs run, against whatever serves BASE_URL (e.g. `pnpm dev`).
const smokeGrep = FULL_STACK ? undefined : /smoke/;

// DSN-011: `PW_VISUAL=1` runs only the gallery projects (`visual`, DSN-050 `a11y`) against the
// gallery build (no backend). `pnpm test:visual` sets it inside the pinned Playwright docker image.
// DSN-050: the `a11y-stack` project (axe and keyboard pass on the real app pages) needs the e2e
// stack like `chromium` does: `pnpm test:a11y:stack`.
const VISUAL = process.env['PW_VISUAL'] === '1';
const GALLERY_URL = 'http://localhost:4174';
// The docker image mounts the host node_modules (no Linux native vite binaries), so there
// the already built gallery is served by a plain static server instead of `vite preview`.
const GALLERY_SERVER_COMMAND =
  process.env['VISUAL_STATIC'] === '1'
    ? 'node e2e/visual/serve-static.mjs'
    : 'pnpm exec vite preview --mode gallery --port 4174 --strictPort';

// Gallery specs (visual, a11y/gallery) never run in the stack projects; a11y/stack has its own.
const NON_STACK_SPECS = /(visual|a11y)\//;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: !FULL_STACK,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  // One worker on the real stack: the auth endpoints are rate limited per IP.
  workers: FULL_STACK || process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  snapshotPathTemplate: '{testDir}/visual/__screenshots__/{arg}{ext}',
  use: {
    baseURL: VISUAL ? GALLERY_URL : STACK.webUrl,
    trace: 'retain-on-failure',
  },
  webServer: VISUAL
    ? {
        // Needs `pnpm build:gallery` first (run by test:visual and by the CI job).
        command: GALLERY_SERVER_COMMAND,
        url: `${GALLERY_URL}/gallery.html`,
        timeout: 60_000,
        reuseExistingServer: !process.env['CI'],
      }
    : FULL_STACK
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
  projects: VISUAL
    ? [
        {
          name: 'visual',
          testMatch: /visual\/.*\.spec\.ts/,
          use: { ...devices['Desktop Chrome'], reducedMotion: 'reduce' },
          expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
        },
        {
          name: 'a11y',
          testMatch: /a11y\/gallery\/.*\.spec\.ts/,
          use: { ...devices['Desktop Chrome'], reducedMotion: 'reduce' },
        },
      ]
    : [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
          grep: smokeGrep,
          testIgnore: NON_STACK_SPECS,
        },
        {
          name: 'firefox',
          use: { ...devices['Desktop Firefox'] },
          grep: smokeGrep,
          testIgnore: NON_STACK_SPECS,
        },
        {
          name: 'webkit',
          use: { ...devices['Desktop Safari'] },
          grep: smokeGrep,
          testIgnore: NON_STACK_SPECS,
        },
        {
          name: 'a11y-stack',
          testMatch: /a11y\/stack\/.*\.spec\.ts/,
          use: { ...devices['Desktop Chrome'], reducedMotion: 'reduce' },
        },
      ],
});
