import { useEffect } from 'react';

export interface FocusEvents {
  addListener(type: 'focus', listener: () => void): () => void;
}

/** Calls `reload` each time the screen gets focus, e.g. when the user comes back from a detail. */
export function useReloadOnFocus(navigation: FocusEvents, reload: () => void): void {
  useEffect(() => navigation.addListener('focus', reload), [navigation, reload]);
}
