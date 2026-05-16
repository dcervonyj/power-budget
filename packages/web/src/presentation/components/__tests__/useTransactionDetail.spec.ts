import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Stable intl reference to prevent infinite re-render via useCallback deps
const stableIntl = vi.hoisted(() => ({
  formatMessage: ({ defaultMessage }: { defaultMessage: string }) => defaultMessage,
}));

vi.mock('../../../AppProviders.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
    request: vi.fn(),
  },
}));

vi.mock('react-intl', () => ({
  useIntl: () => stableIntl,
}));

import { apiClient } from '../../../AppProviders.js';
import { useTransactionDetail } from '../useTransactionDetail.js';
import type { Transaction } from '../useTransactionDetail.js';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockDelete = vi.mocked(apiClient.delete);
const mockRequest = vi.mocked(apiClient.request);

const MOCK_TX: Transaction = {
  id: 'tx-1',
  accountId: 'acc-1',
  occurredOn: '2024-06-01',
  amountMinor: -5000,
  currency: 'PLN',
  description: 'Coffee',
  merchant: 'Starbucks',
  source: 'gocardless',
  isTransfer: false,
  ignored: false,
  notes: null,
  mapping: null,
};

describe('useTransactionDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches transaction on open', async () => {
    mockGet.mockResolvedValueOnce({ data: MOCK_TX, status: 200, headers: {} });

    const { result } = renderHook(() => useTransactionDetail('tx-1', true));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockGet).toHaveBeenCalledWith('/transactions/tx-1');
    expect(result.current.transaction?.id).toBe('tx-1');
    expect(result.current.loading).toBe(false);
  });

  it('sets fetchError when transaction fetch fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useTransactionDetail('tx-1', true));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.fetchError).toBeTruthy();
    expect(result.current.transaction).toBeNull();
  });

  it('does not fetch when isOpen is false', async () => {
    renderHook(() => useTransactionDetail('tx-1', false));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockGet).not.toHaveBeenCalled();
  });

  it('handleToggleTransfer posts to /transfer when not transfer', async () => {
    mockGet.mockResolvedValueOnce({ data: MOCK_TX, status: 200, headers: {} });
    mockPost.mockResolvedValueOnce({ data: {}, status: 200, headers: {} });

    const onUpdated = vi.fn();
    const { result } = renderHook(() => useTransactionDetail('tx-1', true, onUpdated));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      await result.current.handleToggleTransfer();
    });

    expect(mockPost).toHaveBeenCalledWith('/transactions/tx-1/transfer', {});
    expect(result.current.isTransfer).toBe(true);
    expect(onUpdated).toHaveBeenCalled();
  });

  it('handleToggleTransfer deletes /transfer when already transfer', async () => {
    const txAsTransfer = { ...MOCK_TX, isTransfer: true };
    mockGet.mockResolvedValueOnce({ data: txAsTransfer, status: 200, headers: {} });
    mockDelete.mockResolvedValueOnce({ data: {}, status: 204, headers: {} });

    const { result } = renderHook(() => useTransactionDetail('tx-1', true));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      await result.current.handleToggleTransfer();
    });

    expect(mockDelete).toHaveBeenCalledWith('/transactions/tx-1/transfer');
    expect(result.current.isTransfer).toBe(false);
  });

  it('handleMap sends PATCH with plannedItemId', async () => {
    mockGet.mockResolvedValueOnce({ data: MOCK_TX, status: 200, headers: {} });
    mockRequest.mockResolvedValueOnce({ data: {}, status: 200, headers: {} });

    const { result } = renderHook(() => useTransactionDetail('tx-1', true));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      await result.current.handleMap(null);
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'PATCH', url: '/transactions/tx-1/mapping' }),
    );
    expect(result.current.mapping).toBeNull();
  });

  it('handleToggleIgnored calls PATCH with ignored flag', async () => {
    mockGet.mockResolvedValueOnce({ data: MOCK_TX, status: 200, headers: {} });
    mockRequest.mockResolvedValueOnce({ data: {}, status: 200, headers: {} });

    const { result } = renderHook(() => useTransactionDetail('tx-1', true));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      await result.current.handleToggleIgnored();
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'PATCH', body: { ignored: true } }),
    );
    expect(result.current.ignored).toBe(true);
  });

  it('rolls back isTransfer on error', async () => {
    mockGet.mockResolvedValueOnce({ data: MOCK_TX, status: 200, headers: {} });
    mockPost.mockRejectedValueOnce(new Error('Server error'));

    const { result } = renderHook(() => useTransactionDetail('tx-1', true));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      await result.current.handleToggleTransfer();
    });

    expect(result.current.isTransfer).toBe(false);
  });

  it('handleShowPicker sets showPicker to true and loads plans', async () => {
    mockGet
      .mockResolvedValueOnce({ data: MOCK_TX, status: 200, headers: {} })
      .mockResolvedValueOnce({
        data: [{ id: 'plan-1', name: 'Budget', status: 'active' }],
        status: 200,
        headers: {},
      })
      .mockResolvedValueOnce({ data: [], status: 200, headers: {} });

    const { result } = renderHook(() => useTransactionDetail('tx-1', true));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      result.current.handleShowPicker();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.showPicker).toBe(true);
    expect(result.current.plans).toHaveLength(1);
  });
});
