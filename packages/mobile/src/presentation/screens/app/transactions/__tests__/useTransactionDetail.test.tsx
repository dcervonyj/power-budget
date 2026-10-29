import { createMock } from '@golevelup/ts-jest';
import type { PlanDto, CategoryDto, PlannedItemDto } from '@power-budget/shared-app/contract';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { TransactionDetailDto } from '@power-budget/shared-app/contract';
import { categoriesApi, plansApi } from '../../../../../infrastructure/index.js';
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
  return createMock<TransactionDetailDto>({
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
  });
}

function deferred(): {
  promise: Promise<undefined>;
  resolve: () => void;
  reject: () => void;
} {
  const holder: { resolve: () => void; reject: () => void } = {
    resolve: () => undefined,
    reject: () => undefined,
  };
  const promise = new Promise<undefined>((resolve, reject) => {
    holder.resolve = () => resolve(undefined);
    holder.reject = () => reject(new Error('failed'));
  });

  return { promise, resolve: holder.resolve, reject: holder.reject };
}

beforeEach(() => {
  detail.mockReset();
  setMapping.mockReset();
});

describe('useTransactionDetail category changes', () => {
  it('waits for a pending write before reading the mapping', async () => {
    const pending = deferred();
    setMapping.mockReturnValueOnce(pending.promise);
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
    setMapping.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
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
    jest.mocked(plansApi.listItems).mockResolvedValue([]);
    jest.mocked(categoriesApi.list).mockResolvedValue([]);
  });

  it('saves the note as entered, without trimming', async () => {
    detail.mockResolvedValue(detailDto());
    setNotes.mockResolvedValue(undefined);
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

    jest.mocked(plansApi.list).mockResolvedValue([createMock<PlanDto>({ id: 'plan-1' })]);
    jest
      .mocked(plansApi.listItems)
      .mockResolvedValue([createMock<PlannedItemDto>({ id: 'item-9', categoryId: 'cat-1' })]);
    jest
      .mocked(categoriesApi.list)
      .mockResolvedValue([createMock<CategoryDto>({ id: 'cat-1', name: 'Fuel' })]);
    await act(async () => result.current.retryCategory());

    await waitFor(() => expect(result.current.categoryFailed).toBe(false));
    expect(result.current.categoryName).toBe('Fuel');
  });

  it('shows the same error when the lookup succeeds but the mapped item is not in the result', async () => {
    detail.mockResolvedValue(detailDto(true));
    jest.mocked(plansApi.list).mockResolvedValue([]);
    const { result } = await renderHook(() => useTransactionDetail('t1'));

    await waitFor(() => expect(result.current.categoryFailed).toBe(true));
    expect(result.current.categoryName).toBeUndefined();
  });
});

describe('useTransactionDetail transfer switch', () => {
  it('moves at once and lets a second tap reverse a pending change, last intent last', async () => {
    detail.mockResolvedValue(detailDto());
    const first = deferred();
    jest.mocked(transactionsGateway.setTransfer).mockReset();
    jest
      .mocked(transactionsGateway.setTransfer)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined);
    const { result } = await renderHook(() => useTransactionDetail('t1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => result.current.toggleTransfer(true));
    expect(result.current.transaction?.isTransfer).toBe(true);
    await act(async () => result.current.toggleTransfer(false));
    expect(result.current.transaction?.isTransfer).toBe(false);

    await act(async () => first.resolve());
    await waitFor(() => expect(transactionsGateway.setTransfer).toHaveBeenCalledTimes(2));
    expect(transactionsGateway.setTransfer).toHaveBeenNthCalledWith(1, 't1', true);
    expect(transactionsGateway.setTransfer).toHaveBeenNthCalledWith(2, 't1', false);
    expect(result.current.transaction?.isTransfer).toBe(false);
  });

  it('re-reads the server state when the write fails', async () => {
    detail.mockResolvedValue(detailDto());
    jest.mocked(transactionsGateway.setTransfer).mockReset();
    jest.mocked(transactionsGateway.setTransfer).mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useTransactionDetail('t1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => result.current.toggleTransfer(true));

    await waitFor(() => expect(result.current.failure).toBe('save'));
    await waitFor(() => expect(result.current.transaction?.isTransfer).toBe(false));
    expect(detail).toHaveBeenCalledTimes(2);
  });

  it('ignores the failure of an older tap once a newer tap happened', async () => {
    detail.mockResolvedValue(detailDto());
    const first = deferred();
    jest.mocked(transactionsGateway.setTransfer).mockReset();
    jest
      .mocked(transactionsGateway.setTransfer)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined);
    const { result } = await renderHook(() => useTransactionDetail('t1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => result.current.toggleTransfer(true));
    await act(async () => result.current.toggleTransfer(false));
    await act(async () => first.reject());
    await waitFor(() => expect(transactionsGateway.setTransfer).toHaveBeenCalledTimes(2));

    expect(result.current.transaction?.isTransfer).toBe(false);
    expect(result.current.failure).toBeNull();
    expect(result.current.transferUnresolved).toBe(false);
    expect(detail).toHaveBeenCalledTimes(1);
  });

  it('does not let a re-read that started before a newer tap overwrite it', async () => {
    detail.mockResolvedValueOnce(detailDto());
    jest.mocked(transactionsGateway.setTransfer).mockReset();
    jest
      .mocked(transactionsGateway.setTransfer)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    const { result } = await renderHook(() => useTransactionDetail('t1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const staleRead = deferred();
    detail.mockImplementationOnce(() => staleRead.promise.then(() => detailDto()));
    await act(async () => result.current.toggleTransfer(true));
    await waitFor(() => expect(detail).toHaveBeenCalledTimes(2));
    await act(async () => result.current.toggleTransfer(true));
    await act(async () => staleRead.resolve());

    expect(result.current.transaction?.isTransfer).toBe(true);
  });

  it('shows an unresolved state with a retry when the write and the re-read both fail', async () => {
    detail.mockResolvedValueOnce(detailDto());
    jest.mocked(transactionsGateway.setTransfer).mockReset();
    jest.mocked(transactionsGateway.setTransfer).mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useTransactionDetail('t1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    detail.mockRejectedValueOnce(new Error('offline'));
    await act(async () => result.current.toggleTransfer(true));
    await waitFor(() => expect(result.current.transferUnresolved).toBe(true));

    detail.mockResolvedValueOnce(detailDto());
    await act(async () => result.current.retryTransfer());

    await waitFor(() => expect(result.current.transferUnresolved).toBe(false));
    expect(result.current.transaction?.isTransfer).toBe(false);
  });
});
