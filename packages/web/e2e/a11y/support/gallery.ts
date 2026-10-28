import type { Page } from '@playwright/test';
import { discoverGalleryEntryIds } from '../../visual/discoverEntries.js';

export const THEMES = ['dark', 'light'] as const;
export type Theme = (typeof THEMES)[number];

export const galleryEntryIds = discoverGalleryEntryIds();

export async function openGalleryEntry(page: Page, entry: string, theme: Theme): Promise<void> {
  await page.goto(`/gallery.html?${new URLSearchParams({ entry, theme }).toString()}`);
  await page.locator('#gallery-main').waitFor();
  await page.evaluate(() => document.fonts.ready);
}
