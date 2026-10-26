import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC_DIR = join(__dirname, '../../src');
const SUFFIX = '.gallery.tsx';
const NAMED_EXPORT = /^export (?:const|function) ([A-Za-z_]\w*)/gm;

/** Entry ids of every `src/**\/*.gallery.tsx` (same rule as `src/gallery/registry.ts`), sorted. */
export function discoverGalleryEntryIds(): string[] {
  return galleryFiles(SRC_DIR).flatMap(entryIdsOfFile).sort();
}

function galleryFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return galleryFiles(path);
    }

    return name.endsWith(SUFFIX) ? [path] : [];
  });
}

function entryIdsOfFile(path: string): string[] {
  const fileName = path.slice(path.lastIndexOf('/') + 1, -SUFFIX.length);
  const source = readFileSync(path, 'utf8');

  return [...source.matchAll(NAMED_EXPORT)].map((match) => `${fileName}/${match[1] ?? ''}`);
}
