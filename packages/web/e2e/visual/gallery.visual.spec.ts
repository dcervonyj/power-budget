import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { discoverGalleryEntryIds } from './discoverEntries.js';

const THEMES = ['dark', 'light'] as const;
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const entryIds = discoverGalleryEntryIds();

async function openEntry(page: Page, entry: string, theme: string): Promise<void> {
  await page.goto(`/gallery.html?${new URLSearchParams({ entry, theme }).toString()}`);
  await page.locator('#gallery-main').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

test('gallery index lists every discovered entry', async ({ page }) => {
  await page.goto('/gallery.html');
  const listed = await page.getByTestId('gallery-index').locator('li').allInnerTexts();

  expect(entryIds.length).toBeGreaterThan(0);
  expect(listed.map((text) => text.split(/\s/)[0]).sort()).toEqual(entryIds);
});

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const entry of entryIds) {
      for (const theme of THEMES) {
        test(`${entry} ${theme}`, async ({ page }) => {
          await openEntry(page, entry, theme);

          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await expect(page).toHaveScreenshot(`${entry}-${theme}-${viewport.name}.png`, {
            fullPage: true,
            animations: 'disabled',
          });
        });
      }
    }
  });
}

for (const entry of entryIds) {
  for (const theme of THEMES) {
    test(`axe ${entry} ${theme}`, async ({ page }) => {
      await openEntry(page, entry, theme);

      const { violations } = await new AxeBuilder({ page }).analyze();
      const blocking = violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      );

      expect(blocking.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
    });
  }
}
