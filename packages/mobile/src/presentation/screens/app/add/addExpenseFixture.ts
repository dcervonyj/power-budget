import type { AccountOption, CategoryOption, PlanSnapshot } from './addExpenseModel.js';

/** D7 data: October, 11 800 planned, 7 030 spent (4 770 left), 10 days left from 22 Oct. */
export const FIXTURE_PLAN: PlanSnapshot = {
  planName: 'October',
  currency: 'PLN',
  plannedMinor: 1180000n,
  spentMinor: 703000n,
  daysLeft: 10,
};

export const FIXTURE_CATEGORIES: readonly CategoryOption[] = [
  category('groceries', 'Groceries', 114864n, 220000n),
  category('eating', 'Eating out', 56250n, 50000n),
  category('transport', 'Transport', 31239n, 70000n),
  category('bills', 'Bills & insurance', 54800n, 100000n),
  { id: 'unplanned', plannedItemId: null, name: 'Unplanned', plannedMinor: 0n, spentMinor: 42500n },
];

export const FIXTURE_ACCOUNTS: readonly AccountOption[] = [
  { id: 'pko', name: 'PKO BP ··4821', currency: 'PLN' },
  { id: 'cash', name: 'Cash', currency: 'PLN' },
];

function category(
  id: string,
  name: string,
  spentMinor: bigint,
  plannedMinor: bigint,
): CategoryOption {
  return { id, plannedItemId: `item-${id}`, name, plannedMinor, spentMinor };
}
