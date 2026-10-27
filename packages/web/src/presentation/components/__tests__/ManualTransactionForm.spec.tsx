import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { darkTheme } from '@power-budget/design-tokens';
import { toLocalIsoDate } from '@power-budget/core';
import type { AccountDto } from '@power-budget/shared-app/contract';
import { ThemeProvider } from '../ThemeContext.js';
import { ManualTransactionForm, toSignedMinorUnits } from '../ManualTransactionForm.js';
import { apiClient } from '../../../AppProviders.js';
import en from '../../../../public/locales/en.json';

vi.mock('../../../AppProviders.js', () => {
  const client = {
    request: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };

  return { apiClient: client };
});

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <IntlProvider locale="en" messages={en}>
    <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>
  </IntlProvider>
);

function account(overrides: Partial<AccountDto>): AccountDto {
  return {
    id: 'acc-bank',
    kind: 'bank',
    name: 'PKO',
    currency: 'PLN',
    connectionId: 'conn-1',
    balance: { amountMinor: '1000', currency: 'PLN' },
    lastSyncedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function created(data: unknown) {
  return { status: 201, data, headers: {} };
}

describe('toSignedMinorUnits', () => {
  it('parses normal units exactly and signs them by direction', () => {
    expect(toSignedMinorUnits('12,50', 'PLN', 'expense')).toBe('-1250');
    expect(toSignedMinorUnits('1 200.5', 'EUR', 'income')).toBe('120050');
  });

  it('rejects zero, negative input and too many decimals', () => {
    expect(toSignedMinorUnits('0', 'PLN', 'expense')).toBeNull();
    expect(toSignedMinorUnits('-5', 'PLN', 'income')).toBeNull();
    expect(toSignedMinorUnits('1.234', 'PLN', 'expense')).toBeNull();
    expect(toSignedMinorUnits('abc', 'PLN', 'expense')).toBeNull();
  });
});

describe('ManualTransactionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers a cash account when the user has none, then the form in its currency', async () => {
    mockGet.mockResolvedValue({ status: 200, data: [], headers: {} });
    const cash = account({
      id: 'acc-cash',
      kind: 'manual',
      name: 'Cash',
      currency: 'EUR',
      connectionId: null,
      balance: null,
    });
    mockPost.mockResolvedValue(created(cash));
    render(<ManualTransactionForm />, { wrapper });

    await screen.findByText(en['component.manualTransactionForm.cashAccount.intro']);
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'EUR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create cash account' }));

    await screen.findByLabelText('Amount');
    expect(mockGet).toHaveBeenCalledWith('/accounts');
    expect(mockPost).toHaveBeenCalledWith('/accounts', { name: 'Cash', currency: 'EUR' });
    expect(screen.getByTestId('mtf-currency').textContent).toBe('EUR');
  });

  it('adds an expense in minor units of the account currency, dated today (local)', async () => {
    const onSuccess = vi.fn();
    mockGet.mockResolvedValue({
      status: 200,
      data: [account({}), account({ id: 'acc-cash', kind: 'manual', name: 'Cash' })],
      headers: {},
    });
    mockPost.mockResolvedValue(created({ id: 'tx-new' }));
    render(<ManualTransactionForm onSuccess={onSuccess} />, { wrapper });

    fireEvent.change(await screen.findByLabelText('Amount'), { target: { value: '12,50' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Market' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('tx-new');
    });
    expect(mockPost).toHaveBeenCalledWith('/transactions', {
      accountId: 'acc-cash',
      occurredOn: toLocalIsoDate(new Date()),
      amountMinor: '-1250',
      currency: 'PLN',
      description: 'Market',
      notes: null,
    });
  });

  it('adds income as a positive amount', async () => {
    mockGet.mockResolvedValue({ status: 200, data: [account({})], headers: {} });
    mockPost.mockResolvedValue(created({ id: 'tx-in' }));
    render(<ManualTransactionForm />, { wrapper });

    fireEvent.change(await screen.findByLabelText('Type'), { target: { value: 'income' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Gift' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledOnce();
    });
    expect(mockPost.mock.calls[0]?.[1]).toMatchObject({
      accountId: 'acc-bank',
      amountMinor: '10000',
    });
  });

  it('rejects an amount with too many decimals without calling the API', async () => {
    mockGet.mockResolvedValue({ status: 200, data: [account({})], headers: {} });
    render(<ManualTransactionForm />, { wrapper });

    fireEvent.change(await screen.findByLabelText('Amount'), { target: { value: '1.234' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      en['component.manualTransactionForm.error.amount'],
    );
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('shows the form for given accounts without asking the API, with 44 px controls', async () => {
    render(<ManualTransactionForm initialAccounts={[account({})]} />, { wrapper });

    const amount = await screen.findByLabelText('Amount');
    expect(mockGet).not.toHaveBeenCalled();
    expect(amount.style.minHeight).toBe('44px');
    expect(screen.getByRole('button', { name: 'Add Transaction' })).toBeDefined();
  });
});
