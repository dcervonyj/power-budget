import React from 'react';
import { observer } from 'mobx-react-lite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { UserProfileDto } from '@power-budget/shared-app/contract';
import { ThemeProvider } from '../../components/ThemeContext.js';
import { LocaleContext } from '../../../AppProviders.js';
import { RequireOnboarding } from '../RequireOnboarding.js';
import { onboardingProgress, onboardingService, settingsStore } from '../../../composition.js';

const setLocale = vi.fn();
const readProfile = vi.spyOn(onboardingService, 'readProfile');

function profile(overrides: Partial<UserProfileDto>): UserProfileDto {
  return {
    id: 'user-1',
    email: 'ana@example.com',
    displayName: 'Ana',
    locale: 'en',
    localePreference: null,
    defaultLocale: 'en',
    baseCurrency: 'PLN',
    timezone: 'UTC',
    interestingCurrencies: [],
    onboardingCompleted: true,
    householdId: 'hh-1',
    ...overrides,
  };
}

const Dashboard = observer(function Dashboard(): React.JSX.Element {
  return <p>dashboard tracks {settingsStore.interestingCurrencies.join(',') || 'nothing'}</p>;
});

function renderAt(path: string): void {
  render(
    <IntlProvider locale="en" messages={{}} onError={vi.fn()}>
      <ThemeProvider>
        <LocaleContext.Provider value={{ locale: 'en', setLocale }}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/onboarding" element={<p>onboarding screen</p>} />
              <Route element={<RequireOnboarding />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/bank-connections" element={<p>bank screen</p>} />
                <Route path="/plans/new" element={<p>plan screen</p>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </LocaleContext.Provider>
      </ThemeProvider>
    </IntlProvider>,
  );
}

describe('RequireOnboarding', () => {
  beforeEach(() => {
    readProfile.mockReset();
    setLocale.mockReset();
    onboardingProgress.clear();
    settingsStore.resetSession();
  });

  it('sends a new user to onboarding', async () => {
    readProfile.mockResolvedValue(profile({ onboardingCompleted: false }));

    renderAt('/dashboard');

    expect(await screen.findByText('onboarding screen')).toBeVisible();
    expect(screen.queryByText(/dashboard tracks/)).toBeNull();
  });

  it('lets a user who completed onboarding through', async () => {
    readProfile.mockResolvedValue(profile({ onboardingCompleted: true }));

    renderAt('/dashboard');

    expect(await screen.findByText(/dashboard tracks/)).toBeVisible();
    expect(screen.queryByText('onboarding screen')).toBeNull();
  });

  it('has the tracked currencies of the profile in place when the app first renders', async () => {
    readProfile.mockResolvedValue(profile({ interestingCurrencies: ['USD', 'GBP'] }));

    renderAt('/dashboard');

    expect(await screen.findByText('dashboard tracks USD,GBP')).toBeVisible();
  });

  it('applies the language saved on the profile, also on a browser that never saw this user', async () => {
    readProfile.mockResolvedValue(profile({ locale: 'pl', localePreference: 'pl' }));

    renderAt('/dashboard');

    await screen.findByText(/dashboard tracks/);
    expect(setLocale).toHaveBeenCalledWith('pl');
  });

  it('leaves the language alone when the profile has no saved preference', async () => {
    readProfile.mockResolvedValue(profile({ locale: 'en', localePreference: null }));

    renderAt('/dashboard');

    await screen.findByText(/dashboard tracks/);
    expect(setLocale).not.toHaveBeenCalled();
  });

  it('renders nothing while the profile is being read', () => {
    readProfile.mockReturnValue(new Promise<UserProfileDto>(vi.fn()));

    renderAt('/dashboard');

    expect(screen.queryByText(/dashboard tracks/)).toBeNull();
    expect(screen.queryByText('onboarding screen')).toBeNull();
  });

  it('keeps the gate closed with a retryable error when the profile cannot be read', async () => {
    readProfile.mockRejectedValueOnce(new Error('offline'));
    readProfile.mockResolvedValueOnce(profile({}));

    renderAt('/dashboard');

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load your profile');
    expect(screen.queryByText(/dashboard tracks/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText(/dashboard tracks/)).toBeVisible();
  });

  it('keeps a failed read closed when retry fails again', async () => {
    readProfile.mockRejectedValue(new Error('offline'));

    renderAt('/dashboard');
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByText(/dashboard tracks/)).toBeNull();
  });

  it('sends an unfinished user who opens the bank URL directly to onboarding', async () => {
    readProfile.mockResolvedValue(profile({ onboardingCompleted: false }));

    renderAt('/bank-connections');

    expect(await screen.findByText('onboarding screen')).toBeVisible();
    expect(screen.queryByText('bank screen')).toBeNull();
  });

  it('sends an unfinished user who opens a plan URL directly to onboarding', async () => {
    readProfile.mockResolvedValue(profile({ onboardingCompleted: false }));

    renderAt('/plans/new');

    expect(await screen.findByText('onboarding screen')).toBeVisible();
    expect(screen.queryByText('plan screen')).toBeNull();
  });

  it('opens the bank screen for an unfinished user who followed the wizard link', async () => {
    readProfile.mockResolvedValue(profile({ onboardingCompleted: false }));
    onboardingProgress.resume();
    onboardingProgress.leaveForLink();

    renderAt('/bank-connections');

    expect(await screen.findByText('bank screen')).toBeVisible();
  });

  it('opens the plan screen for an unfinished user who followed the wizard link', async () => {
    readProfile.mockResolvedValue(profile({ onboardingCompleted: false }));
    onboardingProgress.resume();
    onboardingProgress.leaveForLink();

    renderAt('/plans/new');

    expect(await screen.findByText('plan screen')).toBeVisible();
  });

  it('still sends that user to onboarding from any other screen', async () => {
    readProfile.mockResolvedValue(profile({ onboardingCompleted: false }));
    onboardingProgress.resume();
    onboardingProgress.leaveForLink();

    renderAt('/dashboard');

    expect(await screen.findByText('onboarding screen')).toBeVisible();
  });
});
