import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/renderWithProviders.js';
import { bankConnectionStore } from '../../../../composition.js';
import { goToConsent } from '../../../../application/bank/consentRedirect.js';
import { AddBankConnectionScreen } from '../AddBankConnectionScreen.js';
import { spyOnApiClient } from '../../../../test/apiClientSpies.js';

spyOnApiClient();

vi.mock('../../../../application/bank/consentRedirect.js', () => ({
  consentRedirectUri: () => 'https://app.test/bank/consent/callback',
  goToConsent: vi.fn(),
}));

const connect = vi.spyOn(bankConnectionStore, 'connect');

function walkToConnect(): void {
  fireEvent.click(screen.getByRole('button', { name: /GoCardless/ }));
  fireEvent.click(screen.getByRole('button', { name: 'mBank' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
}

describe('AddBankConnectionScreen', () => {
  beforeEach(() => {
    connect.mockReset();
    vi.mocked(goToConsent).mockReset();
  });

  it('walks provider, bank and scope, then redirects to the consent page of the bank', async () => {
    connect.mockResolvedValueOnce('https://bank.example/consent');
    renderWithProviders(<AddBankConnectionScreen />);

    expect(screen.getByRole('heading', { name: 'Choose your provider' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /GoCardless/ }));
    expect(screen.getByRole('heading', { name: 'Pick your bank' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'mBank' }));
    expect(screen.getByRole('heading', { name: 'What we will read' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to your bank' }));

    await waitFor(() => {
      expect(goToConsent).toHaveBeenCalledWith('https://bank.example/consent');
    });
    expect(connect).toHaveBeenCalledWith(
      'gocardless',
      'MBANK_BREXPLPW',
      'https://app.test/bank/consent/callback',
    );
  });

  it('filters the banks by the search text and says when none match', () => {
    renderWithProviders(<AddBankConnectionScreen />);
    fireEvent.click(screen.getByRole('button', { name: /GoCardless/ }));

    fireEvent.change(screen.getByLabelText('Search banks'), { target: { value: 'ing' } });
    expect(screen.getByRole('button', { name: 'ING Bank' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'mBank' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search banks'), { target: { value: 'zzz' } });
    expect(screen.getByText('No banks found. Try a different search.')).toBeInTheDocument();
  });

  it('stays on the connect step and shows the error when the connection fails', async () => {
    connect.mockResolvedValueOnce(null);
    renderWithProviders(<AddBankConnectionScreen />);
    walkToConnect();

    fireEvent.click(screen.getByRole('button', { name: 'Continue to your bank' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to connect');
    expect(goToConsent).not.toHaveBeenCalled();
  });

  it('goes back one step at a time', () => {
    renderWithProviders(<AddBankConnectionScreen />);
    walkToConnect();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'What we will read' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Pick your bank' })).toBeInTheDocument();
  });
});
