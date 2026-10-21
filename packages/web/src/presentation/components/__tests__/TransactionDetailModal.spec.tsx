import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { darkTheme } from '@power-budget/design-tokens';
import { ThemeProvider } from '../ThemeContext.js';
import { TransactionDetailModal } from '../TransactionDetailModal.js';
import { apiClient } from '../../../AppProviders.js';

vi.mock('../MoneyView.js', () => ({
  MoneyView: ({ amount }: { amount: { amountMinor: bigint; currency: string } }) => (
    <span>{`${amount.amountMinor} ${amount.currency}`}</span>
  ),
}));

vi.mock('../../../AppProviders.js', async () => {
  const { PlansApi } = await import('@power-budget/shared-app');
  const client = {
    request: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };

  return { apiClient: client, plansApi: new PlansApi(client) };
});

const mockGet = vi.mocked(apiClient.get);

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <IntlProvider locale="en" messages={{}}>
    <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>
  </IntlProvider>
);

const transaction = {
  id: 'tx-1',
  accountId: 'acc-1',
  externalId: null,
  occurredOn: '2026-10-21',
  amount: { amountMinor: '-1500', currency: 'EUR' },
  description: 'Biedronka',
  merchant: null,
  source: 'bank_sync',
  status: 'pending',
  ignored: false,
  notes: null,
  suggestedPlannedItemId: null,
  createdAt: '2026-10-21T10:00:00.000Z',
};

describe('TransactionDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      const data =
        url === '/transactions/tx-1' ? { transaction, mapping: null, transfer: null } : [];

      return Promise.resolve({ status: 200, data, headers: {} });
    });
  });

  it('shows the details with notes, transfer and ignore, and the booking status', async () => {
    render(<TransactionDetailModal transactionId="tx-1" isOpen onClose={vi.fn()} />, { wrapper });

    expect(await screen.findByText('Bank · Pending')).toBeDefined();
    expect(screen.getByText('Notes')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Mark as transfer' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Ignore' })).toBeDefined();
    expect(screen.getByText('Not mapped')).toBeDefined();
  });

  it('does not embed the planned-item picker; Map to planned item opens the map modal', async () => {
    render(<TransactionDetailModal transactionId="tx-1" isOpen onClose={vi.fn()} />, { wrapper });
    await screen.findByText('Not mapped');
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Map to planned item' }));

    expect(await screen.findByRole('searchbox')).toBeDefined();
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
  });
});
