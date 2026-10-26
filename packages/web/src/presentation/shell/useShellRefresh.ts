import { useEffect, useRef } from 'react';

/** How often the to-sort count and the sync chip are re-read while the tab is visible. */
export const SHELL_REFRESH_INTERVAL_MS = 30_000;

export interface RefreshableShell {
  load(): Promise<void>;
  refresh(): Promise<void>;
}

/**
 * Keeps the shell data current: everything on mount, then the to-sort count and the sync chip on
 * every page change (not on query changes: typing in a search box must not hit the API), when the
 * window gets focus back and every 30 s while the page is visible, so sorting rows in place also
 * updates the badge.
 */
export function useShellRefresh(shell: RefreshableShell, pathname: string): void {
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) {
      void shell.refresh();

      return;
    }
    loadedRef.current = true;
    void shell.load();
  }, [shell, pathname]);

  useEffect(() => {
    function refreshIfVisible(): void {
      if (document.visibilityState === 'visible') {
        void shell.refresh();
      }
    }
    const timer = window.setInterval(refreshIfVisible, SHELL_REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refreshIfVisible);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshIfVisible);
    };
  }, [shell]);
}
