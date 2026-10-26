import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { darkTheme } from '@power-budget/design-tokens';
import { ThemeProvider } from '../ThemeContext.js';
import { TransactionMapModal } from '../TransactionMapModal.js';
import { TransactionMapper } from '../../../infrastructure/api/TransactionMapper.js';
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
const mockPatch = vi.mocked(apiClient.patch);

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <IntlProvider locale="en" messages={{}}>
    <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>
  </IntlProvider>
);

const plan = {
  id: 'plan-1',
  name: 'May Budget',
  type: 'personal',
  ownerUserId: 'u1',
  periodKind: 'monthly',
  period: { start: '2026-10-01', end: '2026-10-31' },
  baseCurrency: 'EUR',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

function item(id: string, categoryId: string) {
  return {
    id,
    planId: 'plan-1',
    categoryId,
    direction: 'expense',
    amount: { amountMinor: '50000', currency: 'EUR' },
    note: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

function transaction(suggestedPlannedItemId: string | null) {
  return TransactionMapper.fromListItem({
    id: 'tx-1',
    accountId: 'acc-1',
    externalId: null,
    occurredOn: '2026-10-21',
    amount: { amountMinor: '-1500', currency: 'EUR' },
    description: 'Biedronka',
    merchant: null,
    source: 'bank_sync',
    status: 'booked',
    ignored: false,
    notes: null,
    suggestedPlannedItemId,
    createdAt: '2026-10-21T10:00:00.000Z',
  });
}

let spentOnI1 = '20000';

function dashboard() {
  const money = (amountMinor: string) => ({ amountMinor, currency: 'EUR' });

  return {
    expenseLines: [
      {
        plannedItemId: 'i1',
        planned: money('50000'),
        actual: money(spentOnI1),
        remaining: money('0'),
      },
    ],
  };
}

describe('TransactionMapModal', () => {
  const onClose = vi.fn();
  const onMapped = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    spentOnI1 = '20000';
    mockPatch.mockResolvedValue({ status: 200, data: undefined, headers: {} });
    mockGet.mockImplementation((url: string) => {
      const data =
        url === '/plans?status=active'
          ? [plan]
          : url === '/plans/plan-1/dashboard'
            ? dashboard()
            : url === '/plans/plan-1/items'
              ? [item('i1', 'c1'), item('i2', 'c2')]
              : url === '/categories?includeArchived=true'
                ? [
                    { id: 'c1', name: 'Groceries' },
                    { id: 'c2', name: 'Transport' },
                  ]
                : [];

      return Promise.resolve({ status: 200, data, headers: {} });
    });
  });

  function open(current: string | null, suggested: string | null) {
    render(
      <TransactionMapModal
        transaction={transaction(suggested)}
        currentPlannedItemId={current}
        isOpen
        onClose={onClose}
        onMapped={onMapped}
      />,
      { wrapper },
    );
  }

  it('is only a mapper: no notes, transfer or ignore controls', async () => {
    open(null, null);
    await screen.findByText('Groceries');

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(
      screen.getByText('Map transaction', { selector: 'h2, h1, h3, [id=modal-title]' }),
    ).toBeDefined();
    expect(screen.queryByText('Notes')).toBeNull();
    expect(screen.queryByText('Mark as transfer')).toBeNull();
    expect(screen.queryByText('Ignore')).toBeNull();
  });

  it('puts the API-suggested item first with a Suggested chip', async () => {
    open(null, 'i2');
    await screen.findByText('Transport');

    const rows = screen.getAllByRole('radio');
    expect(rows[0]?.textContent).toContain('Transport');
    expect(screen.getAllByText('Suggested')).toHaveLength(1);
  });

  it('maps the chosen item with PATCH /transactions/:id/mapping', async () => {
    open(null, null);
    fireEvent.click(await screen.findByText('Groceries'));
    fireEvent.click(screen.getByRole('button', { name: 'Map transaction' }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/transactions/tx-1/mapping', {
        plannedItemId: 'i1',
      });
    });
    await waitFor(() => {
      expect(onMapped).toHaveBeenCalledWith('i1');
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('clears an existing mapping with a null planned item', async () => {
    open('i1', null);
    await screen.findByText('Groceries');
    expect(screen.getByText('Current')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Clear mapping' }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/transactions/tx-1/mapping', {
        plannedItemId: null,
      });
    });
    await waitFor(() => {
      expect(onMapped).toHaveBeenCalledWith(null);
    });
  });

  it('keeps the modal open and says so when the API refuses', async () => {
    mockPatch.mockRejectedValueOnce(new Error('403'));
    open(null, null);
    fireEvent.click(await screen.findByText('Groceries'));
    fireEvent.click(screen.getByRole('button', { name: 'Map transaction' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Failed to update mapping');
    expect(onMapped).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('filters the items by the search box', async () => {
    open(null, null);
    await screen.findByText('Groceries');

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'trans' } });

    expect(screen.queryByText('Groceries')).toBeNull();
    expect(screen.getByText('Transport')).toBeDefined();
  });

  it('previews the category rod after the pick: what is left once the expense counts', async () => {
    open(null, null);
    fireEvent.click(await screen.findByText('Groceries'));

    const preview = await screen.findByTestId('map-rod-preview');
    expect(preview.textContent).toContain('Groceries');
    expect(preview.textContent).toMatch(/After mapping: .*285\.00.* left of .*500\.00/);
    expect(
      screen.getByRole('img', { name: /Groceries: .*285\.00.* left of .*500\.00/ }),
    ).toBeDefined();
  });

  it('previews an over-budget rod with its tag and the excess', async () => {
    spentOnI1 = '49500';
    open(null, null);
    fireEvent.click(await screen.findByText('Groceries'));

    const preview = await screen.findByTestId('map-rod-preview');
    expect(preview.textContent).toMatch(/After mapping: over by .*10\.00/);
    expect(preview.textContent).toContain('Over budget');
  });

  it('shows no preview when the picked item has no dashboard line', async () => {
    open(null, null);
    fireEvent.click(await screen.findByText('Transport'));

    await screen.findByRole('radio', { checked: true });
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/plans/plan-1/dashboard');
    });
    expect(screen.queryByTestId('map-rod-preview')).toBeNull();
  });
});
