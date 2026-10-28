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
    .filter((row) => !row.measured || row.worst < row.required)
    .map((row) =>
      row.measured
        ? `${row.tag} "${row.text}" ${row.color} on ${row.worstBackground}: ${row.worst.toFixed(2)} < ${String(row.required)}`
        : `${row.tag} "${row.text}" ${row.color}: no glyph pixel found where the text is drawn`,
    );
}

test.describe('every gallery entry', () => {
  for (const entry of galleryEntryIds) {
    for (const theme of THEMES) {
      test(`text contrast ${entry} ${theme}`, async ({ page }, testInfo) => {
        await openGalleryEntry(page, entry, theme);

        // Modal, drawer and sheet panels render through a portal onto the scrim: measure the
        // panel when one is open (the page behind it is inert), else the entry itself. The
        // account menu is a non-modal dialog inside the shell, so the shell is measured.
        const modal = (await page.locator('[role="dialog"][aria-modal="true"]').count()) > 0;
        const rows = await measureRenderedText(
          page,
          modal ? '[role="dialog"][aria-modal="true"]' : '#gallery-main',
        );
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

// D7-SPEC R2.6 Lens "zł a day": the real Lens entries, text read from the rendered Lens.
const LENS_ENTRIES = ['Light/LensEmpty', 'Light/LensFull', 'Light/LensSizes', 'Light/LensUnder'];

for (const theme of THEMES) {
  test(`Lens "zł a day" holds AA ${theme}`, async ({ page }, testInfo) => {
    const rows: TextMeasurement[] = [];
    for (const entry of LENS_ENTRIES) {
      expect(galleryEntryIds).toContain(entry);
      await openGalleryEntry(page, entry, theme);
      const measured = await measureRenderedText(page, '#gallery-main');
      const lens = measured.filter((row) => row.text.includes('a day'));
      expect(lens.length, `${entry} has a "zł a day" text`).toBeGreaterThan(0);
      rows.push(...lens.map((row) => ({ ...row, text: `${entry} / ${row.text}` })));
    }
    await attach(testInfo, rows);

    expect(failing(rows)).toEqual([]);
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
