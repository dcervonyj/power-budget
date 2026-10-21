import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { householdsApi, tokenStore } from '../../../../AppProviders.js';
import { settingsStore } from '../../../../application/settings/SettingsStore.js';
import { AcceptInviteScreen } from '../AcceptInviteScreen.js';
import { renderWithProviders } from '../../../../test/renderWithProviders.js';
import { apiError } from '../../../../test/dashboardFixtures.js';

vi.mock('../../../../AppProviders.js', () => ({
  householdsApi: { acceptInvite: vi.fn() },
  tokenStore: { getRefreshToken: vi.fn(() => 'refresh-1'), setTokens: vi.fn() },
}));
vi.mock('../../../../application/settings/SettingsStore.js', () => ({
  settingsStore: { loadProfile: vi.fn() },
}));

const acceptInvite = vi.mocked(householdsApi.acceptInvite);

function renderAt(url: string): void {
  renderWithProviders(<AcceptInviteScreen />, { url, path: '/invite/accept' });
}

describe('AcceptInviteScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts the token from the link, swaps the access token and opens the household', async () => {
    acceptInvite.mockResolvedValue({ householdId: 'hh-2', accessToken: 'new-access' });
    renderAt('/invite/accept?token=raw-token');

    fireEvent.click(screen.getByRole('button', { name: 'Accept invite' }));

    expect(await screen.findByText('household-route')).toBeInTheDocument();
    expect(acceptInvite).toHaveBeenCalledWith('raw-token');
    expect(tokenStore.setTokens).toHaveBeenCalledWith('new-access', 'refresh-1');
    expect(settingsStore.loadProfile).toHaveBeenCalledTimes(1);
  });

  it('explains an invite sent to another email', async () => {
    acceptInvite.mockRejectedValue(apiError(403, 'email_mismatch'));
    renderAt('/invite/accept?token=raw-token');

    fireEvent.click(screen.getByRole('button', { name: 'Accept invite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This invite was sent to another email address.',
    );
    expect(tokenStore.setTokens).not.toHaveBeenCalled();
  });

  it('cannot accept a link without a token', () => {
    renderAt('/invite/accept');

    expect(screen.getByRole('alert')).toHaveTextContent('This link has no invite in it.');
    expect(screen.getByRole('button', { name: 'Accept invite' })).toBeDisabled();
  });
});
