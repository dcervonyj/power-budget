import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { TransactionListItemDto, TransactionPageDto } from '@power-budget/shared-app/contract';
import { transactionsGateway } from '../transactionsGateway.js';
import { useTransactionList } from '../useTransactionList.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../transactionsGateway.js', () => {
  const { SerialQueue } = jest.requireActual(
    '../../../../../infrastructure/transactions/SerialQueue.js',
  );

  return {
    transactionsGateway: { page: jest.fn(), setMapping: jest.fn() },
    writeQueue: new SerialQueue(),
  };
});
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
const setMapping = jest.mocked(transactionsGateway.setMapping);

/** The API row, reduced to the fields the list reads. */
function item(
  id: string,
  mapped: boolean,
  suggested: string | null = null,
): TransactionListItemDto {
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
    suggestedPlannedItemId: suggested,
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
  setMapping.mockReset();
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

describe('useTransactionList pending changes and stale pages', () => {
  it('keeps a confirmed row confirmed when a reload finishes before its request', async () => {
    page.mockResolvedValueOnce(onePage(item('a', false, 'item-1')));
    const { result } = await renderHook(() => useTransactionList());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const saving = deferred<undefined>();
    setMapping.mockReturnValueOnce(saving.promise as never);
    await act(async () => result.current.confirm('a'));
    expect(result.current.appliedIds.has('a')).toBe(true);

    page.mockResolvedValueOnce(onePage(item('a', false, 'item-1')));
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(result.current.appliedIds.has('a')).toBe(true);

    page.mockResolvedValueOnce(onePage(item('a', true)));
    await act(async () => saving.resolve(undefined));
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.counts.sorted).toBe(1));
    expect(result.current.appliedIds.has('a')).toBe(false);
  });

  it('keeps the confirmed row with Undo when a reload already shows the mapping before the write answers', async () => {
    page.mockResolvedValueOnce(onePage(item('a', false, 'item-1')));
    const { result } = await renderHook(() => useTransactionList());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const saving = deferred<undefined>();
    setMapping.mockReturnValueOnce(saving.promise as never);
    await act(async () => result.current.confirm('a'));

    page.mockResolvedValueOnce(onePage(item('a', true)));
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.refreshing).toBe(false));

    const row = result.current.groups[0]?.rows[0];
    expect(row?.suggestedPlannedItemId).toBe('item-1');
    expect(result.current.appliedIds.has('a')).toBe(true);
    expect(result.current.counts.sorted).toBe(1);
  });

  it('drops a Load more answer that arrives after a reload', async () => {
    // The eager load stops at its page limit while the server still has more.
    page.mockResolvedValue({ items: [item('a', false)], nextCursor: 'c1', hasMore: true });
    const { result } = await renderHook(() => useTransactionList());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.hasMore).toBe(true);
    page.mockReset();

    const older = deferred<TransactionPageDto>();
    page.mockReturnValueOnce(older.promise);
    await act(async () => result.current.loadMore());
    page.mockResolvedValueOnce(onePage(item('a', true)));
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.hasMore).toBe(false));

    await act(async () =>
      older.resolve({ items: [item('b', false)], nextCursor: 'c2', hasMore: true }),
    );

    expect(result.current.counts.all).toBe(1);
    expect(result.current.hasMore).toBe(false);
  });
});
