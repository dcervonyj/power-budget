import { expect, test } from '@playwright/test';
import { runAxe } from '../support/axe.js';
import { galleryEntryIds, openGalleryEntry, THEMES } from '../support/gallery.js';

// DSN-050: axe on every web gallery entry in both themes. Serious and critical issues fail the
// run; moderate and minor ones are counted in the attached summary (see docs/design/d7-a11y.md).
for (const entry of galleryEntryIds) {
  for (const theme of THEMES) {
    test(`axe ${entry} ${theme}`, async ({ page }, testInfo) => {
      await openGalleryEntry(page, entry, theme);

      const { blocking } = await runAxe(page, testInfo);

      expect(blocking).toEqual([]);
    });
  }
}
