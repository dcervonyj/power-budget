import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/renderWithProviders.js';
import { OnboardingWizard } from '../OnboardingWizard.js';

function clickNext(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
}

describe('OnboardingWizard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts on the language step with the step rod at 1 of 5 and Back disabled', () => {
    renderWithProviders(<OnboardingWizard onComplete={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Choose your language' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Step 1 of 5' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked();
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

  it('saves the choices and completes when the last step is skipped', () => {
    const onComplete = vi.fn();
    renderWithProviders(<OnboardingWizard onComplete={onComplete} />);

    clickNext();
    fireEvent.change(screen.getByLabelText('Base currency'), { target: { value: 'PLN' } });
    clickNext();
    fireEvent.click(screen.getByRole('button', { name: 'EUR' }));
    clickNext();
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('pb_base_currency')).toBe('PLN');
    expect(localStorage.getItem('pb_interesting_currencies')).toBe('["EUR"]');
  });
});
