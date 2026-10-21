import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runInAction } from 'mobx';
import { apiClient } from '../../AppProviders.js';
import { DashboardStore } from './DashboardStore.js';
import type { PlanActualsView } from '../../domain/dashboard/PlanActualsView.js';
import type { PlanDashboardResponseDto } from '../../infrastructure/api/PlanDashboardMapper.js';

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

function money(amountMinor: string) {
  return { amountMinor, currency: 'EUR' };
}

/** What GET /plans/plan-1/dashboard answers (string minor units, nested lines). */
const mockDashboard: PlanDashboardResponseDto = {
  planId: 'plan-1',
  period: { start: '2025-05-01', end: '2025-05-31' },
  baseCurrency: 'EUR',
  incomeLines: [
    {
      plannedItemId: 'i1',
      categoryId: 'cat-salary',
      direction: 'income',
      planned: money('300000'),
      actual: money('280000'),
      remaining: money('20000'),
      progressBand: 'ok',
    },
  ],
  expenseLines: [
    {
      plannedItemId: 'i2',
      categoryId: 'cat-rent',
      direction: 'expense',
      planned: money('100000'),
      actual: money('95000'),
      remaining: money('5000'),
      progressBand: 'warning',
    },
  ],
  totalPlannedIncome: money('300000'),
  totalActualIncome: money('280000'),
  totalPlannedExpenses: money('100000'),
  totalActualExpenses: money('95000'),
  unplannedExpenses: money('15000'),
  unplannedIncome: money('0'),
  net: money('185000'),
  asOf: '2025-05-20',
};

const mockCategories = [
  { id: 'cat-salary', name: 'Salary' },
  { id: 'cat-rent', name: 'Rent' },
];

function mockDashboardResponses(): void {
  mockGet.mockImplementation((url: string) =>
    Promise.resolve({
      status: 200,
      data: url === '/categories?includeArchived=true' ? mockCategories : mockDashboard,
      headers: {},
    }),
  );
}

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
  unplannedCount: null,
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
    vi.resetAllMocks();
  });

  describe('fetchActuals', () => {
    it('maps the dashboard response with plan and category names', async () => {
      mockDashboardResponses();
      runInAction(() => {
        store.activePlans = [
          {
            id: 'plan-1',
            name: 'May Budget',
            type: 'personal',
            ownerUserId: 'u1',
            periodKind: 'monthly',
            period: { start: '2025-05-01', end: '2025-05-31' },
            baseCurrency: 'EUR',
            archivedAt: null,
            createdAt: '2025-05-01T00:00:00.000Z',
            updatedAt: '2025-05-01T00:00:00.000Z',
          },
        ];
      });

      await store.fetchActuals('plan-1');

      expect(store.actuals).toEqual(mockActuals);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('still renders the lines when categories cannot be loaded', async () => {
      mockGet.mockImplementation((url: string) =>
        url === '/categories?includeArchived=true'
          ? Promise.reject(new Error('404'))
          : Promise.resolve({ status: 200, data: mockDashboard, headers: {} }),
      );

      await store.fetchActuals('plan-1');

      expect(store.actuals?.items.map((i) => i.category)).toEqual(['', '']);
      expect(store.actuals?.planName).toBe('');
    });

    it('sets displayCurrency to actuals.currency after fetch', async () => {
      mockDashboardResponses();

      await store.fetchActuals('plan-1');

      expect(store.displayCurrency).toBe('EUR');
    });

    it('sets error on failure', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      await store.fetchActuals('plan-1');

      expect(store.error).toBe('Failed to load dashboard');
      expect(store.loading).toBe(false);
      expect(store.actuals).toBeNull();
    });

    it('sets loading=true during fetch', async () => {
      let resolvePromise!: () => void;
      const pending = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      mockGet.mockImplementation(async (url: string) => {
        await pending;

        return {
          status: 200,
          data: url === '/categories?includeArchived=true' ? [] : mockDashboard,
          headers: {},
        };
      });

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
          periodKind: 'monthly' as const,
          period: { start: '2025-05-01', end: '2025-05-31' },
          baseCurrency: 'EUR',
        },
      ];
      mockGet.mockResolvedValueOnce({ status: 200, data: plans, headers: {} });

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
      mockDashboardResponses();

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
