import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { darkTheme } from '@power-budget/design-tokens';
import { ThemeProvider } from '../ThemeContext.js';
import { TransactionDetailModal } from '../TransactionDetailModal.js';
import { referenceCatalogue } from '../../../application/catalogue/catalogueInstance.js';
import { apiClient } from '../../../AppProviders.js';

vi.mock('../MoneyView.js', () => ({
  MoneyView: ({ amount }: { amount: { amountMinor: bigint; currency: string } }) => (
    <span>{`${amount.amountMinor} ${amount.currency}`}</span>
  ),
}));

vi.mock('../../../AppProviders.js', async () => {
  const { CategoriesApi, PlansApi } = await import('@power-budget/shared-app');
  const client = {
    request: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };

  return {
    apiClient: client,
    plansApi: new PlansApi(client),
    categoriesApi: new CategoriesApi(client),
  };
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
    referenceCatalogue.invalidate();
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

  it('names the planned item of a mapped transaction and offers to change it', async () => {
    mockGet.mockImplementation((url: string) => {
      const plan = {
        id: 'plan-1',
        name: 'October',
        type: 'personal',
        ownerUserId: 'u1',
        periodKind: 'monthly',
        period: { start: '2026-10-01', end: '2026-10-31' },
        baseCurrency: 'EUR',
        archivedAt: null,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      };
      const item = {
        id: 'i1',
        planId: 'plan-1',
        categoryId: 'c1',
        direction: 'expense',
        amount: { amountMinor: '50000', currency: 'EUR' },
        note: null,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      };
      const data =
        url === '/transactions/tx-1'
          ? { transaction, mapping: { plannedItemId: 'i1', by: 'manual' }, transfer: null }
          : url === '/plans?status=active'
            ? [plan]
            : url === '/plans/plan-1/items'
              ? [item]
              : url === '/categories?includeArchived=true'
                ? [{ id: 'c1', name: 'Groceries' }]
                : [];

      return Promise.resolve({ status: 200, data, headers: {} });
    });
    render(<TransactionDetailModal transactionId="tx-1" isOpen onClose={vi.fn()} />, { wrapper });

    expect(await screen.findByText('Groceries')).toBeDefined();
    expect(await screen.findByText('October')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Change mapping' })).toBeDefined();
    expect(screen.queryByText('Not mapped')).toBeNull();
  });

  it('labels the notes field and shows a failed load as an alert', async () => {
    render(<TransactionDetailModal transactionId="tx-1" isOpen onClose={vi.fn()} />, { wrapper });

    expect((await screen.findByLabelText('Notes')).tagName).toBe('TEXTAREA');

    mockGet.mockRejectedValue(new Error('500'));
    cleanup();
    render(<TransactionDetailModal transactionId="tx-2" isOpen onClose={vi.fn()} />, { wrapper });

    expect((await screen.findByRole('alert')).textContent).toBe('Failed to load transaction');
  });
});
