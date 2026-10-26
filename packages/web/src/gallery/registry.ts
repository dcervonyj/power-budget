import type { ComponentType } from 'react';
import { galleryEntryId } from './entryId.js';

export interface GalleryEntry {
  readonly id: string;
  readonly Component: ComponentType;
}

export type GalleryModules = Record<string, Record<string, unknown>>;

// Every `*.gallery.tsx` under src is a gallery file; its named exports are the fixtures.
const discoveredModules = import.meta.glob<Record<string, unknown>>('../**/*.gallery.tsx', {
  eager: true,
});

export function buildGalleryEntries(modules: GalleryModules): GalleryEntry[] {
  const entries = new Map<string, GalleryEntry>();
  for (const [filePath, exports] of Object.entries(modules)) {
    for (const [exportName, value] of Object.entries(exports)) {
      if (isFixture(value)) {
        addEntry(entries, { id: galleryEntryId(filePath, exportName), Component: value });
      }
    }
  }

  return [...entries.values()].sort(compareById);
}

export const galleryEntries: readonly GalleryEntry[] = buildGalleryEntries(discoveredModules);

function isFixture(value: unknown): value is ComponentType {
  return typeof value === 'function';
}

function addEntry(entries: Map<string, GalleryEntry>, entry: GalleryEntry): void {
  if (entries.has(entry.id)) {
    throw new Error(`Duplicate gallery entry "${entry.id}": gallery file names must be unique`);
  }
  entries.set(entry.id, entry);
}

function compareById(a: GalleryEntry, b: GalleryEntry): number {
  return a.id.localeCompare(b.id);
}
