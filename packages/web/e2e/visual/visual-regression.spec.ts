import { test, expect } from '@playwright/test';

/**
 * Visual regression tests: 5 screens × 4 locales = 20 baseline snapshots.
 *
 * Run with a live dev server:
 *   pnpm exec playwright test --project=visual
 *
 * Regenerate baselines:
 *   pnpm exec playwright test --project=visual --update-snapshots
 */

const LOCALES = ['en', 'uk', 'ru', 'pl'] as const;

type Locale = (typeof LOCALES)[number];

const SCREENS: Array<{ name: string; path: string }> = [
  { name: 'login', path: '/login' },
  { name: 'dashboard', path: '/dashboard' },
  { name: 'transactions', path: '/transactions' },
  { name: 'plan-editor', path: '/plans' },
  { name: 'settings', path: '/settings' },
];

async function setLocale(page: import('@playwright/test').Page, locale: Locale): Promise<void> {
  await page.evaluate((loc) => localStorage.setItem('pb_locale', loc), locale);
}

test.describe('visual regression @visual', () => {
  test.beforeEach(async ({ page }) => {
    // Skip gracefully when dev server is not reachable
    try {
      await page.goto('/', { timeout: 5000 });
    } catch {
      test.skip(true, 'Dev server not running — skipping visual regression');
    }
  });

  for (const locale of LOCALES) {
    for (const screen of SCREENS) {
      test(`${screen.name} [${locale}]`, async ({ page }) => {
        // Set locale via localStorage before navigation
        await setLocale(page, locale);

        // Navigate with locale query param as well (belt-and-suspenders)
        await page.goto(`${screen.path}?locale=${locale}`);

        // Wait for the page to be visually stable
        await page.waitForLoadState('networkidle');

        await expect(page).toHaveScreenshot(`${screen.name}-${locale}.png`, {
          maxDiffPixelRatio: 0.01,
          // Clip to viewport only (no full-page scroll) to keep snapshot size small
          clip: { x: 0, y: 0, width: 1280, height: 720 },
        });
      });
    }
  }
});
