import type {
  CategoryDto,
  PlanDashboardResponseDto,
  PlanDto,
  PlannedItemDto,
  UnplannedTransactionDto,
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

/** One expense or income line of the D7 sample month: one planned item per category. */
function d7Line(
  categoryId: string,
  direction: 'income' | 'expense',
  plannedMinor: bigint,
  actualMinor: bigint,
  progressBand: 'ok' | 'warning' | 'over',
): PlanDashboardResponseDto['expenseLines'][number] {
  return {
    plannedItemId: `d7-item-${categoryId}`,
    categoryId,
    direction,
    planned: pln(String(plannedMinor)),
    actual: pln(String(actualMinor)),
    remaining: pln(String(plannedMinor - actualMinor)),
    progressBand,
  };
}

/** D7 spec sample data (22 Oct 2026, day 22 of 31): planned 11 800, spent 7 030, left 4 770. */
export const D7_PLAN: PlanDto = {
  ...PLAN,
  id: 'plan-d7',
  name: 'October',
};

export const D7_DASHBOARD: PlanDashboardResponseDto = {
  planId: 'plan-d7',
  period: { start: '2026-10-01', end: '2026-10-31' },
  baseCurrency: 'PLN',
  incomeLines: [
    d7Line('d7-salary', 'income', 1300000n, 1300000n, 'over'),
    d7Line('d7-freelance', 'income', 120000n, 0n, 'ok'),
  ],
  expenseLines: [
    d7Line('d7-rent', 'expense', 340000n, 340000n, 'over'),
    d7Line('d7-eating-out', 'expense', 50000n, 56250n, 'over'),
    d7Line('d7-groceries', 'expense', 220000n, 114864n, 'ok'),
    d7Line('d7-bills', 'expense', 100000n, 54800n, 'ok'),
    d7Line('d7-transport', 'expense', 70000n, 31239n, 'ok'),
    d7Line('d7-health', 'expense', 40000n, 8990n, 'ok'),
    d7Line('d7-subscriptions', 'expense', 30000n, 11197n, 'ok'),
    d7Line('d7-home', 'expense', 90000n, 4000n, 'ok'),
    d7Line('d7-anna', 'expense', 120000n, 21000n, 'ok'),
    d7Line('d7-marek', 'expense', 120000n, 18160n, 'ok'),
  ],
  totalPlannedIncome: pln('1420000'),
  totalActualIncome: pln('1300000'),
  totalPlannedExpenses: pln('1180000'),
  totalActualExpenses: pln('660500'),
  unplannedExpenses: pln('42500'),
  unplannedIncome: pln('0'),
  net: pln('597000'),
  asOf: '2026-10-22',
};

export const D7_CATEGORIES: CategoryDto[] = [
  category('d7-salary', 'Salaries', 'income'),
  category('d7-freelance', 'Freelance', 'income'),
  category('d7-rent', 'Rent', 'expense'),
  category('d7-eating-out', 'Eating out', 'expense'),
  category('d7-groceries', 'Groceries', 'expense'),
  category('d7-bills', 'Bills & insurance', 'expense'),
  category('d7-transport', 'Transport', 'expense'),
  category('d7-health', 'Health', 'expense'),
  category('d7-subscriptions', 'Subscriptions', 'expense'),
  category('d7-home', 'Home', 'expense'),
  category('d7-anna', 'Anna · personal', 'expense'),
  category('d7-marek', 'Marek · personal', 'expense'),
];

function d7Unplanned(
  id: string,
  description: string,
  amountMinor: string,
  occurredOn: string,
): UnplannedTransactionDto {
  return {
    id,
    description,
    amountMinor,
    currency: 'PLN',
    occurredOn,
    accountId: 'acc-1',
    source: 'bank',
  };
}

export const D7_UNPLANNED_PAGE: UnplannedTransactionPageDto = {
  items: [
    d7Unplanned('d7-tx-decathlon', 'Decathlon', '-22000', '2026-10-20'),
    d7Unplanned('d7-tx-allegro', 'Allegro', '-12900', '2026-10-14'),
    d7Unplanned('d7-tx-empik', 'Empik', '-7600', '2026-10-09'),
  ],
  nextCursor: null,
};
