import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  HouseholdDashboardCategoryDto,
  HouseholdDashboardResponseDto,
} from '@power-budget/shared-app/contract';
import { apiClient } from '../../AppProviders.js';
import { HouseholdCategoryStore } from './HouseholdCategoryStore.js';

vi.mock('../../AppProviders.js', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiClient.get);

const groceries: HouseholdDashboardCategoryDto = {
  categoryId: 'cat-1',
  categoryName: 'Groceries',
  privacyLevel: 'total_only',
  totalAmountMinor: '50000',
  currency: 'EUR',
  transactionCount: 0,
};

const transport: HouseholdDashboardCategoryDto = {
  categoryId: 'cat-2',
  categoryName: 'Transport',
  privacyLevel: 'total_with_counts',
  totalAmountMinor: '12000',
  currency: 'EUR',
  transactionCount: 7,
};

function dashboard(categories: HouseholdDashboardCategoryDto[]): {
  status: number;
  data: HouseholdDashboardResponseDto;
  headers: Record<string, string>;
} {
  return { status: 200, data: { planId: 'plan-1', categories }, headers: {} };
}

describe('HouseholdCategoryStore', () => {
  let store: HouseholdCategoryStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new HouseholdCategoryStore();
  });

  it('starts empty', () => {
    expect(store.category).toBeNull();
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('reads the household dashboard for the plan and picks the category', async () => {
    mockGet.mockResolvedValueOnce(dashboard([groceries, transport]));

    await store.fetchCategory('hh-1', 'plan-1', 'cat-2');

    expect(mockGet).toHaveBeenCalledWith('/households/hh-1/dashboard?planId=plan-1');
    expect(store.category).toEqual(transport);
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
  });

  it('reports not_found when the plan has no line for the category', async () => {
    mockGet.mockResolvedValueOnce(dashboard([groceries]));

    await store.fetchCategory('hh-1', 'plan-1', 'cat-9');

    expect(store.category).toBeNull();
    expect(store.error).toBe('not_found');
  });

  it('reports failed when the request fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));

    await store.fetchCategory('hh-1', 'plan-1', 'cat-1');

    expect(store.category).toBeNull();
    expect(store.error).toBe('failed');
    expect(store.loading).toBe(false);
  });

  it('reports fx_unavailable on a 503 fx_rate_unavailable', async () => {
    mockGet.mockRejectedValueOnce(
      Object.assign(new Error('HTTP 503'), {
        response: { status: 503, data: { statusCode: 503, code: 'fx_rate_unavailable' } },
      }),
    );

    await store.fetchCategory('hh-1', 'plan-1', 'cat-1');

    expect(store.error).toBe('fx_unavailable');
    expect(store.category).toBeNull();
  });

  it('is loading while the request is in flight', async () => {
    const resolvers: Array<(value: ReturnType<typeof dashboard>) => void> = [];
    mockGet.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvers.push(resolve);
      }),
    );

    const pending = store.fetchCategory('hh-1', 'plan-1', 'cat-1');
    expect(store.loading).toBe(true);
    resolvers[0]?.(dashboard([groceries]));
    await pending;

    expect(store.loading).toBe(false);
    expect(store.category).toEqual(groceries);
  });
});
