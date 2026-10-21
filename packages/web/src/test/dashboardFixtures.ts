import type {
  CategoryDto,
  PlanDashboardResponseDto,
  PlanDto,
  PlannedItemDto,
  UnplannedTransactionPageDto,
} from '@power-budget/shared-app/contract';

export function pln(amountMinor: string): { amountMinor: string; currency: string } {
  return { amountMinor, currency: 'PLN' };
}

export const PLAN: PlanDto = {
  id: 'plan-1',
  name: 'October',
  type: 'household',
  ownerUserId: 'user-1',
  periodKind: 'monthly',
  period: { start: '2026-10-01', end: '2026-10-31' },
  baseCurrency: 'PLN',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

/** Salary (income), Groceries with two items (one planned in EUR) and Rent (over). */
export const DASHBOARD: PlanDashboardResponseDto = {
  planId: 'plan-1',
  period: { start: '2026-10-01', end: '2026-10-31' },
  baseCurrency: 'PLN',
  incomeLines: [
    {
      plannedItemId: 'item-salary',
      categoryId: 'cat-salary',
      direction: 'income',
      planned: pln('1000000'),
      actual: pln('1000000'),
      remaining: pln('0'),
      progressBand: 'over',
    },
  ],
  expenseLines: [
    {
      plannedItemId: 'item-food',
      categoryId: 'cat-groceries',
      direction: 'expense',
      planned: pln('150000'),
      actual: pln('100000'),
      remaining: pln('50000'),
      progressBand: 'ok',
    },
    {
      plannedItemId: 'item-food-eur',
      categoryId: 'cat-groceries',
      direction: 'expense',
      planned: pln('43000'),
      actual: pln('40000'),
      remaining: pln('3000'),
      progressBand: 'warning',
    },
    {
      plannedItemId: 'item-rent',
      categoryId: 'cat-rent',
      direction: 'expense',
      planned: pln('300000'),
      actual: pln('320000'),
      remaining: pln('-20000'),
      progressBand: 'over',
    },
  ],
  totalPlannedIncome: pln('1000000'),
  totalActualIncome: pln('1000000'),
  totalPlannedExpenses: pln('493000'),
  totalActualExpenses: pln('460000'),
  unplannedExpenses: pln('12550'),
  unplannedIncome: pln('0'),
  net: pln('527450'),
  asOf: '2026-10-21',
};

function item(
  id: string,
  categoryId: string,
  amountMinor: string,
  currency: string,
): PlannedItemDto {
  return {
    id,
    planId: 'plan-1',
    categoryId,
    direction: categoryId === 'cat-salary' ? 'income' : 'expense',
    amount: { amountMinor, currency },
    note: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

export const RENT_ITEM: PlannedItemDto = item('item-rent', 'cat-rent', '300000', 'PLN');

export const ITEMS: PlannedItemDto[] = [
  item('item-salary', 'cat-salary', '1000000', 'PLN'),
  { ...item('item-food', 'cat-groceries', '150000', 'PLN'), note: 'Weekly shop' },
  item('item-food-eur', 'cat-groceries', '10000', 'EUR'),
  RENT_ITEM,
];

function category(id: string, name: string, kind: 'income' | 'expense'): CategoryDto {
  return {
    id,
    name,
    kind,
    icon: 'tag',
    color: '#6B7280',
    isSystem: false,
    seedKey: null,
    privacy: 'total_only',
    archived: false,
    archivedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
  };
}

export const CATEGORIES: CategoryDto[] = [
  category('cat-salary', 'Salary', 'income'),
  category('cat-groceries', 'Groceries', 'expense'),
  category('cat-rent', 'Rent', 'expense'),
];

export const UNPLANNED_PAGE: UnplannedTransactionPageDto = {
  items: [
    {
      id: 'tx-1',
      description: 'Allegro',
      amountMinor: '-12550',
      currency: 'PLN',
      occurredOn: '2026-10-12',
      accountId: 'acc-1',
      source: 'bank',
    },
  ],
  nextCursor: 'cursor-2',
};

export const UNPLANNED_LAST_PAGE: UnplannedTransactionPageDto = {
  items: [
    {
      id: 'tx-2',
      description: 'Wise card',
      amountMinor: '-1240',
      currency: 'EUR',
      occurredOn: '2026-10-14',
      accountId: 'acc-2',
      source: 'bank',
    },
  ],
  nextCursor: null,
};

export const EMPTY_PAGE: UnplannedTransactionPageDto = { items: [], nextCursor: null };

/** An axios-like error with the API error body (CLN-002). */
export function apiError(status: number, code = ''): Error & { response: unknown } {
  return Object.assign(new Error(`HTTP ${String(status)}`), {
    response: { status, data: { statusCode: status, code } },
  });
}
