import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runInAction } from 'mobx';
import { apiClient } from '../../AppProviders.js';
import { DashboardStore } from './DashboardStore.js';
import type { PlanActualsView } from '../../domain/dashboard/PlanActualsView.js';

vi.mock('../../AppProviders.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Also mock SettingsStore to avoid localStorage reads
vi.mock('../settings/SettingsStore.js', () => ({
  settingsStore: {
    interestingCurrencies: [],
    baseCurrency: 'EUR',
  },
}));

const mockGet = vi.mocked(apiClient.get);

const mockActuals: PlanActualsView = {
  planId: 'plan-1',
  planName: 'May Budget',
  periodStart: '2025-05-01',
  periodEnd: '2025-05-31',
  currency: 'EUR',
  items: [
    {
      id: 'i1',
      category: 'Salary',
      direction: 'income',
      planned: 300000,
      actual: 280000,
      currency: 'EUR',
    },
    {
      id: 'i2',
      category: 'Rent',
      direction: 'expense',
      planned: 100000,
      actual: 95000,
      currency: 'EUR',
    },
  ],
  unplannedCount: 3,
  unplannedTotal: 15000,
  totalIncomePlanned: 300000,
  totalIncomeActual: 280000,
  totalExpensePlanned: 100000,
  totalExpenseActual: 95000,
  leftover: 185000,
};

describe('DashboardStore', () => {
  let store: DashboardStore;

  beforeEach(() => {
    store = new DashboardStore();
    vi.clearAllMocks();
  });

  describe('fetchActuals', () => {
    it('stores actuals on success', async () => {
      mockGet.mockResolvedValueOnce({ data: mockActuals });

      await store.fetchActuals('plan-1');

      expect(store.actuals).toEqual(mockActuals);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('sets displayCurrency to actuals.currency after fetch', async () => {
      mockGet.mockResolvedValueOnce({ data: mockActuals });

      await store.fetchActuals('plan-1');

      expect(store.displayCurrency).toBe('EUR');
    });

    it('sets error on failure', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'));

      await store.fetchActuals('plan-1');

      expect(store.error).toBe('Failed to load dashboard');
      expect(store.loading).toBe(false);
      expect(store.actuals).toBeNull();
    });

    it('sets loading=true during fetch', async () => {
      let resolvePromise!: () => void;
      mockGet.mockReturnValueOnce(
        new Promise<{ data: PlanActualsView }>((resolve) => {
          resolvePromise = () => resolve({ data: mockActuals });
        }),
      );

      const fetchPromise = store.fetchActuals('plan-1');
      expect(store.loading).toBe(true);

      resolvePromise();
      await fetchPromise;
      expect(store.loading).toBe(false);
    });
  });

  describe('fetchPlans', () => {
    it('stores plans on success', async () => {
      const plans = [
        {
          id: 'p1',
          name: 'May Plan',
          type: 'personal' as const,
          periodType: 'monthly' as const,
          periodStart: '2025-05-01',
          periodEnd: '2025-05-31',
          currency: 'EUR',
        },
      ];
      mockGet.mockResolvedValueOnce({ data: plans });

      await store.fetchPlans();

      expect(store.activePlans).toEqual(plans);
      expect(store.error).toBeNull();
    });

    it('sets error on failure', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'));

      await store.fetchPlans();

      expect(store.error).toBe('Failed to load plans');
    });
  });

  describe('cycleCurrency', () => {
    beforeEach(() => {
      runInAction(() => {
        store.actuals = mockActuals;
        store.displayCurrency = 'EUR';
      });
    });

    it('does NOT call apiClient', () => {
      store.cycleCurrency();
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('keeps displayCurrency when only one currency available', () => {
      store.cycleCurrency();
      // settingsStore.interestingCurrencies is [] (mocked), so only EUR
      expect(store.displayCurrency).toBe('EUR');
    });

    it('does nothing when actuals is null', () => {
      runInAction(() => {
        store.actuals = null;
        store.displayCurrency = '';
      });
      store.cycleCurrency();
      expect(store.displayCurrency).toBe('');
      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  describe('selectPlan', () => {
    it('sets selectedPlanId and calls fetchActuals', () => {
      mockGet.mockResolvedValueOnce({ data: mockActuals });

      store.selectPlan('plan-1');

      expect(store.selectedPlanId).toBe('plan-1');
      expect(mockGet).toHaveBeenCalledWith('/plans/plan-1/dashboard');
    });
  });

  describe('convertAmount', () => {
    it('returns same amount when displayCurrency matches fromCurrency', () => {
      runInAction(() => {
        store.displayCurrency = 'EUR';
      });
      expect(store.convertAmount(10000, 'EUR')).toBe(10000);
    });

    it('returns original amount when no FX rates in localStorage', () => {
      runInAction(() => {
        store.displayCurrency = 'USD';
      });
      // localStorage is empty in test env
      expect(store.convertAmount(10000, 'EUR')).toBe(10000);
    });
  });
});
