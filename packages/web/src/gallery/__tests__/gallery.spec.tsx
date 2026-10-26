import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { galleryEntryId } from '../entryId.js';
import { GalleryApp } from '../GalleryApp.js';
import { galleryEntryHref, parseGalleryParams } from '../params.js';
import { buildGalleryEntries, galleryEntries } from '../registry.js';

function Fixture(): React.JSX.Element {
  return <p>fixture body</p>;
}

describe('galleryEntryId', () => {
  it('combines the gallery file base name and the export name', () => {
    expect(galleryEntryId('/a/b/Tokens.gallery.tsx', 'Swatches')).toBe('Tokens/Swatches');
    expect(galleryEntryId('Plain.gallery.tsx', 'X')).toBe('Plain/X');
  });
});

describe('parseGalleryParams', () => {
  it('defaults to the dark theme without an entry', () => {
    expect(parseGalleryParams('')).toEqual({ theme: 'dark', entry: null });
  });

  it('reads theme and entry', () => {
    expect(parseGalleryParams('?theme=light&entry=Tokens%2FSwatches')).toEqual({
      theme: 'light',
      entry: 'Tokens/Swatches',
    });
  });

  it('falls back to dark for unknown themes', () => {
    expect(parseGalleryParams('?theme=sepia').theme).toBe('dark');
  });

  it('builds entry links', () => {
    expect(galleryEntryHref('Tokens/Swatches', 'light')).toBe(
      '?entry=Tokens%2FSwatches&theme=light',
    );
  });
});

describe('buildGalleryEntries', () => {
  it('turns function exports into sorted entries and ignores other exports', () => {
    const entries = buildGalleryEntries({
      '/src/B.gallery.tsx': { Two: Fixture, notAFixture: 3 },
      '/src/A.gallery.tsx': { One: Fixture },
    });

    expect(entries.map((entry) => entry.id)).toEqual(['A/One', 'B/Two']);
  });

  it('rejects duplicate ids', () => {
    expect(() =>
      buildGalleryEntries({
        '/src/x/A.gallery.tsx': { One: Fixture },
        '/src/y/A.gallery.tsx': { One: Fixture },
      }),
    ).toThrow('Duplicate gallery entry "A/One"');
  });

  it('discovers the sample entries from src', () => {
    expect(galleryEntries.map((entry) => entry.id)).toEqual([
      'Tokens/Swatches',
      'Tokens/TypeScale',
    ]);
  });
});

describe('GalleryApp', () => {
  it('renders the selected entry', () => {
    render(
      <GalleryApp
        params={{ theme: 'dark', entry: 'A/One' }}
        entries={buildGalleryEntries({ '/src/A.gallery.tsx': { One: Fixture } })}
      />,
    );

    expect(screen.getByText('fixture body')).toBeInTheDocument();
  });

  it('lists entries when none is selected', () => {
    render(<GalleryApp params={{ theme: 'dark', entry: null }} entries={galleryEntries} />);

    expect(screen.getByTestId('gallery-index').querySelectorAll('li')).toHaveLength(2);
  });
});
