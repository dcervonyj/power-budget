import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '../../components/ThemeContext.js';
import { RequireOnboarding } from '../RequireOnboarding.js';
import { onboardingService } from '../../../composition.js';

const isCompleted = vi.spyOn(onboardingService, 'isCompleted');

function renderAt(path: string): void {
  render(
    <IntlProvider locale="en" messages={{}} onError={vi.fn()}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/onboarding" element={<p>onboarding screen</p>} />
            <Route element={<RequireOnboarding />}>
              <Route path="/dashboard" element={<p>dashboard screen</p>} />
              <Route path="/bank-connections" element={<p>bank screen</p>} />
              <Route path="/plans/new" element={<p>plan screen</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </IntlProvider>,
  );
}

describe('RequireOnboarding', () => {
  beforeEach(() => {
    isCompleted.mockReset();
  });

  it('sends a new user to onboarding', async () => {
    isCompleted.mockResolvedValue(false);

    renderAt('/dashboard');

    expect(await screen.findByText('onboarding screen')).toBeVisible();
    expect(screen.queryByText('dashboard screen')).toBeNull();
  });

  it('lets a user who completed onboarding through', async () => {
    isCompleted.mockResolvedValue(true);

    renderAt('/dashboard');

    expect(await screen.findByText('dashboard screen')).toBeVisible();
    expect(screen.queryByText('onboarding screen')).toBeNull();
  });

  it('renders nothing while the profile is being read', () => {
    isCompleted.mockReturnValue(new Promise<boolean>(vi.fn()));

    renderAt('/dashboard');

    expect(screen.queryByText('dashboard screen')).toBeNull();
    expect(screen.queryByText('onboarding screen')).toBeNull();
  });

  it('keeps the gate closed with a retryable error when the profile cannot be read', async () => {
    isCompleted.mockRejectedValueOnce(new Error('offline'));
    isCompleted.mockResolvedValueOnce(true);

    renderAt('/dashboard');

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load your profile');
    expect(screen.queryByText('dashboard screen')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('dashboard screen')).toBeVisible();
  });

  it('keeps a failed read closed when retry fails again', async () => {
    isCompleted.mockRejectedValue(new Error('offline'));

    renderAt('/dashboard');
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByText('dashboard screen')).toBeNull();
  });

  it('lets an unfinished user open the bank connections screen the wizard links to', async () => {
    isCompleted.mockResolvedValue(false);

    renderAt('/bank-connections');

    expect(await screen.findByText('bank screen')).toBeVisible();
  });

  it('lets an unfinished user open the plan screens the wizard links to', async () => {
    isCompleted.mockResolvedValue(false);

    renderAt('/plans/new');

    expect(await screen.findByText('plan screen')).toBeVisible();
  });
});
