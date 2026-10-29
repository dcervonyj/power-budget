import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { darkTheme } from '@power-budget/design-tokens';
import { ThemeProvider } from '../ThemeContext.js';
import { CreatePlanModal } from '../CreatePlanModal.js';
import { plansApi } from '../../../composition.js';
import { spyOnApiClient } from '../../../test/apiClientSpies.js';
import { PLAN, apiError } from '../../../test/dashboardFixtures.js';

spyOnApiClient();
const create = vi.spyOn(plansApi, 'create');

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <IntlProvider locale="en" messages={{}}>
    <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>
  </IntlProvider>
);

function open(hasHousehold: boolean, onCreated = vi.fn()) {
  render(
    <CreatePlanModal
      isOpen
      hasHousehold={hasHousehold}
      profileCurrency="PLN"
      onClose={vi.fn()}
      onCreated={onCreated}
    />,
    { wrapper },
  );

  return onCreated;
}

function typeName(name: string): void {
  fireEvent.change(screen.getByLabelText('Plan name'), { target: { value: name } });
}

describe('CreatePlanModal', () => {
  beforeEach(() => {
    create.mockReset();
  });

  it('offers Household only to a household member', () => {
    open(true);

    expect(screen.getByRole('option', { name: 'Household' })).toBeDefined();
    expect(screen.getByRole('option', { name: 'Personal' })).toBeDefined();
  });

  it('hides Household for a user without a household', () => {
    open(false);

    expect(screen.queryByRole('option', { name: 'Household' })).toBeNull();
  });

  it('defaults the base currency to the profile currency', () => {
    open(false);

    expect(screen.getByLabelText<HTMLSelectElement>('Base currency').value).toBe('PLN');
  });

  it('shows the derived, read-only end date for the default monthly plan', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 29) });
    open(false);
    vi.useRealTimers();

    const end = screen.getByLabelText<HTMLInputElement>('End date');
    expect(end.value).toBe('2026-10-31');
    expect(end.disabled).toBe(true);
  });

  it('shows the derived, read-only end date for a weekly plan', () => {
    open(false);

    fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'weekly' } });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-10-26' } });

    const end = screen.getByLabelText<HTMLInputElement>('End date');
    expect(end.value).toBe('2026-11-01');
    expect(end.disabled).toBe(true);
  });

  it('shows field errors in the form for an empty name and a custom end before the start', () => {
    open(false);
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-10-10' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-10-01' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(screen.getByText('Enter a plan name')).toBeDefined();
    expect(screen.getByText('The end date must be after the start date')).toBeDefined();
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a household plan and reports it', async () => {
    create.mockResolvedValue(PLAN);
    const onCreated = open(true);
    typeName('Home');
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'household' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledExactlyOnceWith(PLAN));
    expect(create.mock.calls[0]?.[0].type).toBe('household');
  });

  it('shows its own message for a 409, not the generic one', async () => {
    create.mockRejectedValue(apiError(409, 'plan_duplicate'));
    const onCreated = open(false);
    typeName('Home');

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await screen.findByText(
      'You already have an active plan of this type for these dates. Archive it or choose other dates.',
    );
    expect(screen.queryByText('Failed to create plan')).toBeNull();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
