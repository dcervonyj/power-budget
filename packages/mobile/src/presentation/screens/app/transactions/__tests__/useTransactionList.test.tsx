import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { TransactionListItemDto, TransactionPageDto } from '@power-budget/shared-app/contract';
import { transactionsGateway } from '../transactionsGateway.js';
import { useTransactionList } from '../useTransactionList.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../transactionsGateway.js', () => ({
  transactionsGateway: { page: jest.fn(), setMapping: jest.fn() },
}));
jest.mock('../../../../../infrastructure/index.js', () => ({
  apiClient: {},
  plansApi: {
    list: jest.fn().mockResolvedValue([]),
    dashboard: jest.fn(),
    listItems: jest.fn().mockResolvedValue([]),
  },
  categoriesApi: { list: jest.fn().mockResolvedValue([]) },
}));

const page = jest.mocked(transactionsGateway.page);

/** The API row, reduced to the fields the list reads. */
function item(id: string, mapped: boolean): TransactionListItemDto {
  const row = {
    id,
    status: 'booked',
    occurredOn: '2026-10-27',
    description: `Shop ${id}`,
    merchant: null,
    amount: { amountMinor: '-1000', currency: 'PLN' },
    mapping: mapped ? { plannedItemId: 'item-1', planName: 'October', categoryName: 'Food' } : null,
    mappingSource: null,
    transfer: null,
    suggestedPlannedItemId: null,
  };

  return row as unknown as TransactionListItemDto;
}

function onePage(...items: TransactionListItemDto[]): TransactionPageDto {
  return { items, nextCursor: null, hasMore: false };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  const holder: { resolve: (value: T) => void } = { resolve: () => undefined };
  const promise = new Promise<T>((resolve) => {
    holder.resolve = resolve;
  });

  return { promise, resolve: holder.resolve };
}

beforeEach(() => {
  page.mockReset();
});

describe('useTransactionList reloads', () => {
  it('shows a mapping or transfer changed elsewhere after a reload', async () => {
    page.mockResolvedValueOnce(onePage(item('a', false)));
    const { result } = await renderHook(() => useTransactionList());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.counts).toEqual({ all: 1, toSort: 1, sorted: 0, transfers: 0 });

    page.mockResolvedValueOnce(onePage(item('a', true)));
    await act(async () => result.current.reload());

    await waitFor(() =>
      expect(result.current.counts).toEqual({ all: 1, toSort: 0, sorted: 1, transfers: 0 }),
    );
  });

  it('ignores a reload that finishes after a newer one', async () => {
    page.mockResolvedValueOnce(onePage(item('a', false)));
    const { result } = await renderHook(() => useTransactionList());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const stale = deferred<TransactionPageDto>();
    page.mockReturnValueOnce(stale.promise);
    page.mockResolvedValueOnce(onePage(item('a', true)));
    await act(async () => {
      result.current.reload();
      result.current.reload();
    });
    await waitFor(() => expect(result.current.counts.sorted).toBe(1));
    await act(async () => stale.resolve(onePage(item('a', false))));

    expect(result.current.counts).toEqual({ all: 1, toSort: 0, sorted: 1, transfers: 0 });
  });

  it('keeps the rows, flags them as possibly stale and retries', async () => {
    page.mockResolvedValueOnce(onePage(item('a', false)));
    const { result } = await renderHook(() => useTransactionList());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    page.mockRejectedValueOnce(new Error('offline'));
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.reloadFailed).toBe(true));
    expect(result.current.status).toBe('ready');
    expect(result.current.counts.all).toBe(1);

    page.mockResolvedValueOnce(onePage(item('a', true)));
    await act(async () => result.current.retry());

    await waitFor(() => expect(result.current.reloadFailed).toBe(false));
    expect(result.current.counts.sorted).toBe(1);
  });
});
