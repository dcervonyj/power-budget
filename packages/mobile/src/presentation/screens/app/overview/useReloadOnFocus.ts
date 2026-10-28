import { useEffect, useRef } from 'react';

/** The part of a navigation object this hook needs (tab or stack). */
export interface FocusEvents {
  addListener(event: 'focus', listener: () => void): () => void;
}

/**
 * Calls `reload` each time the screen comes back into focus; the first focus is the mount, which
 * already loads, so it is skipped.
 */
export function useReloadOnFocus(navigation: FocusEvents, reload: () => void): void {
  const focusedOnce = useRef(false);

  useEffect(() => {
    function onFocus(): void {
      if (focusedOnce.current) {
        reload();
      }
      focusedOnce.current = true;
    }

    return navigation.addListener('focus', onFocus);
  }, [navigation, reload]);
}
