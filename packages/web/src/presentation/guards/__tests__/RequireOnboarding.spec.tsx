import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireOnboarding } from '../RequireOnboarding.js';
import { onboardingService } from '../../../composition.js';

const isCompleted = vi.spyOn(onboardingService, 'isCompleted');

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/onboarding" element={<p>onboarding screen</p>} />
        <Route element={<RequireOnboarding />}>
          <Route path="/dashboard" element={<p>dashboard screen</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
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

  it('does not lock the user out when the profile cannot be read', async () => {
    isCompleted.mockRejectedValue(new Error('offline'));

    renderAt('/dashboard');

    expect(await screen.findByText('dashboard screen')).toBeVisible();
  });
});
