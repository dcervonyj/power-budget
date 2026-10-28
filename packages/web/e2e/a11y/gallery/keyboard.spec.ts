import { expect, test, type Page } from '@playwright/test';
import { galleryEntryIds, openGalleryEntry, THEMES } from '../support/gallery.js';
import { walkTabOrder } from '../support/keyboard.js';

// DSN-050: keyboard-only pass on the gallery. Tab reaches every control in DOM order, each stop
// shows a focus indicator, and an open dialog keeps Tab and Shift+Tab inside it.
for (const entry of galleryEntryIds) {
  for (const theme of THEMES) {
    test(`tab order and focus ring ${entry} ${theme}`, async ({ page }) => {
      await openGalleryEntry(page, entry, theme);
      // With a dialog open the background is out of reach: the walk covers the dialog only.
      const root = (await page.locator('[role="dialog"]').count()) > 0 ? '[role="dialog"]' : 'body';

      const report = await walkTabOrder(page, root);

      expect(report.positiveTabindex).toEqual([]);
      expect(report.unreached).toEqual([]);
      expect(report.outOfOrder).toEqual([]);
      expect(report.stops.filter((stop) => !stop.visibleFocus).map((stop) => stop.label)).toEqual(
        [],
      );
    });
  }
}

test('the skip link is the first stop and shows itself on focus', async ({ page }) => {
  await openGalleryEntry(page, 'Shell/Overview', 'dark');
  await page.keyboard.press('Tab');

  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport({ ratio: 1 });
});

for (const entry of dialogEntries()) {
  test(`dialog ${entry} traps Tab and Shift+Tab`, async ({ page }) => {
    await openGalleryEntry(page, entry, 'dark');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect.poll(() => insideDialog(page)).toBe(true);

    for (const key of ['Tab', 'Shift+Tab']) {
      for (let press = 0; press < 12; press += 1) {
        await page.keyboard.press(key);
        expect(await insideDialog(page)).toBe(true);
      }
    }
  });
}

/** Entries that open a `role="dialog"`: modals, drawers, sheets, the account menu. */
function dialogEntries(): string[] {
  return galleryEntryIds.filter((entry) =>
    /^(Overlays\/(Modals|Drawers|Sheets)|Shell\/AccountMenuOpen|PlanScreens\/ClonePlanDialog|TransactionDialogs\/)/.test(
      entry,
    ),
  );
}

async function insideDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');

    return dialog !== null && dialog.contains(document.activeElement);
  });
}
