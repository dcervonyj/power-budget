import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { spyOnApiClient } from '../../../../test/apiClientSpies.js';
import { renderWithProviders } from '../../../../test/renderWithProviders.js';
import { onboardingProgress } from '../../../../composition.js';
import { OnboardingWizard } from '../OnboardingWizard.js';

const mockPatch = spyOnApiClient().patch;

function clickNext(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
}

describe('OnboardingWizard', () => {
  beforeEach(() => {
    localStorage.clear();
    onboardingProgress.clear();
    mockPatch.mockReset();
    mockPatch.mockResolvedValue({ status: 200, data: undefined, headers: {} });
  });

  it('starts on the language step with the step rod at 1 of 5 and Back disabled', () => {
    renderWithProviders(<OnboardingWizard onComplete={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Choose your language' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Step 1 of 5' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked();
  });

  it('resumes the same step and choices when the user comes back from the bank or plan links', () => {
    const first = renderWithProviders(<OnboardingWizard onComplete={vi.fn()} />);
    clickNext();
    first.unmount();

    renderWithProviders(<OnboardingWizard onComplete={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Set your base currency' })).toBeVisible();
  });

  it('walks forward and back through the steps', () => {
    renderWithProviders(<OnboardingWizard onComplete={vi.fn()} />);

    clickNext();
    expect(screen.getByRole('heading', { name: 'Set your base currency' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Step 2 of 5' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Choose your language' })).toBeVisible();
  });

  it('limits the tracked currencies to five and says so', () => {
    renderWithProviders(<OnboardingWizard onComplete={vi.fn()} />);
    clickNext();
    clickNext();

    for (const code of ['EUR', 'GBP', 'PLN', 'UAH', 'CHF']) {
      fireEvent.click(screen.getByRole('button', { name: code }));
    }

    expect(screen.getByRole('status')).toHaveTextContent('Maximum 5 currencies selected.');
    expect(screen.getByRole('button', { name: 'CZK' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'EUR' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers connect and skip on the bank step, with links to the real screens', () => {
    renderWithProviders(<OnboardingWizard onComplete={vi.fn()} />);
    for (let step = 0; step < 3; step += 1) {
      clickNext();
    }

    expect(screen.getByRole('link', { name: 'Connect now' })).toHaveAttribute(
      'href',
      '/bank-connections',
    );
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(screen.getByRole('link', { name: 'Create plan' })).toHaveAttribute('href', '/plans');
  });

  it('marks the wizard as left only when the bank or plan link is followed', () => {
    renderWithProviders(<OnboardingWizard onComplete={vi.fn()} />);
    for (let step = 0; step < 3; step += 1) {
      clickNext();
    }
    expect(onboardingProgress.isLeftForLink).toBe(false);

    fireEvent.click(screen.getByRole('link', { name: 'Connect now' }));

    expect(onboardingProgress.isLeftForLink).toBe(true);
  });

  it('comes back to the bank step with the tracked currencies chosen before the link', () => {
    const first = renderWithProviders(<OnboardingWizard onComplete={vi.fn()} />);
    clickNext();
    clickNext();
    fireEvent.click(screen.getByRole('button', { name: 'EUR' }));
    clickNext();
    fireEvent.click(screen.getByRole('link', { name: 'Connect now' }));
    first.unmount();

    renderWithProviders(<OnboardingWizard onComplete={vi.fn()} />);

    expect(screen.getByRole('link', { name: 'Connect now' })).toBeVisible();
    expect(onboardingProgress.isLeftForLink).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'EUR' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('saves the choices and completes when the last step is skipped', async () => {
    const onComplete = vi.fn();
    renderWithProviders(<OnboardingWizard onComplete={onComplete} />);

    clickNext();
    fireEvent.change(screen.getByLabelText('Base currency'), { target: { value: 'PLN' } });
    clickNext();
    fireEvent.click(screen.getByRole('button', { name: 'EUR' }));
    clickNext();
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
    expect(mockPatch).toHaveBeenCalledWith('/users/me', {
      onboardingCompleted: true,
      interestingCurrencies: ['EUR'],
      locale: 'en',
      baseCurrency: 'PLN',
    });
    expect(localStorage.getItem('pb_base_currency')).toBe('PLN');
    expect(localStorage.getItem('pb_interesting_currencies')).toBe('["EUR"]');
  });

  it('still saves to the profile when the device storage refuses the cache write', async () => {
    vi.stubGlobal('localStorage', {
      getItem: (): null => null,
      setItem: (): never => {
        throw new Error('quota');
      },
      removeItem: (): void => undefined,
    });
    const onComplete = vi.fn();
    renderWithProviders(<OnboardingWizard onComplete={onComplete} />);
    for (let step = 0; step < 3; step += 1) {
      clickNext();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
    vi.unstubAllGlobals();
    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('stays on the last step and says so when saving to the profile fails', async () => {
    mockPatch.mockRejectedValue(new Error('offline'));
    const onComplete = vi.fn();
    renderWithProviders(<OnboardingWizard onComplete={onComplete} />);

    clickNext();
    clickNext();
    clickNext();
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not save your choices. Try again.',
    );
    expect(onComplete).not.toHaveBeenCalled();
  });
});
