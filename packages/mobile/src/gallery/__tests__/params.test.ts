import { describe, expect, it } from 'vitest';
import { galleryEntryHref, parseGalleryParams } from '../params.js';

describe('parseGalleryParams', () => {
  it('defaults to the dark theme and no entry', () => {
    expect(parseGalleryParams(null)).toEqual({ theme: 'dark', entry: null });
    expect(parseGalleryParams('http://localhost:4175/')).toEqual({ theme: 'dark', entry: null });
  });

  it('reads the entry and theme from the query and ignores the hash', () => {
    expect(
      parseGalleryParams('http://localhost:4175/?entry=Tokens%2FSwatches&theme=light#top'),
    ).toEqual({ theme: 'light', entry: 'Tokens/Swatches' });
  });

  it('round-trips with galleryEntryHref', () => {
    expect(parseGalleryParams(galleryEntryHref('Tokens/TypeScale', 'light'))).toEqual({
      theme: 'light',
      entry: 'Tokens/TypeScale',
    });
  });
});
