import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { measureRenderedText, type TextMeasurement } from '../support/contrast.js';
import { galleryEntryIds, openGalleryEntry, THEMES, type Theme } from '../support/gallery.js';
import { openWorstPointStage } from '../support/worstPoints.js';

// DSN-050: contrast measured on the rendered pixels (text hidden, screenshot, text colour
// composited per pixel), not estimated from tokens.

async function attach(testInfo: TestInfo, rows: readonly TextMeasurement[]): Promise<void> {
  await testInfo.attach('contrast.json', {
    body: JSON.stringify(
      rows.map((row) => ({ ...row, worst: Math.round(row.worst * 100) / 100 })),
      null,
      2,
    ),
    contentType: 'application/json',
  });
}

function failing(rows: readonly TextMeasurement[]): string[] {
  return rows
    .filter((row) => row.worst < row.required)
    .map(
      (row) =>
        `${row.tag} "${row.text}" ${row.color} on ${row.worstBackground}: ${row.worst.toFixed(2)} < ${String(row.required)}`,
    );
}

test.describe('every gallery entry', () => {
  for (const entry of galleryEntryIds) {
    for (const theme of THEMES) {
      test(`text contrast ${entry} ${theme}`, async ({ page }, testInfo) => {
        await openGalleryEntry(page, entry, theme);

        // Modal, drawer and sheet panels render through a portal onto the scrim: measure the
        // panel when one is open (the page behind it is inert), else the entry itself.
        const open = (await page.locator('[role="dialog"]').count()) > 0;
        const rows = await measureRenderedText(page, open ? '[role="dialog"]' : '#gallery-main');
        await attach(testInfo, rows);

        expect(failing(rows)).toEqual([]);
      });
    }
  }
});

// D7-SPEC R2.6: the worst points, rebuilt from the real tokens and measured in the browser.
const TEXTS_PER_STAGE: Readonly<Record<string, number>> = {
  'frosted-over-bloom': 4,
  'clear-over-sun': 4,
  'frosted-over-sun': 4,
  'accent-ink-on-light-solid': 1,
};
const WORST_POINTS: Readonly<Record<Theme, readonly string[]>> = {
  dark: ['frosted-over-bloom', 'accent-ink-on-light-solid'],
  light: ['clear-over-sun', 'frosted-over-sun', 'accent-ink-on-light-solid'],
};

for (const theme of THEMES) {
  test.describe(`R2.6 worst points ${theme}`, () => {
    test(`dim, faint, fg and accent text hold AA ${theme}`, async ({ page }, testInfo) => {
      const rows = await measureWorstPoints(page, theme);
      await attach(testInfo, rows);

      const expectedRows = WORST_POINTS[theme].map((point) => TEXTS_PER_STAGE[point] ?? 0);
      const measuredRows = WORST_POINTS[theme].map(
        (point) => rows.filter((row) => row.text.startsWith(`${point} / `)).length,
      );
      expect(measuredRows).toEqual(expectedRows);
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
