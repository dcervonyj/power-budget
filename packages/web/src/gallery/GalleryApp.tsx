import React from 'react';
import { IntlProvider } from 'react-intl';
import { galleryEntryHref, type GalleryParams, type GalleryTheme } from './params.js';
import type { GalleryEntry } from './registry.js';

const THEMES: readonly GalleryTheme[] = ['dark', 'light'];

const PAGE_STYLE: React.CSSProperties = {
  minHeight: '100vh',
  boxSizing: 'border-box',
  padding: 'var(--pb-glass-space-3xl)',
  background: 'var(--pb-glass-base)',
  color: 'var(--pb-glass-fg)',
  fontFamily: "'Geist Variable', system-ui, sans-serif",
};

export interface GalleryAppProps {
  readonly params: GalleryParams;
  readonly entries: readonly GalleryEntry[];
}

export function GalleryApp({ params, entries }: GalleryAppProps): React.JSX.Element {
  const selected = entries.find((entry) => entry.id === params.entry);

  return (
    <IntlProvider locale="en" defaultLocale="en" onError={ignoreMissingTranslation}>
      <main id="gallery-main" style={PAGE_STYLE}>
        {selected ? <selected.Component /> : <GalleryIndex entries={entries} />}
      </main>
    </IntlProvider>
  );
}

function GalleryIndex({ entries }: { entries: readonly GalleryEntry[] }): React.JSX.Element {
  return (
    <>
      <h1>Gallery</h1>
      <ul data-testid="gallery-index">
        {entries.map((entry) => (
          <li key={entry.id}>
            {entry.id}
            {THEMES.map((theme) => (
              <React.Fragment key={theme}>
                {' '}
                <a
                  href={galleryEntryHref(entry.id, theme)}
                  style={{ color: 'var(--pb-glass-accent)' }}
                >
                  {theme}
                </a>
              </React.Fragment>
            ))}
          </li>
        ))}
      </ul>
    </>
  );
}

function ignoreMissingTranslation(): void {
  // Gallery fixtures render with default messages only.
}
