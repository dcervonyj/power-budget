import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVisiblePolling } from './useVisiblePolling.js';

const INTERVAL = 30_000;

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

describe('useVisiblePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
    setVisibility('visible');
  });

  it('ticks every interval while the tab is visible, not at mount', () => {
    const tick = vi.fn();
    renderHook(() => {
      useVisiblePolling(tick, INTERVAL);
    });
    expect(tick).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(INTERVAL * 2);
    });

    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('stops ticking while the tab is hidden', () => {
    const tick = vi.fn();
    renderHook(() => {
      useVisiblePolling(tick, INTERVAL);
    });

    setVisibility('hidden');
    act(() => {
      vi.advanceTimersByTime(INTERVAL * 5);
    });

    expect(tick).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('refreshes at once when the tab is shown again, then keeps the interval', () => {
    const tick = vi.fn();
    renderHook(() => {
      useVisiblePolling(tick, INTERVAL);
    });
    setVisibility('hidden');
    act(() => {
      vi.advanceTimersByTime(INTERVAL * 3);
    });

    setVisibility('visible');
    expect(tick).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(INTERVAL);
    });

    expect(tick).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('does not stack timers when the tab toggles quickly', () => {
    const tick = vi.fn();
    renderHook(() => {
      useVisiblePolling(tick, INTERVAL);
    });

    setVisibility('hidden');
    setVisibility('visible');
    setVisibility('hidden');
    setVisibility('visible');

    expect(vi.getTimerCount()).toBe(1);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('starts no timer when mounted in a hidden tab, and starts on show', () => {
    setVisibility('hidden');
    const tick = vi.fn();
    renderHook(() => {
      useVisiblePolling(tick, INTERVAL);
    });
    expect(vi.getTimerCount()).toBe(0);

    setVisibility('visible');

    expect(tick).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(1);
  });

  it('calls the latest tick without restarting the timer', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ tick }) => {
        useVisiblePolling(tick, INTERVAL);
      },
      { initialProps: { tick: first } },
    );
    act(() => {
      vi.advanceTimersByTime(INTERVAL - 1);
    });

    rerender({ tick: second });
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it('leaks no timer or listener after unmount', () => {
    const tick = vi.fn();
    const { unmount } = renderHook(() => {
      useVisiblePolling(tick, INTERVAL);
    });

    unmount();
    expect(vi.getTimerCount()).toBe(0);
    setVisibility('hidden');
    setVisibility('visible');
    act(() => {
      vi.advanceTimersByTime(INTERVAL * 3);
    });

    expect(tick).not.toHaveBeenCalled();
  });
});
