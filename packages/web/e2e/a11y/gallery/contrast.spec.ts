import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { measureRenderedText, type TextMeasurement } from '../support/contrast.js';
import { galleryEntryIds, openGalleryEntry, THEMES, type Theme } from '../support/gallery.js';
import { openWorstPointStage } from '../support/worstPoints.js';

// DSN-050: contrast measured on the rendered pixels (text hidden, screenshot, text colour
// composited per pixel), not estimated from tokens.

async function attach(testInfo: TestInfo, rows: readonly TextMeasurement[]): Promise<void> {
  await testInfo.attach('contrast.json', {
    body: JSON.stringify(rows, null, 2),
    contentType: 'application/json',
  });
}

function failing(rows: readonly TextMeasurement[]): string[] {
  return rows
    .filter((row) => row.worst < row.required)
    .map(
      (row) =>
        `${row.tag} "${row.text}" ${row.color} on ${row.worstBackground}: ${String(row.worst)} < ${String(row.required)}`,
    );
}

test.describe('every gallery entry', () => {
  for (const entry of galleryEntryIds) {
    for (const theme of THEMES) {
      test(`text contrast ${entry} ${theme}`, async ({ page }, testInfo) => {
        await openGalleryEntry(page, entry, theme);

        const rows = await measureRenderedText(page, '#gallery-main');
        await attach(testInfo, rows);

        expect(failing(rows)).toEqual([]);
      });
    }
  }
});

// D7-SPEC R2.6: the worst points, rebuilt from the real tokens and measured in the browser.
const WORST_POINTS: Readonly<Record<Theme, readonly string[]>> = {
  dark: ['frosted-over-bloom'],
  light: ['clear-over-sun', 'frosted-over-sun', 'accent-ink-on-light-solid'],
};

for (const theme of THEMES) {
  test.describe(`R2.6 worst points ${theme}`, () => {
    test(`dim, faint, fg and accent text hold AA ${theme}`, async ({ page }, testInfo) => {
      const rows = await measureWorstPoints(page, theme);
      await attach(testInfo, rows);

      expect(rows.length).toBeGreaterThan(0);
      expect(failing(rows)).toEqual([]);
    });
  });
}

async function measureWorstPoints(page: Page, theme: Theme): Promise<TextMeasurement[]> {
  await openGalleryEntry(page, galleryEntryIds[0] ?? '', theme);
  const rows: TextMeasurement[] = [];
  for (const point of WORST_POINTS[theme]) {
    await openGalleryEntry(page, galleryEntryIds[0] ?? '', theme);
    await openWorstPointStage(page, point);
    const measured = await measureRenderedText(page, '[data-worst-point]');
    rows.push(...measured.map((row) => ({ ...row, text: `${point} / ${row.text}` })));
  }

  return rows;
}
