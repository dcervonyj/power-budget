import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../../AppProviders.js';
import { HouseholdCategoryStore } from './HouseholdCategoryStore.js';
import type { CategoryAggregate } from '../../domain/household/CategoryAggregate.js';

vi.mock('../../AppProviders.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiClient.get);

const mockAggregateTotal: CategoryAggregate = {
  categoryId: 'cat-1',
  categoryName: 'Groceries',
  privacyLevel: 'total',
  totalMinor: 50000,
  currency: 'EUR',
};

const mockAggregateTotalAndCount: CategoryAggregate = {
  categoryId: 'cat-2',
  categoryName: 'Transport',
  privacyLevel: 'total_and_count',
  totalMinor: 12000,
  currency: 'EUR',
  transactionCount: 7,
};

const mockAggregateFullDetail: CategoryAggregate = {
  categoryId: 'cat-3',
  categoryName: 'Dining',
  privacyLevel: 'full_detail',
  totalMinor: 30000,
  currency: 'EUR',
  transactionCount: 3,
  transactions: [
    {
      id: 'tx-1',
      date: '2025-05-01',
      description: 'Restaurant A',
      amountMinor: 10000,
      currency: 'EUR',
    },
    {
      id: 'tx-2',
      date: '2025-05-08',
      description: 'Restaurant B',
      amountMinor: 12000,
      currency: 'EUR',
    },
    {
      id: 'tx-3',
      date: '2025-05-15',
      description: 'Cafe C',
      amountMinor: 8000,
      currency: 'EUR',
    },
  ],
};

describe('HouseholdCategoryStore', () => {
  let store: HouseholdCategoryStore;

  beforeEach(() => {
    store = new HouseholdCategoryStore();
    vi.clearAllMocks();
  });

  describe('fetchAggregate', () => {
    it('stores aggregate on success', async () => {
      mockGet.mockResolvedValueOnce({ status: 200, data: mockAggregateTotal, headers: {} });

      await store.fetchAggregate('cat-1');

      expect(store.aggregate).toEqual(mockAggregateTotal);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('calls the correct endpoint', async () => {
      mockGet.mockResolvedValueOnce({ status: 200, data: mockAggregateTotal, headers: {} });

      await store.fetchAggregate('cat-1');

      expect(mockGet).toHaveBeenCalledWith('/categories/cat-1/aggregate');
    });

    it('sets loading=true during fetch', async () => {
      let resolvePromise!: () => void;
      mockGet.mockReturnValueOnce(
        new Promise<{ status: number; data: CategoryAggregate; headers: Record<string, string> }>(
          (resolve) => {
            resolvePromise = () => resolve({ status: 200, data: mockAggregateTotal, headers: {} });
          },
        ),
      );

      const fetchPromise = store.fetchAggregate('cat-1');
      expect(store.loading).toBe(true);

      resolvePromise();
      await fetchPromise;
      expect(store.loading).toBe(false);
    });

    it('sets error on failure', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'));

      await store.fetchAggregate('cat-1');

      expect(store.error).toBe('Failed to load category details');
      expect(store.loading).toBe(false);
      expect(store.aggregate).toBeNull();
    });

    it('stores total_and_count aggregate with transactionCount', async () => {
      mockGet.mockResolvedValueOnce({
        status: 200,
        data: mockAggregateTotalAndCount,
        headers: {},
      });

      await store.fetchAggregate('cat-2');

      expect(store.aggregate?.privacyLevel).toBe('total_and_count');
      expect(store.aggregate?.transactionCount).toBe(7);
    });

    it('full_detail response never contains accountId in transactions', async () => {
      mockGet.mockResolvedValueOnce({
        status: 200,
        data: mockAggregateFullDetail,
        headers: {},
      });

      await store.fetchAggregate('cat-3');

      expect(store.aggregate?.privacyLevel).toBe('full_detail');
      const transactions = store.aggregate?.transactions ?? [];
      expect(transactions.length).toBeGreaterThan(0);
      for (const tx of transactions) {
        expect(Object.keys(tx)).not.toContain('accountId');
      }
    });
  });

  describe('initial state', () => {
    it('starts with aggregate=null, loading=false, error=null', () => {
      expect(store.aggregate).toBeNull();
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });
  });
});
