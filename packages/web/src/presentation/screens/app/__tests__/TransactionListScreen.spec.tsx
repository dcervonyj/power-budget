import React from 'react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { darkTheme } from '@power-budget/design-tokens';
import type { TransactionListItemDto } from '@power-budget/shared-app/contract';
import { ThemeProvider } from '../../../components/ThemeContext.js';
import { TransactionDetailScreen } from '../TransactionDetailScreen.js';
import { apiClient } from '../../../../AppProviders.js';

vi.mock('../../../components/MoneyView.js', () => ({
  MoneyView: ({ amount }: { amount: { amountMinor: bigint; currency: string } }) => (
    <span>{`${amount.amountMinor} ${amount.currency}`}</span>
  ),
}));

vi.mock('../../../../AppProviders.js', async () => {
  const { BulkTransactionActions } =
    await import('../../../../application/transactions/BulkTransactionActions.js');
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
    categoriesApi: new CategoriesApi(client),
    plansApi: new PlansApi(client),
    bulkTransactionActions: new BulkTransactionActions(client),
  };
});

const mockGet = vi.mocked(apiClient.get);
const mockPatch = vi.mocked(apiClient.patch);

function row(id: string, overrides: Partial<TransactionListItemDto>): TransactionListItemDto {
  return {
    id,
    accountId: 'acc-1',
    externalId: null,
    occurredOn: '2026-10-21',
    amount: { amountMinor: '-1500', currency: 'PLN' },
    description: id,
    merchant: null,
    source: 'manual',
    status: 'booked',
    ignored: false,
    notes: null,
    suggestedPlannedItemId: null,
    createdAt: '2026-10-21T10:00:00.000Z',
    mapping: null,
    mappingSource: 'none',
    transfer: null,
    ...overrides,
  };
}

const page = {
  items: [
    row('Biedronka', {
      mapping: {
        plannedItemId: 'item-1',
        planId: 'plan-old',
        planName: 'September',
        planArchived: true,
        categoryId: 'cat-1',
        categoryName: 'Groceries',
        categorySeedKey: null,
        mappedAt: '2026-10-21T10:00:00.000Z',
      },
      mappingSource: 'manual',
    }),
    row('Allegro', { suggestedPlannedItemId: 'item-2', mappingSource: 'suggestion' }),
    row('Savings', { transfer: { transferId: 'tr-1', counterpartTransactionId: null } }),
  ],
  nextCursor: null,
  hasMore: false,
};

function ok<T>(data: T): { status: number; data: T; headers: Record<string, string> } {
  return { status: 200, data, headers: {} };
}

function apiError(status: number): Error & { response: unknown } {
  return Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: { code: 'transaction_not_found' } },
  });
}

/** Answers the list and leaves everything else (plans, categories) empty. */
function routeGets(detail: () => Promise<unknown> = () => Promise.reject(apiError(500))): void {
  mockGet.mockImplementation((url: string) => {
    if (url.startsWith('/transactions?')) {
      return Promise.resolve(ok(page));
    }
    if (url.startsWith('/transactions/')) {
      return detail() as never;
    }

    return Promise.resolve(ok([]));
  });
}

function renderAt(path: string): void {
  render(
    <IntlProvider locale="en" messages={{}}>
      <ThemeProvider theme={darkTheme}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/transactions/:id?" element={<TransactionDetailScreen />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </IntlProvider>,
  );
}

function detailReads(): string[] {
  return mockGet.mock.calls
    .map((call) => call[0])
    .filter((url) => url.startsWith('/transactions/'));
}

describe('TransactionListScreen', () => {
  beforeAll(() => {
    // jsdom has no IntersectionObserver (infinite scroll).
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe(): void {}
        disconnect(): void {}
      },
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows mapping, provenance and transfer from the list rows without reading details', async () => {
    routeGets();
    renderAt('/transactions');

    expect(await screen.findByTestId('mapping-target')).toHaveProperty('textContent', 'Groceries');
    expect(screen.getByText('Manual', { selector: 'span' })).toBeDefined();
    expect(screen.getByText('Archived plan')).toBeDefined();
    expect(screen.getByText('Suggested')).toBeDefined();
    expect(screen.getByText('Transfer')).toBeDefined();
    expect(screen.queryByText('Unmapped', { selector: 'span' })).toBeNull();
    expect(detailReads()).toEqual([]);
  });

  it('sends the mapping and booking filters to the API and keeps every returned row', async () => {
    routeGets();
    renderAt('/transactions?status=unmapped&booking=pending');

    await screen.findByText('Biedronka');
    expect(mockGet).toHaveBeenCalledWith('/transactions?unmappedOnly=true&status=pending&limit=50');
    expect(screen.getByText('Savings')).toBeDefined();
  });

  it('sends the mapped filter from the URL to the API', async () => {
    routeGets();
    renderAt('/transactions?status=mapped');
    await screen.findByText('Biedronka');
    expect(mockGet).toHaveBeenCalledWith('/transactions?mapped=true&limit=50');
  });

  it('sends the transfer filter from the URL to the API', async () => {
    routeGets();
    renderAt('/transactions?status=transfer');
    await screen.findByText('Biedronka');
    expect(mockGet).toHaveBeenCalledWith('/transactions?transfer=true&limit=50');
  });

  it('drops a row whose mapping write answers 404 and says so', async () => {
    routeGets();
    mockPatch.mockRejectedValue(apiError(404));
    renderAt('/transactions');

    fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Clear mapping' }));

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain(
        'This transaction is no longer available.',
      );
    });
    expect(mockPatch).toHaveBeenCalledWith('/transactions/Biedronka/mapping', {
      plannedItemId: null,
    });
    expect(screen.queryByText('Biedronka')).toBeNull();
    expect(screen.getByText('Allegro')).toBeDefined();
  });

  it("closes the detail of a transaction that answers 404 (a partner's) with a notice", async () => {
    routeGets(() => Promise.reject(apiError(404)));
    renderAt('/transactions/partner-tx');

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain(
        'This transaction is no longer available.',
      );
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Biedronka')).toBeDefined();
  });
});
