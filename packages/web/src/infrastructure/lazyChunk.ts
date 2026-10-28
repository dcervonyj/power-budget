import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { StaleChunkRecovery } from './reloadOnStaleChunk.js';

export const staleChunkRecovery = new StaleChunkRecovery({
  addEventListener: (type, listener) => window.addEventListener(type, listener),
  location: window.location,
  sessionStorage: () => window.sessionStorage,
});

/** React.lazy that reports every successful chunk import as proof that chunks load again. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same bound as React.lazy
export function lazyChunk<T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() => load().then(markLoaded));
}

function markLoaded<M>(module: M): M {
  staleChunkRecovery.chunkLoaded();

  return module;
}
