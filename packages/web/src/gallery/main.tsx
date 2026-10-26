import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/geist';
// The package exports map only exposes JS, so the generated CSS is imported by path (built by turbo).
import '../../../design-tokens/dist/tokens.css';
import '../../../design-tokens/dist/glass.css';
import { GalleryApp } from './GalleryApp.js';
import { parseGalleryParams } from './params.js';
import { galleryEntries } from './registry.js';

const params = parseGalleryParams(window.location.search);
document.documentElement.setAttribute('data-theme', params.theme);
document.documentElement.style.colorScheme = params.theme;
document.body.style.margin = '0';
document.body.style.background = 'var(--pb-glass-base)';

const container = document.getElementById('gallery-root');
if (container === null) {
  throw new Error('gallery.html has no #gallery-root');
}
ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <GalleryApp params={params} entries={galleryEntries} />
  </React.StrictMode>,
);
