import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import { darkTheme } from '@power-budget/design-tokens';
import { ThemeProvider } from '../../../components/ThemeContext.js';
import { PlansListScreen } from '../PlansListScreen.js';
import { plansApi, settingsStore } from '../../../../composition.js';
import { spyOnApiClient } from '../../../../test/apiClientSpies.js';

spyOnApiClient();
const list = vi.spyOn(plansApi, 'list');
const loadProfile = vi.spyOn(settingsStore, 'loadProfile');

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>
    <IntlProvider locale="en" messages={{}}>
      <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>
    </IntlProvider>
  </MemoryRouter>
);

describe('PlansListScreen profile failure', () => {
  beforeEach(() => {
    list.mockReset().mockResolvedValue([]);
    loadProfile.mockReset().mockResolvedValue(undefined);
    settingsStore.profileLoaded = true;
    settingsStore.profileLoadFailed = true;
  });

  it('keeps creation disabled and offers a retry while the profile failed', async () => {
    render(<PlansListScreen />, { wrapper });

    await screen.findByText('Failed to load your profile');
    const create = screen.getByRole('button', { name: 'Create new plan' });
    fireEvent.click(create);

    expect(create.hasAttribute('disabled')).toBe(true);
    expect(screen.queryByText('Create plan')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(loadProfile).toHaveBeenCalled());
  });

  it('opens the dialog once the profile loaded', async () => {
    settingsStore.profileLoadFailed = false;
    render(<PlansListScreen />, { wrapper });

    fireEvent.click(await screen.findByRole('button', { name: 'Create new plan' }));

    await screen.findByText('Create plan');
  });
});
