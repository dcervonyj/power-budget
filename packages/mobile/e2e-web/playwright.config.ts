import { defineConfig } from '@playwright/test';

// DSN-031: the mobile gallery, exported for web (`pnpm build:gallery`) and served statically, is
// screenshotted and axe-checked per entry and theme. `pnpm test:visual` runs this inside the
// pinned Playwright docker image; CI runs it in the same image.
const GALLERY_URL = 'http://localhost:4175';

export default defineConfig({
  testDir: './visual',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  // axe is slow under the amd64 emulation of the docker image on Apple silicon.
  timeout: 120_000,
  outputDir: '../test-results',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  use: { baseURL: GALLERY_URL, trace: 'retain-on-failure' },
  webServer: {
    // Needs `pnpm build:gallery` first (run by test:visual and by the CI job).
    command: 'node serve-static.mjs',
    url: `${GALLERY_URL}/index.html`,
    timeout: 60_000,
    reuseExistingServer: !process.env['CI'],
  },
  projects: [
    {
      name: 'visual',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
      },
      expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
    },
  ],
});
