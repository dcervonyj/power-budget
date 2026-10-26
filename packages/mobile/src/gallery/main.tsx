import React from 'react';
import { registerRootComponent } from 'expo';
import { GalleryRoot } from './GalleryRoot.js';
import { discoverGalleryModules } from './discoverModules.js';
import { loadSkia } from './loadSkia.js';
import { buildGalleryEntries } from './registry.js';
import type { GalleryEntry } from './registry.js';

function Gallery(): React.JSX.Element | null {
  const [entries, setEntries] = React.useState<readonly GalleryEntry[] | null>(null);

  React.useEffect(() => {
    // The gallery modules are required only after CanvasKit is loaded: on web the Skia module
    // binds to the CanvasKit global when it is first imported.
    void loadSkia().then(() => {
      setEntries(buildGalleryEntries(discoverGalleryModules()));
    });
  }, []);

  return entries === null ? null : <GalleryRoot entries={entries} />;
}

/** Entry point of the gallery build (`EXPO_PUBLIC_GALLERY=1`, see `index.ts`). */
export function registerGallery(): void {
  registerRootComponent(Gallery);
}
