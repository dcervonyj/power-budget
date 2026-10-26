import React, { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { GalleryApp } from './GalleryApp.js';
import { parseGalleryParams } from './params.js';
import type { GalleryParams } from './params.js';
import type { GalleryEntry } from './registry.js';

export interface GalleryRootProps {
  readonly entries: readonly GalleryEntry[];
}

/** Reads the launch URL (`?entry=&theme=`), then hands over to the gallery. */
export function GalleryRoot({ entries }: GalleryRootProps): React.JSX.Element | null {
  const [params, setParams] = useState<GalleryParams | null>(null);

  useEffect(() => {
    void Linking.getInitialURL().then((url) => {
      setParams(parseGalleryParams(url));
    });
  }, []);

  useEffect(() => {
    if (params !== null && Platform.OS === 'web') {
      document.documentElement.setAttribute('data-theme', params.theme);
    }
  }, [params]);

  if (params === null) {
    return null;
  }

  return <GalleryApp params={params} entries={entries} onNavigate={setParams} />;
}
