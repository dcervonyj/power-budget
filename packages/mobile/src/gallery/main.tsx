import React from 'react';
import { registerRootComponent } from 'expo';
import { GalleryRoot } from './GalleryRoot.js';
import { discoverGalleryModules } from './discoverModules.js';
import { loadSkia } from './loadSkia.js';
import { buildGalleryEntries } from './registry.js';

const entries = buildGalleryEntries(discoverGalleryModules());

function Gallery(): React.JSX.Element | null {
  const [skiaReady, setSkiaReady] = React.useState(false);

  React.useEffect(() => {
    void loadSkia().then(() => {
      setSkiaReady(true);
    });
  }, []);

  return skiaReady ? <GalleryRoot entries={entries} /> : null;
}

/** Entry point of the gallery build (`EXPO_PUBLIC_GALLERY=1`, see `index.ts`). */
export function registerGallery(): void {
  registerRootComponent(Gallery);
}
