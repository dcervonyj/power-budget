import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { GALLERY_FILE_SUFFIX, galleryEntryId } from '../../src/gallery/entryId.js';

const SRC_DIR = join(import.meta.dirname, '../../src');
const NAMED_EXPORT = /^export (?:const|function) ([A-Za-z_]\w*)/gm;

/** Entry ids of every `src/**\/*.gallery.tsx` (same rule as the app registry), sorted. */
export function discoverGalleryEntryIds(): string[] {
  const ids = galleryFiles(SRC_DIR).flatMap(entryIdsOfFile);

  return ids.sort();
}

function galleryFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return galleryFiles(path);
    }

    return name.endsWith(GALLERY_FILE_SUFFIX) ? [path] : [];
  });
}

function entryIdsOfFile(path: string): string[] {
  const source = readFileSync(path, 'utf8');

  return [...source.matchAll(NAMED_EXPORT)].map((match) => galleryEntryId(path, match[1] ?? ''));
}
