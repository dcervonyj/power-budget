import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { TransactionDetailDto } from '@power-budget/shared-app/contract';
import { plansApi } from '../../../../../infrastructure/index.js';
import { transactionsGateway, writeQueue } from '../transactionsGateway.js';
import { useTransactionDetail } from '../useTransactionDetail.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../transactionsGateway.js', () => {
  const { SerialQueue } = jest.requireActual(
    '../../../../../infrastructure/transactions/SerialQueue.js',
  );

  return {
    transactionsGateway: {
      detail: jest.fn(),
      setMapping: jest.fn(),
      setTransfer: jest.fn(),
      setNotes: jest.fn(),
    },
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

const detail = jest.mocked(transactionsGateway.detail);
const setMapping = jest.mocked(transactionsGateway.setMapping);
const setNotes = jest.mocked(transactionsGateway.setNotes);

function detailDto(mapped = false): TransactionDetailDto {
  const dto = {
    transaction: {
      id: 't1',
      occurredOn: '2026-10-27',
      description: 'Shop',
      merchant: null,
      amount: { amountMinor: '-1000', currency: 'PLN' },
      source: 'bank_sync',
      notes: null,
      ignored: false,
      suggestedPlannedItemId: null,
    },
    transfer: null,
    mapping: mapped ? { plannedItemId: 'item-9' } : null,
  };

  return dto as unknown as TransactionDetailDto;
}

function deferred(): { promise: Promise<undefined>; resolve: () => void } {
  const holder: { resolve: () => void } = { resolve: () => undefined };
  const promise = new Promise<undefined>((resolve) => {
    holder.resolve = () => resolve(undefined);
  });

  return { promise, resolve: holder.resolve };
}

beforeEach(() => {
  detail.mockReset();
  setMapping.mockReset();
});

describe('useTransactionDetail category changes', () => {
  it('waits for a pending write before reading the mapping', async () => {
    const pending = deferred();
    setMapping.mockReturnValueOnce(pending.promise as never);
    void writeQueue.run(() => transactionsGateway.setMapping('t1', 'item-1'));
    detail.mockResolvedValue(detailDto());
    const { result } = await renderHook(() => useTransactionDetail('t1'));

    expect(detail).not.toHaveBeenCalled();
    await act(async () => pending.resolve());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(detail).toHaveBeenCalledTimes(1);
  });

  it('sends rapid changes in order and ends on the last selection', async () => {
    detail.mockResolvedValue(detailDto());
    const first = deferred();
    const second = deferred();
    setMapping
      .mockReturnValueOnce(first.promise as never)
      .mockReturnValueOnce(second.promise as never);
    const { result } = await renderHook(() => useTransactionDetail('t1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      result.current.pickItem('item-1');
      result.current.pickItem('item-2');
    });
    expect(setMapping).toHaveBeenCalledTimes(1);
    expect(setMapping).toHaveBeenLastCalledWith('t1', 'item-1');

    await act(async () => first.resolve());
    expect(setMapping).toHaveBeenCalledTimes(2);
    expect(setMapping).toHaveBeenLastCalledWith('t1', 'item-2');
    await act(async () => second.resolve());

    await waitFor(() => expect(result.current.transaction?.mapping?.plannedItemId).toBe('item-2'));
  });
});

describe('useTransactionDetail notes and category lookup', () => {
  afterEach(() => {
    jest.mocked(plansApi.list).mockResolvedValue([]);
  });

  it('saves the note as entered, without trimming', async () => {
    detail.mockResolvedValue(detailDto());
    setNotes.mockResolvedValue(undefined as never);
    const { result } = await renderHook(() => useTransactionDetail('t1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => result.current.setNotes('  line one\n  indented  '));
    await act(async () => result.current.saveNotes());

    expect(setNotes).toHaveBeenCalledWith('t1', '  line one\n  indented  ');
  });

  it('shows a retryable error when the category of the mapping cannot be looked up', async () => {
    detail.mockResolvedValue(detailDto(true));
    jest.mocked(plansApi.list).mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useTransactionDetail('t1'));
    await waitFor(() => expect(result.current.categoryFailed).toBe(true));

    jest.mocked(plansApi.list).mockResolvedValue([]);
    await act(async () => result.current.retryCategory());

    await waitFor(() => expect(result.current.categoryFailed).toBe(false));
  });
});
