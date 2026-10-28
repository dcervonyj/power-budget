import React from 'react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { darkTheme } from '@power-budget/design-tokens';
import type { TransactionListItemDto } from '@power-budget/shared-app/contract';
import { ThemeProvider } from '../../../components/ThemeContext.js';
import { TransactionDetailScreen } from '../TransactionDetailScreen.js';
import { referenceCatalogue } from '../../../../composition.js';
import { spyOnApiClient } from '../../../../test/apiClientSpies.js';

const apiSpies = spyOnApiClient();

vi.mock('../../../components/MoneyView.js', () => ({
  MoneyView: ({ amount }: { amount: { amountMinor: bigint; currency: string } }) => (
    <span>{`${amount.amountMinor} ${amount.currency}`}</span>
  ),
}));

const mockGet = apiSpies.get;
const mockPatch = apiSpies.patch;

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
    referenceCatalogue.invalidate();
    vi.clearAllMocks();
  });

  it('shows mapping, provenance and transfer from the list rows without reading details', async () => {
    routeGets();
    renderAt('/transactions');

    expect(await screen.findByText(/Groceries/)).toBeDefined();
    expect(screen.getAllByText('Added by hand').length).toBeGreaterThan(0);
    expect(screen.getByText(/Archived plan/)).toBeDefined();
    expect(screen.getByText('Transfer')).toBeDefined();
    // The filter chip and the Allegro row's tag.
    expect(screen.getAllByText('To sort')).toHaveLength(2);
    expect(detailReads()).toEqual([]);
  });

  it('groups the rows under a heading per day', async () => {
    routeGets();
    renderAt('/transactions');

    await screen.findByText('Biedronka');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toContain(
      'Wednesday, October 21',
    );
  });

  it('counts the sorted and to-sort rows in the Sorting panel', async () => {
    routeGets();
    renderAt('/transactions');

    await screen.findByText('Biedronka');
    expect(screen.getByText('Sorting')).toBeDefined();
    expect(screen.getByRole('img', { name: '2 of 3 sorted' })).toBeDefined();
    expect(screen.getByText('2 sorted · 1 to sort')).toBeDefined();
  });

  it('hides the Sorting panel while a filter is on', async () => {
    routeGets();
    renderAt('/transactions?status=mapped');

    await screen.findByText('Biedronka');
    expect(screen.queryByText('Sorting')).toBeNull();
  });

  it('sends category, currency and source to the API and keeps every row it returns', async () => {
    routeGets();
    renderAt('/transactions?category=cat-1&currency=eur&source=wise');

    // The fixture rows are PLN and manual: the API filtered, the page drops nothing (PERF-07).
    expect(await screen.findByText('Biedronka')).toBeDefined();
    expect(mockGet.mock.calls.map((call) => call[0])).toContain(
      '/transactions?categoryId=cat-1&currency=EUR&source=bank_sync&limit=50',
    );
    // Every provider can be picked (review F2); an old `wise` link still means every bank row (F3).
    for (const name of ['Bank', 'Enable Banking', 'Wise', 'PKO email', 'IKO push', 'Manual']) {
      expect(screen.getByRole('option', { name })).toBeDefined();
    }
    expect(screen.getByRole('option', { name: 'Bank' })).toHaveProperty('selected', true);
  });

  it('sends the Wise provider for its own value and selects it (review F2/F3)', async () => {
    routeGets();
    renderAt('/transactions?source=wise_webhook');

    await screen.findByText('Biedronka');
    expect(mockGet.mock.calls.map((call) => call[0])).toContain(
      '/transactions?source=wise_webhook&limit=50',
    );
    expect(screen.getByRole('option', { name: 'Wise' })).toHaveProperty('selected', true);
  });

  it('drops a "load more" page of the old filters after a filter change (review F1)', async () => {
    const observers: ((entries: { isIntersecting: boolean }[]) => void)[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
          observers.push(callback);
        }
        observe(): void {}
        disconnect(): void {}
      },
    );
    const oldPage = { release: (): void => undefined };
    mockGet.mockImplementation((url: string) => {
      if (url.includes('cursor=c1')) {
        return new Promise((resolve) => {
          oldPage.release = () => {
            resolve(ok({ items: [row('Stale', {})], nextCursor: 'c2', hasMore: true }));
          };
        });
      }
      if (url.startsWith('/transactions?mapped=true')) {
        return Promise.resolve(ok({ items: [row('Fresh', {})], nextCursor: null, hasMore: false }));
      }
      if (url.startsWith('/transactions?')) {
        return Promise.resolve(ok({ ...page, nextCursor: 'c1', hasMore: true }));
      }

      return Promise.resolve(ok([]));
    });
    renderAt('/transactions');
    await screen.findByText('Biedronka');
    // The sentinel observer is created in a passive effect after the first page renders;
    // triggering it before it exists would silently skip the "load more" request.
    await waitFor(() => {
      expect(observers.length).toBeGreaterThan(0);
    });

    act(() => {
      observers[observers.length - 1]?.([{ isIntersecting: true }]);
    });
    await waitFor(() => {
      expect(mockGet.mock.calls.map((call) => call[0])).toContain(
        '/transactions?limit=50&cursor=c1',
      );
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Mapped' }));
    await screen.findByText('Fresh');
    await act(async () => {
      oldPage.release();
      await Promise.resolve();
    });

    expect(screen.queryByText('Stale')).toBeNull();
    expect(screen.getByText('Fresh')).toBeDefined();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe(): void {}
        disconnect(): void {}
      },
    );
  });

  it('shows the month rod only when a plan dashboard is loaded', async () => {
    routeGets();
    renderAt('/transactions');

    await screen.findByText('Biedronka');
    expect(screen.queryByText(/left in/)).toBeNull();
  });

  it('shows the empty state when no transaction comes back', async () => {
    mockGet.mockImplementation((url: string) =>
      Promise.resolve(
        ok(url.startsWith('/transactions?') ? { items: [], nextCursor: null, hasMore: false } : []),
      ),
    );
    renderAt('/transactions');

    expect(await screen.findByText('No transactions yet')).toBeDefined();
  });

  it('shows an alert with Try again when the list fails, and reloads on retry', async () => {
    mockGet.mockImplementation((url: string) =>
      url.startsWith('/transactions?') ? Promise.reject(apiError(500)) : Promise.resolve(ok([])),
    );
    renderAt('/transactions');

    expect((await screen.findByRole('alert')).textContent).toContain('Failed to load transactions');
    routeGets();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Biedronka')).toBeDefined();
  });

  it('maps a row to its suggested item when Confirm is pressed', async () => {
    routeGets();
    mockPatch.mockResolvedValue(ok(undefined));
    renderAt('/transactions');

    fireEvent.click(await screen.findByRole('button', { name: 'Choose a category for Allegro' }));
    expect(await screen.findByRole('dialog')).toBeDefined();
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

    fireEvent.click(
      await screen.findByRole('button', { name: 'Change the category of Biedronka' }),
    );
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
    // react-router 7 applies navigate() in a React transition, so the route (and the dialog
    // with it) changes a tick after the toast is set.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByText('Biedronka')).toBeDefined();
  });
});
