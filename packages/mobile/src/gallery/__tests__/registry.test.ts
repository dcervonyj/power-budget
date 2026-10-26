import { describe, expect, it } from 'vitest';
import { galleryEntryId } from '../entryId.js';
import { buildGalleryEntries } from '../registry.js';

const Fixture = (): null => null;

describe('buildGalleryEntries', () => {
  it('builds sorted ids from function exports only', () => {
    const entries = buildGalleryEntries({
      './b/Zed.gallery.tsx': { Two: Fixture, notAFixture: 3 },
      './a/Alpha.gallery.tsx': { One: Fixture },
    });

    expect(entries.map((entry) => entry.id)).toEqual(['Alpha/One', 'Zed/Two']);
  });

  it('rejects duplicate gallery file names', () => {
    expect(() =>
      buildGalleryEntries({
        './a/Same.gallery.tsx': { One: Fixture },
        './b/Same.gallery.tsx': { One: Fixture },
      }),
    ).toThrow('Duplicate gallery entry "Same/One"');
  });

  it('derives the id from the file name', () => {
    expect(galleryEntryId('src/x/Tokens.gallery.tsx', 'Swatches')).toBe('Tokens/Swatches');
  });
});
