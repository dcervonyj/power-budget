import { useEffect, useRef } from 'react';

/**
 * Calls `tick` every `intervalMs` while the tab is visible. A hidden tab stops the timer; when the
 * tab is shown again `tick` runs at once and the timer restarts. Unmounting stops everything.
 */
export function useVisiblePolling(tick: () => void, intervalMs: number): void {
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  useEffect(() => {
    let timer: number | null = null;

    function run(): void {
      tickRef.current();
    }
    function start(): void {
      if (timer === null) {
        timer = window.setInterval(run, intervalMs);
      }
    }
    function stop(): void {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    }
    function onVisibilityChange(): void {
      if (document.visibilityState === 'visible') {
        stop();
        run();
        start();
      } else {
        stop();
      }
    }

    if (document.visibilityState === 'visible') {
      start();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stop();
    };
  }, [intervalMs]);
}
