import { createRequire } from 'node:module';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { discoverGalleryEntryIds } from './discoverEntries';

// @axe-core/playwright is a dependency of the web package; mobile does not add its own copy.
const nodeRequire = createRequire(__filename);
const AxeBuilder = nodeRequire(
  nodeRequire.resolve('@axe-core/playwright', { paths: [join(__dirname, '../../../web')] }),
).default;

const THEMES = ['dark', 'light'] as const;
const WIDTH = 390;
const MIN_HEIGHT = 844;

const entryIds = discoverGalleryEntryIds();

// A page error (for example Skia used before CanvasKit is loaded) leaves canvases blank, so every
// entry must open without one.
function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  return errors;
}

async function openEntry(page: Page, entry: string, theme: string): Promise<void> {
  await page.goto(`/?${new URLSearchParams({ entry, theme }).toString()}`);
  await page.locator('#gallery-main').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

// The gallery scrolls inside its own ScrollView, so the viewport grows to fit the entry.
async function fitViewportToContent(page: Page): Promise<void> {
  const height = await page.evaluate(
    () => document.getElementById('gallery-main')?.scrollHeight ?? 0,
  );
  await page.setViewportSize({ width: WIDTH, height: Math.max(MIN_HEIGHT, height) });
}

test('gallery index lists every discovered entry', async ({ page }) => {
  await page.goto('/');
  const index = page.getByTestId('gallery-index');
  await index.waitFor();
  const text = await index.innerText();

  expect(entryIds.length).toBeGreaterThan(0);
  for (const entry of entryIds) {
    expect(text).toContain(entry);
  }
});

for (const entry of entryIds) {
  for (const theme of THEMES) {
    test(`${entry} ${theme}`, async ({ page }) => {
      const errors = collectPageErrors(page);
      await openEntry(page, entry, theme);
      await fitViewportToContent(page);

      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(errors).toEqual([]);
      await expect(page).toHaveScreenshot(`${entry.replace('/', '-')}-${theme}.png`, {
        animations: 'disabled',
      });
    });

    test(`axe ${entry} ${theme}`, async ({ page }) => {
      await openEntry(page, entry, theme);

      const { violations } = await new AxeBuilder({ page }).analyze();
      const blocking = violations.filter(
        (violation: { impact?: string | null }) =>
          violation.impact === 'serious' || violation.impact === 'critical',
      );

      expect(
        blocking.map(
          (violation: { id: string; help: string }) => `${violation.id}: ${violation.help}`,
        ),
      ).toEqual([]);
    });
  }
}
