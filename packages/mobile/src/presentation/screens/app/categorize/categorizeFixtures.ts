import type { TxRowData } from '@power-budget/shared-app';
import type { TransactionListRow } from '../../../../infrastructure/transactions/TransactionListModel.js';
import { choicesFor, impactOf } from './categorizeModel.js';
import type { CategoryChoice, Payment } from './categorizeModel.js';
import type { CategorizeSession } from './useCategorizeSession.js';

/** Fixture data shared by the View tests and the gallery entries. */

function row(
  data: Pick<TxRowData, 'id' | 'title' | 'amountMinor' | 'currency'>,
  day: string,
  suggestedPlannedItemId: string | null,
): TransactionListRow {
  return {
    data: { subtitle: '', status: 'to-sort', ...data },
    day,
    kind: 'toSort',
    live: false,
    provenance: 'bank',
    suggestedPlannedItemId,
  };
}

export const ORLEN = row(
  { id: 'orlen', title: 'Orlen', amountMinor: -12930n, currency: 'PLN' },
  '2026-10-19',
  'item-transport',
);
export const BOLT = row(
  { id: 'bolt', title: 'Bolt', amountMinor: -1240n, currency: 'EUR' },
  '2026-10-28',
  'item-transport',
);
export const ZABKA = row(
  { id: 'zabka', title: 'Żabka', amountMinor: -1890n, currency: 'PLN' },
  '2026-10-28',
  'item-groceries',
);
export const QUEUE: readonly TransactionListRow[] = [ORLEN, BOLT, ZABKA];

function choice(
  plannedItemId: string,
  name: string,
  plannedMinor: bigint,
  spentMinor: bigint,
  direction: CategoryChoice['direction'] = 'expense',
): CategoryChoice {
  return {
    plannedItemId,
    name,
    planName: 'October',
    direction,
    plannedMinor,
    spentMinor,
    currency: 'PLN',
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
  };
}

export const CHOICES: readonly CategoryChoice[] = [
  choice('item-transport', 'Transport', 70000n, 31239n),
  choice('item-groceries', 'Groceries', 220000n, 114864n),
  choice('item-eating', 'Eating out', 50000n, 56250n),
  choice('item-health', 'Health', 40000n, 8990n),
  choice('item-salary', 'Salary', 800000n, 0n, 'income'),
];

export function paymentOf(source: TransactionListRow): Payment {
  return {
    id: source.data.id,
    amountMinor: source.data.amountMinor,
    currency: source.data.currency,
    day: source.day,
    suggestedPlannedItemId: source.suggestedPlannedItemId,
  };
}

/** A session on `source` with the suggestion picked; override any field for another state. */
export function sessionOf(
  source: TransactionListRow,
  overrides: Partial<CategorizeSession> = {},
): CategorizeSession {
  const payment = paymentOf(source);
  const options = choicesFor(CHOICES, payment);
  const picked = options[0];
  const index = QUEUE.indexOf(source);

  return {
    position: index + 1,
    total: QUEUE.length,
    allDone: false,
    sortedCount: 0,
    row: source,
    options,
    picked,
    impact: picked === undefined ? undefined : impactOf(picked, payment),
    phase: 'choosing',
    failure: null,
    nextTitle: QUEUE[index + 1]?.data.title,
    pick: noop,
    confirm: noop,
    undo: noop,
    next: noop,
    dismissFailure: noop,
    ...overrides,
  };
}

function noop(): void {
  // Fixture handlers do nothing.
}
