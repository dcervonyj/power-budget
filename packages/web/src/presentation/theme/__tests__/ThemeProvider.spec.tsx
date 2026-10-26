import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from '../ThemeProvider.js';
import { useReducedMotion } from '../useReducedMotion.js';
import { DARK_SCHEME_QUERY, REDUCED_MOTION_QUERY } from '../themePreference.js';
import { stubLocalStorage, stubMatchMedia, type MediaStub } from './matchMediaStub.js';

function Probe(): React.JSX.Element {
  const { preference, resolved, setPreference } = useTheme();

  return (
    <div>
      <p data-testid="state">{`${preference}/${resolved}`}</p>
      <button onClick={() => setPreference('light')}>light</button>
      <button onClick={() => setPreference('dark')}>dark</button>
      <button onClick={() => setPreference('system')}>system</button>
    </div>
  );
}

function renderProbe(): void {
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

function state(): string | null {
  return screen.getByTestId('state').textContent;
}

describe('ThemeProvider', () => {
  let media: MediaStub;

  beforeEach(() => {
    media = stubMatchMedia({ [DARK_SCHEME_QUERY]: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
  });

  it('defaults to following the system theme', () => {
    stubLocalStorage();
    renderProbe();

    expect(state()).toBe('system/dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('restores a stored preference', () => {
    stubLocalStorage({ pb_theme: 'light' });
    renderProbe();

    expect(state()).toBe('light/light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('ignores an invalid stored value', () => {
    stubLocalStorage({ pb_theme: 'neon' });
    renderProbe();

    expect(state()).toBe('system/dark');
  });

  it('persists the preference when toggled', () => {
    const store = stubLocalStorage();
    renderProbe();

    fireEvent.click(screen.getByText('light'));

    expect(state()).toBe('light/light');
    expect(store.get('pb_theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    fireEvent.click(screen.getByText('dark'));

    expect(state()).toBe('dark/dark');
    expect(store.get('pb_theme')).toBe('dark');
  });

  it('follows OS changes while the preference is system', () => {
    stubLocalStorage();
    renderProbe();

    act(() => media.setMatches(DARK_SCHEME_QUERY, false));

    expect(state()).toBe('system/light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('ignores OS changes once a theme is chosen', () => {
    stubLocalStorage({ pb_theme: 'dark' });
    renderProbe();

    act(() => media.setMatches(DARK_SCHEME_QUERY, false));

    expect(state()).toBe('dark/dark');
  });

  it('throws when useTheme is used without a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Probe />)).toThrow('useTheme must be used within a ThemeProvider');
  });
});

describe('useReducedMotion', () => {
  function MotionProbe(): React.JSX.Element {
    return <p data-testid="motion">{String(useReducedMotion())}</p>;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reflects the media query and updates when it changes', () => {
    const media = stubMatchMedia({ [REDUCED_MOTION_QUERY]: false });
    render(<MotionProbe />);

    expect(screen.getByTestId('motion').textContent).toBe('false');

    act(() => media.setMatches(REDUCED_MOTION_QUERY, true));

    expect(screen.getByTestId('motion').textContent).toBe('true');
  });

  it('is on by default in the test setup', () => {
    render(<MotionProbe />);

    expect(screen.getByTestId('motion').textContent).toBe('true');
  });
});

describe('theme-boot.js', () => {
  const script = readFileSync(resolve(process.cwd(), 'public/theme-boot.js'), 'utf8');

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
  });

  function runBoot(stored: Record<string, string>, systemDark: boolean): void {
    stubLocalStorage(stored);
    stubMatchMedia({ [DARK_SCHEME_QUERY]: systemDark });
    new Function(script)();
  }

  it('sets light before React mounts when light is stored', () => {
    runBoot({ pb_theme: 'light' }, true);

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('follows the system when nothing is stored', () => {
    runBoot({}, false);

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('uses a stored dark over a light system', () => {
    runBoot({ pb_theme: 'dark' }, false);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
