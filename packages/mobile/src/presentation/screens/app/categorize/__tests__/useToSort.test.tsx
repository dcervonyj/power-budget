import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { TransactionListItemDto, TransactionPageDto } from '@power-budget/shared-app/contract';
import { categoriesApi, plansApi } from '../../../../../infrastructure/index.js';
import { transactionsGateway } from '../../transactions/transactionsGateway.js';
import { useToSort } from '../useToSort.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../../transactions/transactionsGateway.js', () => {
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
  plansApi: { list: jest.fn(), dashboard: jest.fn() },
  categoriesApi: { list: jest.fn().mockResolvedValue([]) },
}));

const page = jest.mocked(transactionsGateway.page);
const setMapping = jest.mocked(transactionsGateway.setMapping);
const plans = jest.mocked(plansApi.list);

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

function deferred<T>() {
  const holder: { resolve: (value: T) => void } = { resolve: () => undefined };
  const promise = new Promise<T>((resolve) => {
    holder.resolve = resolve;
  });

  return { promise, resolve: holder.resolve };
}

const NOW_PLAN = [{ id: 'now', period: { start: '2000-01-01', end: '2999-12-31' } }] as never;
const dashboard = jest.mocked(plansApi.dashboard);

function dashboardOf(plannedItemId: string, planned: string): never {
  const line = {
    plannedItemId,
    categoryId: 'cat',
    planned: { amountMinor: planned, currency: 'PLN' },
    actual: { amountMinor: '0', currency: 'PLN' },
  };

  return {
    period: { start: '2000-01-01', end: '2999-12-31' },
    baseCurrency: 'PLN',
    expenseLines: [line],
    incomeLines: [],
  } as never;
}

const ids = (rows: readonly { data: { id: string } }[]): string[] => rows.map((row) => row.data.id);

beforeEach(() => {
  page.mockReset();
  setMapping.mockReset();
  plans.mockReset();
  plans.mockResolvedValue([]);
  jest.mocked(categoriesApi.list).mockResolvedValue([]);
});

describe('useToSort', () => {
  it('lists only the unsorted payments', async () => {
    page.mockResolvedValueOnce(onePage(item('a', false), item('b', true), item('c', false)));
    const { result } = await renderHook(() => useToSort());

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(ids(result.current.rows)).toEqual(['a', 'c']);
  });

  it('shows an error, then loads on retry', async () => {
    page.mockRejectedValueOnce(new Error('offline'));
    const { result } = await renderHook(() => useToSort());
    await waitFor(() => expect(result.current.status).toBe('error'));

    page.mockResolvedValueOnce(onePage(item('a', false)));
    await act(async () => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(ids(result.current.rows)).toEqual(['a']);
  });

  it('reports a failed category load and retries it', async () => {
    page.mockResolvedValue(onePage(item('a', false)));
    plans.mockRejectedValueOnce(new Error('offline'));
    const { result } = await renderHook(() => useToSort());
    await waitFor(() => expect(result.current.choicesStatus).toBe('error'));

    await act(async () => result.current.retryChoices());

    await waitFor(() => expect(result.current.choicesStatus).toBe('ready'));
  });

  it('opens on the tapped payment, or on the first, and not on an empty list', async () => {
    page.mockResolvedValueOnce(onePage(item('a', false), item('b', false)));
    const { result } = await renderHook(() => useToSort());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => result.current.open('b'));
    expect(result.current.sheet?.isOpen).toBe(true);

    await act(async () => result.current.open());
    expect(ids(result.current.sheet?.queue ?? [])).toEqual(['a', 'b']);
  });

  it('starts the pass at the tapped payment and wraps to the ones before it', async () => {
    page.mockResolvedValueOnce(onePage(item('a', false), item('b', false), item('c', false)));
    const { result } = await renderHook(() => useToSort());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => result.current.open('b'));

    expect(ids(result.current.sheet?.queue ?? [])).toEqual(['b', 'c', 'a']);
    expect(result.current.sheet?.startIndex).toBe(0);
  });

  it('reloads the categories together with the list on focus, without a loading flash', async () => {
    page.mockResolvedValue(onePage(item('a', false)));
    const { result } = await renderHook(() => useToSort());
    await waitFor(() => expect(result.current.choicesStatus).toBe('ready'));
    const before = plans.mock.calls.length;

    await act(async () => result.current.reload());

    expect(plans.mock.calls.length).toBe(before + 1);
    expect(result.current.choicesStatus).toBe('ready');
  });

  it('keeps the balances shown when a focus reload of the categories fails', async () => {
    page.mockResolvedValue(onePage(item('a', false)));
    const { result } = await renderHook(() => useToSort());
    await waitFor(() => expect(result.current.choicesStatus).toBe('ready'));

    plans.mockRejectedValueOnce(new Error('offline'));
    await act(async () => result.current.reload());

    expect(result.current.choicesStatus).toBe('ready');
    await waitFor(() => expect(result.current.choicesStale).toBe(true));

    await act(async () => result.current.retryChoices());

    await waitFor(() => expect(result.current.choicesStale).toBe(false));
  });

  it('loads the choices of every active plan, not only the one covering today', async () => {
    page.mockResolvedValue(onePage(item('a', false)));
    plans.mockResolvedValue([
      { id: 'now', name: 'October', period: { start: '2000-01-01', end: '2999-12-31' } },
      { id: 'next', name: 'November', period: { start: '2998-01-01', end: '2998-12-31' } },
    ] as never);
    dashboard.mockImplementation(async (id: string) =>
      dashboardOf(id === 'now' ? 'item-now' : 'item-next', '100'),
    );
    const { result } = await renderHook(() => useToSort());

    await waitFor(() => expect(result.current.choices).toHaveLength(2));

    expect(result.current.choices.map((c) => [c.plannedItemId, c.planName])).toEqual([
      ['item-now', 'October'],
      ['item-next', 'November'],
    ]);
  });

  it('offers choices when no plan covers today', async () => {
    page.mockResolvedValue(onePage(item('a', false)));
    plans.mockResolvedValue([
      { id: 'next', name: 'November', period: { start: '2998-01-01', end: '2998-12-31' } },
    ] as never);
    dashboard.mockResolvedValue(dashboardOf('item-next', '100'));
    const { result } = await renderHook(() => useToSort());

    await waitFor(() => expect(result.current.choices).toHaveLength(1));
  });

  it('ignores a category load that finishes after a newer one', async () => {
    page.mockResolvedValue(onePage(item('a', false)));
    const { result } = await renderHook(() => useToSort());
    await waitFor(() => expect(result.current.choicesStatus).toBe('ready'));

    const stale = deferred<never[]>();
    plans.mockReturnValueOnce(stale.promise);
    plans.mockResolvedValueOnce(NOW_PLAN);
    dashboard.mockResolvedValue(dashboardOf('item-new', '900'));
    await act(async () => {
      result.current.reload();
      result.current.reload();
    });
    await waitFor(() => expect(result.current.choices[0]?.plannedItemId).toBe('item-new'));
    dashboard.mockResolvedValue(dashboardOf('item-old', '100'));
    await act(async () => stale.resolve(NOW_PLAN as never[]));

    expect(result.current.choices.map((choice) => choice.plannedItemId)).toEqual(['item-new']);
  });

  it('reads the balances only after a write that is still on its way', async () => {
    page.mockResolvedValue(onePage(item('a', false)));
    const { result } = await renderHook(() => useToSort());
    await waitFor(() => expect(result.current.choicesStatus).toBe('ready'));
    const write = deferred<void>();
    setMapping.mockReturnValueOnce(write.promise);
    plans.mockClear();

    await act(async () => {
      void result.current.write('a', 'item-1');
      result.current.close();
    });
    expect(plans).not.toHaveBeenCalled();
    await act(async () => write.resolve());

    await waitFor(() => expect(plans).toHaveBeenCalledTimes(1));
  });

  it('leaves out of the pass a payment whose write is still in flight', async () => {
    page.mockResolvedValueOnce(onePage(item('a', false), item('b', false)));
    const { result } = await renderHook(() => useToSort());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    result.current.busyIds.add('a');

    await act(async () => result.current.open());

    expect(ids(result.current.sheet?.queue ?? [])).toEqual(['b']);
  });

  it('does not open when every payment is busy', async () => {
    page.mockResolvedValueOnce(onePage(item('a', false)));
    const { result } = await renderHook(() => useToSort());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    result.current.busyIds.add('a');

    await act(async () => result.current.open());

    expect(result.current.sheet).toBeUndefined();
  });

  it('hides a confirmed payment at once and brings it back when it is undone', async () => {
    page.mockResolvedValueOnce(onePage(item('a', false), item('b', false)));
    const { result } = await renderHook(() => useToSort());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => result.current.onConfirmed('a'));
    expect(ids(result.current.rows)).toEqual(['b']);

    await act(async () => result.current.onUndone('a'));
    expect(ids(result.current.rows)).toEqual(['a', 'b']);
  });

  it('closes the sheet and reloads the list, so a sorted payment is gone for good', async () => {
    page.mockResolvedValueOnce(onePage(item('a', false), item('b', false)));
    const { result } = await renderHook(() => useToSort());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => result.current.open());
    await act(async () => result.current.onConfirmed('a'));

    page.mockResolvedValueOnce(onePage(item('a', true), item('b', false)));
    await act(async () => result.current.close());

    expect(result.current.sheet?.isOpen).toBe(false);
    await waitFor(() => expect(page).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(ids(result.current.rows)).toEqual(['b']));
  });

  it('keeps a confirmed payment hidden when the reload read the list before the write', async () => {
    page.mockResolvedValueOnce(onePage(item('a', false)));
    const { result } = await renderHook(() => useToSort());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const stale = deferred<TransactionPageDto>();
    page.mockReturnValueOnce(stale.promise);
    await act(async () => result.current.reload());
    await act(async () => result.current.onConfirmed('a'));
    await act(async () => stale.resolve(onePage(item('a', false))));

    expect(ids(result.current.rows)).toEqual([]);
  });

  it('ignores a reload that finishes after a newer one', async () => {
    page.mockResolvedValueOnce(onePage(item('a', false)));
    const { result } = await renderHook(() => useToSort());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const stale = deferred<TransactionPageDto>();
    page.mockReturnValueOnce(stale.promise);
    page.mockResolvedValueOnce(onePage());
    await act(async () => {
      result.current.reload();
      result.current.reload();
    });
    await waitFor(() => expect(result.current.rows).toHaveLength(0));
    await act(async () => stale.resolve(onePage(item('a', false))));

    expect(result.current.rows).toHaveLength(0);
  });

  it('keeps the rows and flags them as possibly stale when a reload fails', async () => {
    page.mockResolvedValueOnce(onePage(item('a', false)));
    const { result } = await renderHook(() => useToSort());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    page.mockRejectedValueOnce(new Error('offline'));
    await act(async () => result.current.reload());

    await waitFor(() => expect(result.current.reloadFailed).toBe(true));
    expect(result.current.status).toBe('ready');
    expect(ids(result.current.rows)).toEqual(['a']);
  });

  it('writes through the shared queue', async () => {
    page.mockResolvedValueOnce(onePage(item('a', false)));
    setMapping.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useToSort());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => result.current.write('a', 'item-1'));

    expect(setMapping).toHaveBeenCalledWith('a', 'item-1');
  });

  it('settles a load that finishes after unmount without an error', async () => {
    const late = deferred<TransactionPageDto>();
    page.mockReturnValueOnce(late.promise);
    const { unmount } = await renderHook(() => useToSort());
    await unmount();

    await act(async () => late.resolve(onePage(item('a', false))));

    expect(page).toHaveBeenCalledTimes(1);
  });
});
