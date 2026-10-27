import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/renderWithProviders.js';
import { THEME_STORAGE_KEY } from '../../../theme/themePreference.js';
import { stubLocalStorage } from '../../../theme/__tests__/matchMediaStub.js';
import { SettingsScreen } from '../../app/SettingsScreen.js';
import { SettingsAppearanceTab } from '../SettingsAppearanceTab.js';

vi.mock('../../../../AppProviders.js', () => ({
  signOut: { execute: vi.fn() },
  apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
  tokenStore: { getAccessToken: vi.fn(() => null) },
  LocaleContext: React.createContext({ locale: 'en', setLocale: vi.fn() }),
}));
vi.mock('../../../../application/settings/SettingsStore.js', () => ({
  settingsStore: { loadProfile: vi.fn() },
}));

describe('SettingsScreen appearance', () => {
  beforeEach(() => {
    stubLocalStorage();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists the tabs, Appearance included, with the current one marked', () => {
    renderWithProviders(<SettingsScreen />, {
      url: '/settings/appearance',
      path: '/settings/*',
    });

    const nav = screen.getByRole('navigation', { name: 'Settings sections' });

    expect(nav.textContent).toBe('ProfileAppearanceLanguageCurrencyData & Privacy');
    expect(screen.getByRole('link', { name: 'Appearance' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('changes data-theme when Day is chosen and keeps the choice after a reload', () => {
    renderWithProviders(<SettingsAppearanceTab />);

    fireEvent.click(screen.getByRole('radio', { name: 'Day' }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(screen.getByRole('radio', { name: 'Day' })).toHaveAttribute('aria-checked', 'true');

    cleanup();
    document.documentElement.removeAttribute('data-theme');
    renderWithProviders(<SettingsAppearanceTab />);

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(screen.getByRole('radio', { name: 'Day' })).toHaveAttribute('aria-checked', 'true');
  });

  it('switches to Night and back to System', () => {
    renderWithProviders(<SettingsAppearanceTab />);

    fireEvent.click(screen.getByRole('radio', { name: 'Night' }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    fireEvent.click(screen.getByRole('radio', { name: 'System' }));

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });
});
