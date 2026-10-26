import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SHELL_REFRESH_INTERVAL_MS,
  useShellRefresh,
  type RefreshableShell,
} from '../useShellRefresh.js';

function fakeShell(): RefreshableShell & {
  load: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
} {
  return { load: vi.fn(async () => undefined), refresh: vi.fn(async () => undefined) };
}

describe('useShellRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads once, then refreshes on a page change', () => {
    const shell = fakeShell();
    const { rerender } = renderHook(({ path }) => useShellRefresh(shell, path), {
      initialProps: { path: '/dashboard' },
    });

    expect(shell.load).toHaveBeenCalledTimes(1);
    expect(shell.refresh).not.toHaveBeenCalled();

    rerender({ path: '/transactions' });

    expect(shell.load).toHaveBeenCalledTimes(1);
    expect(shell.refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes on an interval and when the window gets focus, so in-place sorting shows', () => {
    const shell = fakeShell();
    renderHook(() => useShellRefresh(shell, '/transactions'));

    act(() => {
      vi.advanceTimersByTime(SHELL_REFRESH_INTERVAL_MS);
    });
    expect(shell.refresh).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(shell.refresh).toHaveBeenCalledTimes(2);
  });

  it('stops refreshing after unmount', () => {
    const shell = fakeShell();
    const { unmount } = renderHook(() => useShellRefresh(shell, '/dashboard'));
    unmount();

    act(() => {
      vi.advanceTimersByTime(SHELL_REFRESH_INTERVAL_MS * 2);
      window.dispatchEvent(new Event('focus'));
    });

    expect(shell.refresh).not.toHaveBeenCalled();
  });
});
