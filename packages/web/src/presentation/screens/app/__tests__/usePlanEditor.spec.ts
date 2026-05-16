import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// vi.hoisted ensures stableIntl is a single stable reference across renders
// so that useCallback([id, intl]) doesn't recreate on every render (infinite loop)
const stableIntl = vi.hoisted(() => ({
  formatMessage: ({ defaultMessage }: { defaultMessage: string }) => defaultMessage,
}));

vi.mock('../../../../AppProviders.js', () => ({
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

import { apiClient } from '../../../../AppProviders.js';
import { usePlanEditor } from '../usePlanEditor.js';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

const MOCK_PLAN = {
  id: 'plan-1',
  name: 'June Budget',
  period: 'monthly' as const,
  status: 'active' as const,
  baseCurrency: 'PLN',
  version: 1,
  updatedAt: '2024-06-01T00:00:00Z',
};

const MOCK_ITEMS = [
  {
    id: 'item-1',
    planId: 'plan-1',
    categoryId: 'cat-1',
    direction: 'expense' as const,
    amountMinor: 10000,
    currency: 'PLN',
    version: 1,
  },
];

describe('usePlanEditor (web)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads plan and items on mount', async () => {
    mockGet
      .mockResolvedValueOnce({ data: MOCK_PLAN, status: 200, headers: {} })
      .mockResolvedValueOnce({ data: MOCK_ITEMS, status: 200, headers: {} });

    const { result } = renderHook(() => usePlanEditor('plan-1'));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockGet).toHaveBeenCalledWith('/plans/plan-1');
    expect(result.current.plan?.id).toBe('plan-1');
    expect(result.current.items).toHaveLength(1);
  });

  it('handleAddItem appends new item to list', async () => {
    mockGet
      .mockResolvedValueOnce({ data: MOCK_PLAN, status: 200, headers: {} })
      .mockResolvedValueOnce({ data: MOCK_ITEMS, status: 200, headers: {} });

    const { result } = renderHook(() => usePlanEditor('plan-1'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const newItem = { ...MOCK_ITEMS[0]!, id: 'item-2' };
    mockPost.mockResolvedValue({ data: newItem, status: 201, headers: {} });

    await act(async () => {
      result.current.setDraftItem({
        draftId: 'draft-1',
        categoryId: 'cat-1',
        direction: 'expense',
        amountMinor: '5000',
        currency: 'PLN',
      });
    });

    await act(async () => {
      await result.current.handleAddItem();
    });

    expect(result.current.items).toHaveLength(2);
  });

  it('handleRemoveItem removes item from list optimistically', async () => {
    mockGet
      .mockResolvedValueOnce({ data: MOCK_PLAN, status: 200, headers: {} })
      .mockResolvedValueOnce({ data: MOCK_ITEMS, status: 200, headers: {} });

    const { result } = renderHook(() => usePlanEditor('plan-1'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    mockDelete.mockResolvedValue({ data: {}, status: 204, headers: {} });

    await act(async () => {
      await result.current.handleRemoveItem('item-1');
    });

    expect(result.current.items).toHaveLength(0);
  });

  it('handleSave calls PUT /plans/:id with plan data', async () => {
    mockGet
      .mockResolvedValueOnce({ data: MOCK_PLAN, status: 200, headers: {} })
      .mockResolvedValueOnce({ data: MOCK_ITEMS, status: 200, headers: {} });

    const { result } = renderHook(() => usePlanEditor('plan-1'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    mockPut.mockResolvedValue({
      data: { ...MOCK_PLAN, name: 'Updated' },
      status: 200,
      headers: {},
    });

    await act(async () => {
      await result.current.handleSave();
    });

    expect(mockPut).toHaveBeenCalledWith(
      '/plans/plan-1',
      expect.objectContaining({ name: 'June Budget' }),
    );
  });

  it('shows error when plan fails to load', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePlanEditor('plan-1'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.error).toBeTruthy();
  });

  it('does not fetch when id is undefined', async () => {
    renderHook(() => usePlanEditor(undefined));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockGet).not.toHaveBeenCalled();
  });
});
